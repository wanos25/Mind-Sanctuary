import { DailyPulse } from './pulse';

export interface PresenceContext {
  recentPulses: DailyPulse[];
  nickname?: string;
  hour?: number;
  daysSinceLastSession?: number | null;
}

const timeWord = (h: number) =>
  h < 5 ? 'late' : h < 12 ? 'this morning' : h < 17 ? 'this afternoon' : h < 22 ? 'this evening' : 'tonight';

const dominantOver = (pulses: DailyPulse[]) => {
  const m = new Map<string, number>();
  pulses.forEach((p) => { if (p.dominant_emotion) m.set(p.dominant_emotion, (m.get(p.dominant_emotion) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const avgIntensity = (pulses: DailyPulse[]) => {
  const v = pulses.map((p) => p.avg_intensity).filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export interface Presence {
  greeting: string;
  observation: string | null;
  mood: 'calm' | 'heavy' | 'neutral' | 'light';
}

export function buildPresence({ recentPulses, nickname, hour, daysSinceLastSession }: PresenceContext): Presence {
  const h = hour ?? new Date().getHours();
  const name = nickname ? `, ${nickname}` : '';
  const tw = timeWord(h);

  const dom = dominantOver(recentPulses);
  const avg = avgIntensity(recentPulses) ?? 0;
  const recent = recentPulses.slice(0, 3);
  const recentAvg = recent.length ? recent.reduce((a, p) => a + (p.avg_intensity ?? 0), 0) / recent.length : 0;

  let mood: Presence['mood'] = 'neutral';
  if (avg > 0.7 || /depress|burnout|anxiety|grief/i.test(dom ?? '')) mood = 'heavy';
  else if (avg < 0.35 || /calm/i.test(dom ?? '')) mood = 'light';
  else if (recentAvg > avg + 0.15) mood = 'heavy';

  let observation: string | null = null;

  if (daysSinceLastSession != null && daysSinceLastSession >= 3) {
    observation = `It's been ${daysSinceLastSession} days. Whatever you've been carrying — I'm here when you want to set it down.`;
  } else if (recent.length === 0 && recentPulses.length > 0) {
    observation = `You've been quiet lately. No pressure — just noticed.`;
  } else if (mood === 'heavy') {
    observation = `${tw[0].toUpperCase() + tw.slice(1)} feels emotionally heavier than your usual rhythm.`;
  } else if (mood === 'light') {
    observation = `Your recent reflections feel calmer. Something's softening.`;
  } else if (recent.length >= 3) {
    observation = `Three days of reflection. That kind of consistency matters.`;
  }

  const baseGreeting = h < 12
    ? `Good morning${name}.`
    : h < 18
      ? `Welcome back${name}.`
      : `Good evening${name}.`;

  return { greeting: baseGreeting, observation, mood };
}
