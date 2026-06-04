import { motion } from 'framer-motion';
import { useState } from 'react';
import { SessionRow } from '@/lib/sessions';
import { colorForEmotion } from '@/lib/insightsAggregator';
import { useApp } from '@/context/AppContext';

interface Props { sessions: SessionRow[]; }

export default function EmotionalTimeline({ sessions }: Props) {
  const { openExistingSession } = useApp();
  const [hover, setHover] = useState<SessionRow | null>(null);

  if (sessions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-ui tracking-[0.25em] text-muted-foreground uppercase">Emotional Timeline</h3>
        <p className="text-[10px] text-muted-foreground/60">Hover · Click to open</p>
      </div>

      <div className="relative h-32">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative flex items-center justify-between h-full">
          {sessions.map((s, i) => {
            const intensity = s.summary_intensity ?? 0.3;
            const size = 10 + intensity * 22;
            const color = colorForEmotion(s.summary_emotion);
            return (
              <motion.button
                key={s.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 220, damping: 20 }}
                whileHover={{ scale: 1.4 }}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                onClick={() => openExistingSession(s.id)}
                className="relative rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60"
                style={{
                  width: size,
                  height: size,
                  background: color,
                  boxShadow: `0 0 ${size}px ${color}`,
                }}
                aria-label={`Session ${i + 1}: ${s.summary_emotion ?? 'unknown'}`}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-4 min-h-[3rem]">
        {hover ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-foreground/80 font-ui"
          >
            <span className="text-primary capitalize">{hover.summary_emotion ?? 'unknown'}</span>
            {' · '}
            <span className="text-muted-foreground">{new Date(hover.started_at).toLocaleString()}</span>
            {' · '}
            <span className="text-foreground/60">intensity {Math.round((hover.summary_intensity ?? 0) * 100)}%</span>
          </motion.div>
        ) : (
          <p className="text-xs text-muted-foreground/60">Each node is a moment in your emotional journey.</p>
        )}
      </div>
    </motion.div>
  );
}
