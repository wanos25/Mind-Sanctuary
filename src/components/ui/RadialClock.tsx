import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
} from 'framer-motion';
import { EmotionState } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export interface RadialClockProps {
  mode?: 'live' | 'history' | 'dashboard';
  size?: 'sm' | 'md' | 'lg';
  emotion?: EmotionState | null;
  interactive?: boolean;
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  streaming?: boolean;
  className?: string;
}

const SIZES: Record<NonNullable<RadialClockProps['size']>, number> = {
  sm: 240,
  md: 360,
  lg: 520,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface RingProps {
  radius: number;
  items: string[];
  activeIndex: number;
  rotation: any;
  fontSize: number;
  interactive?: boolean;
  onSelect?: (i: number) => void;
  onDrag?: (delta: number) => void;
  glow?: boolean;
}

function Ring({ radius, items, activeIndex, rotation, fontSize, interactive, onSelect, onDrag, glow }: RingProps) {
  const step = 360 / items.length;
  const dragRef = useRef<{ startAngle: number; lastAngle: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive || !onDrag) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    dragRef.current = { startAngle: a, lastAngle: a };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !onDrag) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const delta = a - dragRef.current.lastAngle;
    dragRef.current.lastAngle = a;
    onDrag(delta);
  };
  const handlePointerUp = () => { dragRef.current = null; };

  return (
    <motion.div
      className={cn('absolute inset-0', interactive && 'cursor-grab active:cursor-grabbing')}
      style={{ rotate: rotation, transformOrigin: '50% 50%' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="absolute inset-0 rounded-full border border-border/20"
        style={{
          width: radius * 2,
          height: radius * 2,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      {items.map((label, i) => {
        const angle = i * step - 90;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const isActive = i === activeIndex;
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            tabIndex={interactive ? 0 : -1}
            aria-label={label}
            onClick={() => interactive && onSelect?.(i)}
            className={cn(
              'absolute select-none font-ui tracking-widest transition-colors duration-300',
              'flex items-center justify-center',
              isActive
                ? 'text-gold drop-shadow-[0_0_8px_hsl(var(--gold)/0.7)]'
                : 'text-muted-foreground/60 hover:text-foreground/80',
            )}
            style={{
              left: '50%',
              top: '50%',
              width: fontSize * 2.4,
              height: fontSize * 1.6,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle + 90}deg)`,
              fontSize,
              fontWeight: isActive ? 600 : 400,
              ...(glow && isActive ? { textShadow: '0 0 12px hsl(var(--gold) / 0.8)' } : {}),
            }}
          >
            {label}
          </button>
        );
      })}
    </motion.div>
  );
}

export default function RadialClock({
  mode = 'live',
  size = 'md',
  emotion: _emotion,
  interactive,
  selectedDate,
  onDateSelect,
  streaming,
  className,
}: RadialClockProps) {
  const reduce = useReducedMotion();
  const px = SIZES[size];
  const half = px / 2;

  const isInteractive = interactive ?? mode === 'history';

  const [now, setNow] = useState(() => new Date());
  const [internalDate, setInternalDate] = useState<Date>(() => selectedDate ?? new Date());
  const activeDate = selectedDate ?? internalDate;

  useEffect(() => {
    if (mode === 'history') return;
    let raf = 0;
    const loop = () => {
      setNow(new Date());
      raf = window.setTimeout(() => requestAnimationFrame(loop), 1000) as unknown as number;
    };
    loop();
    return () => window.clearTimeout(raf);
  }, [mode]);

  const daysInMonth = useMemo(
    () => new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 0).getDate(),
    [activeDate],
  );
  const dayItems = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0')),
    [daysInMonth],
  );

  const dayStep = 360 / daysInMonth;
  const monthStep = 360 / 12;
  const weekdayStep = 360 / 7;

  const targetDayRot = -((activeDate.getDate() - 1) * dayStep);
  const targetMonthRot = -(activeDate.getMonth() * monthStep);
  const targetWeekdayRot = -(activeDate.getDay() * weekdayStep);

  const dayRot = useMotionValue(targetDayRot);
  const monthRot = useMotionValue(targetMonthRot);
  const weekdayRot = useMotionValue(targetWeekdayRot);

  const dayRotS = useSpring(dayRot, { stiffness: 70, damping: 20, mass: 0.6 });
  const monthRotS = useSpring(monthRot, { stiffness: 60, damping: 22, mass: 0.7 });
  const weekdayRotS = useSpring(weekdayRot, { stiffness: 80, damping: 22, mass: 0.5 });

  useEffect(() => {
    if (reduce || mode === 'history') return;
    const c1 = animate(dayRot, [targetDayRot, targetDayRot + 0.6, targetDayRot], {
      duration: 12, repeat: Infinity, ease: 'easeInOut',
    });
    const c2 = animate(monthRot, [targetMonthRot, targetMonthRot - 0.4, targetMonthRot], {
      duration: 16, repeat: Infinity, ease: 'easeInOut',
    });
    return () => { c1.stop(); c2.stop(); };
  }, [reduce, mode]);

  useEffect(() => {
    animate(dayRot, targetDayRot, { type: 'spring', stiffness: 70, damping: 20 });
    animate(monthRot, targetMonthRot, { type: 'spring', stiffness: 60, damping: 22 });
    animate(weekdayRot, targetWeekdayRot, { type: 'spring', stiffness: 80, damping: 22 });
  }, [targetDayRot, targetMonthRot, targetWeekdayRot]);

  const commitDate = useCallback(
    (d: Date) => {
      setInternalDate(d);
      onDateSelect?.(d);
    },
    [onDateSelect],
  );

  const setDay = (dayIndex: number) => {
    const d = new Date(activeDate);
    d.setDate(dayIndex + 1);
    commitDate(d);
  };
  const setMonth = (m: number) => {
    const d = new Date(activeDate);
    d.setMonth(m);
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() > maxDay) d.setDate(maxDay);
    commitDate(d);
  };
  const setWeekday = (wd: number) => {
    const d = new Date(activeDate);
    const diff = wd - d.getDay();
    d.setDate(d.getDate() + diff);
    commitDate(d);
  };

  const snap = (mv: any, step: number, onIndex: (i: number) => void) => {
    const cur = mv.get();
    const idx = Math.round(-cur / step);
    onIndex(((idx % (360 / step)) + (360 / step)) % (360 / step));
  };

  const dragDay = (delta: number) => {
    if (reduce) return;
    dayRot.set(dayRot.get() + delta);
  };
  const dragDayEnd = () => snap(dayRot, dayStep, (i) => setDay(Math.min(i, daysInMonth - 1)));

  useEffect(() => {
    if (!isInteractive) return;
    const handler = (e: WheelEvent) => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const newDate = new Date(activeDate);
      newDate.setDate(newDate.getDate() + dir);
      commitDate(newDate);
    };
    window.addEventListener('wheel', handler, { passive: false });
    return () => window.removeEventListener('wheel', handler);
  }, [isInteractive, activeDate, commitDate]);

  const ref = useRef<HTMLDivElement>(null);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const pulseScale = useTransform(useMotionValue(0), [0, 1], [1, 1.02]);
  const ringRadii = {
    outer: half - 18,
    middle: half - 50,
    inner: half - 82,
  };

  const fontOuter = size === 'sm' ? 8 : size === 'md' ? 10 : 12;
  const fontMid = size === 'sm' ? 9 : size === 'md' ? 11 : 13;
  const fontInner = size === 'sm' ? 9 : size === 'md' ? 11 : 13;

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Radial clock"
      className={cn('relative select-none', className)}
      style={{ width: px, height: px }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, hsl(var(--gold)/0.18) 0%, hsl(var(--gold)/0.06) 35%, transparent 70%)',
          filter: 'blur(20px)',
        }}
        animate={
          reduce
            ? undefined
            : { opacity: streaming ? [0.6, 1, 0.6] : [0.45, 0.7, 0.45] }
        }
        transition={{ duration: streaming ? 2.6 : 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div
        className="absolute inset-0 rounded-full backdrop-blur-xl"
        style={{
          background:
            'radial-gradient(circle at 30% 25%, hsl(0 0% 100% / 0.04), transparent 55%), radial-gradient(circle at 70% 80%, hsl(var(--gold)/0.05), transparent 60%), hsl(var(--background)/0.55)',
          boxShadow:
            'inset 0 1px 0 hsl(0 0% 100% / 0.06), inset 0 -20px 60px hsl(0 0% 0% / 0.5), 0 30px 80px -20px hsl(0 0% 0% / 0.6)',
          border: '1px solid hsl(var(--border)/0.4)',
        }}
      />

      <Ring
        radius={ringRadii.outer}
        items={dayItems}
        activeIndex={activeDate.getDate() - 1}
        rotation={dayRotS}
        fontSize={fontOuter}
        interactive={isInteractive}
        onSelect={setDay}
        onDrag={(d) => { dragDay(d); }}
        glow
      />

      <Ring
        radius={ringRadii.middle}
        items={MONTHS}
        activeIndex={activeDate.getMonth()}
        rotation={monthRotS}
        fontSize={fontMid}
        interactive={isInteractive}
        onSelect={setMonth}
      />

      <Ring
        radius={ringRadii.inner}
        items={WEEKDAYS}
        activeIndex={activeDate.getDay()}
        rotation={weekdayRotS}
        fontSize={fontInner}
        interactive={isInteractive}
        onSelect={setWeekday}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: px * 0.32,
          height: px * 0.32,
          scale: pulseScale,
          background:
            'radial-gradient(circle at 50% 40%, hsl(var(--gold)/0.18), hsl(0 0% 0% / 0.6) 70%)',
          boxShadow: '0 0 40px hsl(var(--gold)/0.25), inset 0 0 30px hsl(0 0% 0% / 0.6)',
          border: '1px solid hsl(var(--border)/0.5)',
        }}
        animate={
          streaming && !reduce
            ? { scale: [1, 1.04, 1], boxShadow: [
                '0 0 40px hsl(var(--gold)/0.25), inset 0 0 30px hsl(0 0% 0% / 0.6)',
                '0 0 60px hsl(var(--gold)/0.45), inset 0 0 30px hsl(0 0% 0% / 0.6)',
                '0 0 40px hsl(var(--gold)/0.25), inset 0 0 30px hsl(0 0% 0% / 0.6)',
              ] }
            : undefined
        }
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 origin-top bg-foreground/40"
            style={{
              width: 1,
              height: px * 0.018,
              transform: `translate(-50%, 0) rotate(${i * 30}deg) translateY(${px * 0.13}px)`,
            }}
          />
        ))}
        <motion.div
          className="absolute left-1/2 top-1/2 origin-bottom rounded-full bg-foreground/80"
          style={{
            width: 2,
            height: px * 0.08,
            x: '-50%',
            y: '-100%',
            rotate: hourAngle,
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 origin-bottom rounded-full bg-foreground"
          style={{
            width: 1.5,
            height: px * 0.115,
            x: '-50%',
            y: '-100%',
            rotate: minuteAngle,
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 origin-bottom rounded-full bg-gold"
          style={{
            width: 1,
            height: px * 0.13,
            x: '-50%',
            y: '-100%',
            rotate: secondAngle,
            boxShadow: '0 0 6px hsl(var(--gold)/0.8)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold"
          style={{ width: 6, height: 6, boxShadow: '0 0 10px hsl(var(--gold))' }}
        />
      </motion.div>

      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: 2 }}
      >
        <div
          className="h-2 w-2 rotate-45 bg-gold"
          style={{ boxShadow: '0 0 10px hsl(var(--gold))' }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        onPointerUp={dragDayEnd}
      />
    </div>
  );
}
