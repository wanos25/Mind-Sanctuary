/**
 * Durable message feedback (Like / Dislike) with optimistic UI + rollback.
 *
 * - One row per (message_id, user_id) in public.message_feedback
 * - Toggle behavior: tapping the same rating clears it
 * - Optimistic state flips immediately; failure rolls back and surfaces a toast
 * - Schema-adapter safe: missing table degrades to in-memory only (no throw)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { sbExt } from '@/lib/supabaseExt';
import { emitVoiceEvent } from '@/lib/voice/telemetry';

export type FeedbackRating = 'like' | 'dislike' | null;

const ratingToInt = (r: Exclude<FeedbackRating, null>): -1 | 1 => (r === 'like' ? 1 : -1);
const intToRating = (n: number | null | undefined): FeedbackRating =>
  n === 1 ? 'like' : n === -1 ? 'dislike' : null;

const cache = new Map<string, FeedbackRating>();
let tableMissing = false;

// message_feedback.message_id is a uuid FK to chat_messages.id. Local-only
// ids (e.g. "greeting", "av-1779984264963" for voice/optimistic bubbles) must
// never hit the table or PostgREST returns 400. Gate every query on this.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isPersistedMessageId = (id: string | null | undefined): id is string =>
  !!id && UUID_RE.test(id);


export function useFeedback(messageId: string | null | undefined) {
  const { user } = useAuth();
  const [rating, setRating] = useState<FeedbackRating>(
    messageId ? cache.get(messageId) ?? null : null,
  );
  const [pending, setPending] = useState(false);
  const inflight = useRef(false);

  useEffect(() => {
    if (!user || tableMissing || !isPersistedMessageId(messageId)) return;
    if (cache.has(messageId)) {
      setRating(cache.get(messageId) ?? null);
      return;
    }
    let active = true;

    (async () => {
      try {
        const { data, error } = await sbExt
          .from('message_feedback')
          .select('rating')
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!active) return;
        if (error) {
          const code = (error as { code?: string }).code;
          if (code === '42P01' || /relation .* does not exist/i.test(error.message ?? '')) {
            tableMissing = true;
          }
          return;
        }
        const r = intToRating(data?.rating);
        cache.set(messageId, r);
        setRating(r);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [messageId, user]);

  const apply = useCallback(async (next: FeedbackRating) => {
    if (!messageId || !user) return;
    if (inflight.current) return; // anti-double-submit
    const prev = rating;
    if (next === prev) return;
    inflight.current = true;
    setPending(true);
    setRating(next);
    cache.set(messageId, next);
    emitVoiceEvent(next === 'like' ? 'action_like' : next === 'dislike' ? 'action_dislike' : 'action_like', {
      messageId, meta: { cleared: next === null },
    });

    // Local-only ids (greeting, voice optimistic bubbles, etc.) keep optimistic
    // state in memory only — never round-trip to the DB.
    if (tableMissing || !isPersistedMessageId(messageId)) {
      setPending(false); inflight.current = false; return;
    }


    try {
      if (next === null) {
        const { error } = await sbExt
          .from('message_feedback')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await sbExt
          .from('message_feedback')
          .upsert(
            { message_id: messageId, user_id: user.id, rating: ratingToInt(next) },
            { onConflict: 'message_id,user_id' },
          );
        if (error) throw error;
      }
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === '42P01' || /relation .* does not exist/i.test(err.message ?? '')) {
        tableMissing = true;
      } else {
        // Rollback on real failure
        setRating(prev);
        cache.set(messageId, prev);
      }
    } finally {
      setPending(false);
      inflight.current = false;
    }
  }, [messageId, user, rating]);

  const like     = useCallback(() => apply(rating === 'like' ? null : 'like'), [apply, rating]);
  const dislike  = useCallback(() => apply(rating === 'dislike' ? null : 'dislike'), [apply, rating]);

  return { rating, like, dislike, pending };
}
