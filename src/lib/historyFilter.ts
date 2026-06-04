import { SessionRow } from './sessions';

export type TimeGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

export function groupByRecency(sessions: SessionRow[]): Record<TimeGroup, SessionRow[]> {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const today = startOfDay(now).getTime();
  const yest = today - 86400000;
  const weekAgo = today - 6 * 86400000;
  const out: Record<TimeGroup, SessionRow[]> = { today: [], yesterday: [], thisWeek: [], older: [] };
  for (const s of sessions) {
    const t = startOfDay(new Date(s.started_at)).getTime();
    if (t === today) out.today.push(s);
    else if (t === yest) out.yesterday.push(s);
    else if (t >= weekAgo) out.thisWeek.push(s);
    else out.older.push(s);
  }
  return out;
}

export interface DialFilter {
  date: Date | null;
  hour: number | null;
}

export function filterByDial(sessions: SessionRow[], f: DialFilter): SessionRow[] {
  if (!f.date && f.hour === null) return sessions;
  return sessions.filter(s => {
    const d = new Date(s.started_at);
    if (f.date) {
      if (d.getFullYear() !== f.date.getFullYear()) return false;
      if (d.getMonth() !== f.date.getMonth()) return false;
      if (d.getDate() !== f.date.getDate()) return false;
    }
    if (f.hour !== null && d.getHours() !== f.hour) return false;
    return true;
  });
}

export function searchSessions(sessions: SessionRow[], q: string): SessionRow[] {
  if (!q.trim()) return sessions;
  const ql = q.toLowerCase();
  return sessions.filter(s =>
    (s.summary_emotion ?? '').toLowerCase().includes(ql) ||
    new Date(s.started_at).toLocaleString().toLowerCase().includes(ql)
  );
}
