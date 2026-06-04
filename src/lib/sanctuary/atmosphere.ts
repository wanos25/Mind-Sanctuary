import { DailyPulse } from '@/lib/presence/pulse';

export type Weather = 'clear' | 'golden' | 'fog' | 'rain' | 'aurora';

export interface SanctuaryState {
  weather: Weather;
  warmth: number;   // 0..1
  density: number;  // particle density 0..1
  glow: number;     // 0..1
  caption: string;
  palette: { warm: string; cool: string };
}

export function deriveSanctuary(pulses: DailyPulse[], hour = new Date().getHours()): SanctuaryState {
  const recent = pulses.slice(0, 7);
  const avg = recent.length
    ? recent.reduce((a, p) => a + (p.avg_intensity ?? 0), 0) / recent.length
    : 0;
  const dominant = recent[0]?.dominant_emotion?.toLowerCase() ?? '';

  let weather: Weather = 'clear';
  let warmth = 0.6, density = 0.5, glow = 0.55;
  let caption = 'Your sanctuary is settled.';
  let palette = { warm: '38 55% 60%', cool: '20 25% 30%' };

  if (avg > 0.75 || /burnout|depress/.test(dominant)) {
    weather = 'fog'; warmth = 0.4; density = 0.85; glow = 0.35;
    caption = 'A quiet fog has settled. Move slowly here.';
    palette = { warm: '230 25% 45%', cool: '260 25% 38%' };
  } else if (avg > 0.55 || /anxiety|stress|anger/.test(dominant)) {
    weather = 'rain'; warmth = 0.5; density = 0.7; glow = 0.45;
    caption = 'A reflective rain. Listen to it.';
    palette = { warm: '210 35% 50%', cool: '220 30% 35%' };
  } else if (recent.length >= 5 && avg < 0.4) {
    weather = 'golden'; warmth = 0.85; density = 0.45; glow = 0.8;
    caption = 'A golden hour. Something is recovering.';
    palette = { warm: '38 65% 60%', cool: '24 40% 35%' };
  } else if (hour >= 22 || hour < 5) {
    weather = 'aurora'; warmth = 0.55; density = 0.6; glow = 0.6;
    caption = 'Late hours. Your inner sky is awake.';
    palette = { warm: '260 50% 55%', cool: '180 40% 40%' };
  }

  return { weather, warmth, density, glow, caption, palette };
}
