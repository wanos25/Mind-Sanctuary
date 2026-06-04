import RadialClock, { RadialClockProps } from '@/components/ui/RadialClock';

/**
 * RadialHistoryClock — cinematic vault dial for the History page.
 * Thin wrapper around RadialClock with history defaults (interactive, large).
 */
export default function RadialHistoryClock(props: Omit<RadialClockProps, 'mode'>) {
  return <RadialClock mode="history" interactive size="lg" {...props} />;
}
