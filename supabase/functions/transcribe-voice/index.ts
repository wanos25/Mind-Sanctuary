// Transcribes user voice. Munsit is the PRIMARY Arabic STT provider; we fall back
// to ElevenLabs (and use ElevenLabs as the primary for non-Arabic locales).
// Provider is returned for client-side telemetry.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { decode as base64Decode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';
import { requireAuth } from '../_shared/requireAuth.ts';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const MUNSIT_API_KEY = Deno.env.get('MUNSIT_API_KEY');
const MUNSIT_BASE_URL = Deno.env.get('MUNSIT_BASE_URL') || 'https://api.munsit.com';

const ISO3_BY_LANG: Record<string, string> = {
  en: 'eng', ar: 'ara', es: 'spa', fr: 'fra', it: 'ita',
};

interface SttResult { text: string; provider: 'munsit' | 'elevenlabs'; latencyMs: number; }

async function transcribeMunsit(bytes: Uint8Array, mime: string): Promise<string> {
  const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new File([bytes], `voice.${ext}`, { type: mime }));
  form.append('model', 'munsit');
  const r = await fetch(`${MUNSIT_BASE_URL}/api/v1/audio/transcribe`, {
    method: 'POST',
    headers: { 'x-api-key': MUNSIT_API_KEY! },
    body: form,
  });
  if (!r.ok) throw new Error(`munsit-stt ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return (data?.data?.transcription ?? data?.transcription ?? '').toString();
}

async function transcribeElevenLabs(bytes: Uint8Array, mime: string, baseLang: string): Promise<string> {
  const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', new File([bytes], `voice.${ext}`, { type: mime }));
  form.append('model_id', 'scribe_v2');
  form.append('tag_audio_events', 'false');
  form.append('diarize', 'false');
  const languageCode = ISO3_BY_LANG[baseLang];
  if (languageCode) form.append('language_code', languageCode);
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY! },
    body: form,
  });
  if (!r.ok) throw new Error(`elevenlabs-stt ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return (data?.text ?? '').toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const audioBase64 = (body?.audioBase64 ?? '').toString();
    const mime = (body?.mime ?? 'audio/webm').toString();
    const incomingLang = (body?.lang ?? '').toString();
    const baseLang = incomingLang.toLowerCase().split('-')[0];
    if (!audioBase64) return json({ error: 'audioBase64 required' }, 400);

    const bytes = base64Decode(audioBase64);
    const isArabic = baseLang === 'ar';
    const munsitReady = !!MUNSIT_API_KEY;
    const elevenReady = !!ELEVENLABS_API_KEY;
    const preferMunsit = isArabic && munsitReady;

    const providers: Array<{ name: 'munsit' | 'elevenlabs'; run: () => Promise<string> }> = [];
    if (preferMunsit) {
      providers.push({ name: 'munsit', run: () => transcribeMunsit(bytes, mime) });
      if (elevenReady) providers.push({ name: 'elevenlabs', run: () => transcribeElevenLabs(bytes, mime, baseLang) });
    } else {
      if (elevenReady) providers.push({ name: 'elevenlabs', run: () => transcribeElevenLabs(bytes, mime, baseLang) });
      if (munsitReady) providers.push({ name: 'munsit', run: () => transcribeMunsit(bytes, mime) });
    }

    console.log('[transcribe-voice] route', JSON.stringify({
      incomingLang, baseLang, isArabic, munsitReady, elevenReady,
      providerOrder: providers.map((p) => p.name),
    }));

    if (providers.length === 0) return json({ error: 'no STT provider configured', fallback: true, text: '' }, 200);

    let lastErr: unknown;
    const attempts: Array<{ provider: string; ok: boolean; error?: string; latencyMs: number }> = [];
    for (const p of providers) {
      const t0 = Date.now();
      try {
        const text = await p.run();
        const latencyMs = Date.now() - t0;
        attempts.push({ provider: p.name, ok: true, latencyMs });
        console.log('[transcribe-voice] selected', JSON.stringify({ baseLang, selected: p.name, attempts }));
        const result: SttResult = { text, provider: p.name, latencyMs };
        return json(result);
      } catch (e) {
        const latencyMs = Date.now() - t0;
        const msg = (e as Error)?.message ?? String(e);
        attempts.push({ provider: p.name, ok: false, error: msg.slice(0, 240), latencyMs });
        console.warn('[transcribe-voice] provider failed', JSON.stringify({ baseLang, provider: p.name, latencyMs, error: msg.slice(0, 240) }));
        lastErr = e;
      }
    }
    console.error('[transcribe-voice] all providers failed', JSON.stringify({ baseLang, attempts }));
    return json({ error: (lastErr as Error)?.message || 'STT failed', fallback: true, text: '' }, 200);
  } catch (e) {
    console.error('transcribe-voice', e);
    return json({ error: (e as Error).message, fallback: true, text: '' }, 200);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
