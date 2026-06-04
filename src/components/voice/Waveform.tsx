import { memo } from 'react';
import { motion } from 'framer-motion';

interface Props {
  values: number[];                 // 0..1 peaks
  progress?: number;                // 0..1 playback position
  active?: boolean;                 // glow/animate
  color?: string;                   // CSS color
  height?: number;
  barWidth?: number;
  gap?: number;
  className?: string;
  onSeek?: (ratio: number) => void;
}

function WaveformView({
  values, progress = 0, active, color = 'hsl(var(--gold))',
  height = 28, barWidth = 2.5, gap = 2, className, onSeek,
}: Props) {
  const total = values.length || 1;

  return (
    <div
      className={`relative flex items-center select-none ${onSeek ? 'cursor-pointer' : ''} ${className ?? ''}`}
      style={{ height, gap }}
      onClick={(e) => {
        if (!onSeek) return;
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      }}
    >
      {values.map((v, i) => {
        const past = i / total < progress;
        const h = Math.max(2, v * height);
        // Subtle shimmer: bars near the playhead get a soft amplitude wiggle.
        const distFromHead = Math.abs(i / total - progress);
        const shimmer = active && distFromHead < 0.08 ? 1 + (0.08 - distFromHead) * 1.4 : 1;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={active ? { height: h * shimmer } : undefined}
            style={{
              width: barWidth,
              height: h,
              borderRadius: 999,
              background: past ? color : 'hsl(var(--muted-foreground) / 0.45)',
              boxShadow: active && v > 0.55 ? `0 0 6px ${color}` : 'none',
              opacity: past ? 1 : 0.85,
            }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export default memo(WaveformView);
