/**
 * In-memory aggregation over the voice telemetry ring buffer.
 * Pure, side-effect free — safe to call from render.
 */
import { snapshotVoiceTelemetry, type VoiceEvent, type VoiceEventName } from './telemetry';

export interface AggregateStats {
  count: number;
  avgMs: number;
  p95Ms: number;
  failures: number;
}

function stats(events: VoiceEvent[]): AggregateStats {
  const okDur = events.filter((e) => typeof e.durationMs === 'number').map((e) => e.durationMs!);
  okDur.sort((a, b) => a - b);
  const avg = okDur.length ? Math.round(okDur.reduce((a, b) => a + b, 0) / okDur.length) : 0;
  const p95 = okDur.length ? okDur[Math.min(okDur.length - 1, Math.floor(okDur.length * 0.95))] : 0;
  return { count: okDur.length, avgMs: avg, p95Ms: Math.round(p95), failures: 0 };
}

export interface TelemetrySummary {
  upload: AggregateStats;
  stt: AggregateStats;
  tts: AggregateStats;
  total: AggregateStats;
  retries: number;
  autoplaySuccessRate: number; // 0..1
  totalEvents: number;
}

const okOf = (events: VoiceEvent[], name: VoiceEventName) => events.filter((e) => e.name === name);
const failsOf = (events: VoiceEvent[], name: VoiceEventName) => events.filter((e) => e.name === name).length;

export function summarize(events: VoiceEvent[] = snapshotVoiceTelemetry()): TelemetrySummary {
  const upload = stats(okOf(events, 'upload_completed'));
  upload.failures = failsOf(events, 'upload_failed');
  const stt = stats(okOf(events, 'stt_completed'));
  stt.failures = failsOf(events, 'stt_failed');
  const tts = stats(okOf(events, 'tts_completed'));
  tts.failures = failsOf(events, 'tts_failed');

  // Roundtrip approximation: per messageId, recording_started → autoplay_started/tts_completed
  const byMsg = new Map<string, { start?: number; end?: number }>();
  for (const e of events) {
    if (!e.messageId) continue;
    const slot = byMsg.get(e.messageId) ?? {};
    if (e.name === 'recording_started') slot.start = e.at;
    if (e.name === 'autoplay_started' || e.name === 'tts_completed') slot.end = Math.max(slot.end ?? 0, e.at);
    byMsg.set(e.messageId, slot);
  }
  const totalDurations = Array.from(byMsg.values())
    .filter((s) => s.start && s.end && s.end > s.start)
    .map((s) => s.end! - s.start!);
  totalDurations.sort((a, b) => a - b);
  const total: AggregateStats = {
    count: totalDurations.length,
    avgMs: totalDurations.length ? Math.round(totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length) : 0,
    p95Ms: totalDurations.length ? Math.round(totalDurations[Math.floor(totalDurations.length * 0.95)] ?? 0) : 0,
    failures: 0,
  };

  const retries = events.filter((e) => e.name === 'pipeline_retry').length;
  const autoplayOk = events.filter((e) => e.name === 'autoplay_started').length;
  const autoplayTried = autoplayOk + events.filter((e) => e.name === 'autoplay_blocked' || e.name === 'autoplay_failed').length;

  return {
    upload,
    stt,
    tts,
    total,
    retries,
    autoplaySuccessRate: autoplayTried ? autoplayOk / autoplayTried : 1,
    totalEvents: events.length,
  };
}

export function similarityScore(a: string, b: string): number {
  // Normalized Damerau-light: token jaccard. Good enough for "did STT roughly recover the phrase?".
  const norm = (s: string) => s.replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const ta = new Set(norm(a).split(' ').filter(Boolean));
  const tb = new Set(norm(b).split(' ').filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 1;
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}
