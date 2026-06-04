// Generates a SHORT, emotionally paraphrased version of an assistant reply
// and converts it to speech. Munsit is preferred for Arabic when configured;
// ElevenLabs is used otherwise and as a fallback.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import {
  resolveVoiceProfile,
  normalizeGender,
  type VoiceProviderName,
} from '../_shared/voiceProfileResolver.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const MUNSIT_API_KEY = Deno.env.get('MUNSIT_API_KEY');
const MUNSIT_BASE_URL = Deno.env.get('MUNSIT_BASE_URL') || 'https://api.munsit.com';
const MUNSIT_TTS_VOICE_ID = Deno.env.get('MUNSIT_TTS_VOICE_ID');
const MUNSIT_TTS_VOICE_ID_MALE = Deno.env.get('MUNSIT_TTS_VOICE_ID_MALE');
const MUNSIT_TTS_VOICE_ID_FEMALE = Deno.env.get('MUNSIT_TTS_VOICE_ID_FEMALE');
const MUNSIT_TTS_MODEL_ID = Deno.env.get('MUNSIT_TTS_MODEL_ID') || 'munsit-tts-1';

const LANG_NAMES: Record<string, string> = {
  en: 'English', ar: 'Arabic', es: 'Spanish', fr: 'French', it: 'Italian',
};

async function paraphrase(
  text: string,
  lang: string,
  emotion?: string,
  gender?: string,
): Promise<string> {
  const langName = LANG_NAMES[lang] ?? 'the same language as the input';
  const g = normalizeGender(gender);
  const genderNote = g === 'male'
    ? ' Address the listener with masculine Arabic grammar when speaking Arabic.'
    : g === 'female'
    ? ' Address the listener with feminine Arabic grammar when speaking Arabic.'
    : '';

  const sys = `You are Dr. Sentinel speaking aloud to a patient. Rewrite the assistant's text reply as a SHORT, warm, emotionally human voice note in ${langName}.

Rules:
- 1–2 sentences, max ~28 words.
- Same meaning, completely different wording. Never quote the original.
- Sound spoken, not written. No markdown, no lists, no emojis.
- Tender, calm, present. Acknowledge feeling first when relevant${emotion ? ` (current emotion: ${emotion})` : ''}.${genderNote}
- Reply ONLY with the spoken sentence. No prefix, no quotes.`;

  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GEMINI_API_KEY}` },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: text }],
    }),
  });
  if (!r.ok) throw new Error(`paraphrase ${r.status}`);
  const data = await r.json();
  const out: string = (data?.choices?.[0]?.message?.content ?? '').trim();
  return out.replace(/^["'“”]|["'“”]$/g, '').slice(0, 400);
}

async function ttsElevenLabs(text: string, voiceId: string): Promise<{ buf: ArrayBuffer; mime: string }> {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.55, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true, speed: 0.95 },
      }),
    },
  );
  if (!r.ok) throw new Error(`elevenlabs-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { buf: await r.arrayBuffer(), mime: 'audio/mpeg' };
}

async function ttsMunsit(text: string, voiceId: string): Promise<{ buf: ArrayBuffer; mime: string }> {
  const r = await fetch(`${MUNSIT_BASE_URL}/api/v1/text-to-speech/${MUNSIT_TTS_MODEL_ID}`, {
    method: 'POST',
    headers: { 'x-api-key': MUNSIT_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voice_id: voiceId,
      text,
      stability: 0.5,
      speed: 0.98,
      streaming: false,
    }),
  });
  if (!r.ok) throw new Error(`munsit-tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { buf: await r.arrayBuffer(), mime: 'audio/wav' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const text: string = (body?.text ?? '').toString();
    const lang: string = (body?.lang ?? 'en').toString().slice(0, 5).toLowerCase();
    const emotion: string | undefined = body?.emotion;
    const gender: string | undefined = body?.gender;
    if (!text || text.trim().length < 4) return json({ error: 'text required' }, 400);

    const munsitReady = !!MUNSIT_API_KEY && !!(MUNSIT_TTS_VOICE_ID || MUNSIT_TTS_VOICE_ID_MALE || MUNSIT_TTS_VOICE_ID_FEMALE);
    const elevenReady = !!ELEVENLABS_API_KEY;

    const profile = resolveVoiceProfile({
      language: lang,
      gender,
      providers: { munsit: munsitReady, elevenlabs: elevenReady },
      munsitVoiceIds: {
        default: MUNSIT_TTS_VOICE_ID ?? undefined,
        male: MUNSIT_TTS_VOICE_ID_MALE ?? MUNSIT_TTS_VOICE_ID ?? undefined,
        female: MUNSIT_TTS_VOICE_ID_FEMALE ?? MUNSIT_TTS_VOICE_ID ?? undefined,
      },
    });

    let spoken: string;
    try {
      spoken = await paraphrase(text, profile.baseLang, emotion, gender);
    } catch (e) {
      console.warn('[tts-reply] paraphrase failed, using original text', e);
      spoken = text.slice(0, 400);
    }
    if (!spoken || spoken.trim().length < 2) spoken = text.slice(0, 400);

    const order: Array<{ name: VoiceProviderName; run: () => Promise<{ buf: ArrayBuffer; mime: string }> }> = [];
    for (const name of profile.providerOrder) {
      if (name === 'munsit' && profile.munsitVoiceId) {
        const vid = profile.munsitVoiceId;
        order.push({ name: 'munsit', run: () => ttsMunsit(spoken, vid) });
      }
      if (name === 'elevenlabs') {
        order.push({ name: 'elevenlabs', run: () => ttsElevenLabs(spoken, profile.voiceId) });
      }
    }

    console.log('[tts-reply] route', JSON.stringify({
      incomingLang: lang,
      baseLang: profile.baseLang,
      gender: profile.gender,
      voiceId: profile.voiceId,
      munsitVoiceId: profile.munsitVoiceId,
      primaryProvider: profile.primaryProvider,
      fallbackProvider: profile.fallbackProvider,
      providerOrder: profile.providerOrder,
    }));

    if (order.length === 0) return json({ error: 'no TTS provider configured', fallback: true }, 200);

    let lastErr: unknown;
    const attempts: Array<{ provider: string; ok: boolean; error?: string; latencyMs: number }> = [];
    for (const p of order) {
      const t0 = Date.now();
      try {
        const { buf, mime } = await p.run();
        const latencyMs = Date.now() - t0;
        attempts.push({ provider: p.name, ok: true, latencyMs });
        console.log('[tts-reply] selected', JSON.stringify({ baseLang: profile.baseLang, selected: p.name, attempts }));
        const audioBase64 = base64Encode(new Uint8Array(buf));
        return json({
          paraphrase: spoken,
          audioBase64,
          mime,
          provider: p.name,
          latencyMs,
          voiceProfile: {
            voiceId: profile.voiceId,
            primaryProvider: profile.primaryProvider,
            fallbackProvider: profile.fallbackProvider,
          },
        });
      } catch (e) {
        const latencyMs = Date.now() - t0;
        const msg = (e as Error)?.message ?? String(e);
        attempts.push({ provider: p.name, ok: false, error: msg.slice(0, 240), latencyMs });
        console.warn('[tts-reply] provider failed', JSON.stringify({ baseLang: profile.baseLang, provider: p.name, latencyMs, error: msg.slice(0, 240) }));
        lastErr = e;
      }
    }
    console.error('[tts-reply] all providers failed', JSON.stringify({ baseLang: profile.baseLang, attempts }));
    throw lastErr ?? new Error('tts failed');
  } catch (e) {
    console.error('tts-reply', e);
    return json({ error: (e as Error).message, fallback: true }, 200);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
