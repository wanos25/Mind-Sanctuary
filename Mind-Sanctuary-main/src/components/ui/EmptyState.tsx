import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  /** Visual tone — shifts the aurora hue. */
  tone?: "default" | "clinical" | "warm" | "calm";
}

const TONE_HUE: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  default: "var(--primary)",
  clinical: "210 90% 60%",
  warm: "28 85% 62%",
  calm: "165 60% 55%",
};

/**
 * Premium empty state: aurora halo behind a soft glass icon, with intentional
 * copy hierarchy and a quiet hint line. Replaces generic "no items" cards.
 * Additive — fully RTL-safe, reduced-motion-aware via .aurora-breathe.
 */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon = Sparkles, title, description, hint, action, className, tone = "default" }, ref) => {
    const hue = TONE_HUE[tone];
    return (
      <Card
        ref={ref}
        className={cn(
          "relative overflow-hidden border-dashed bg-card/60 backdrop-blur-sm",
          "px-6 py-14 text-center",
          className,
        )}
      >
        {/* aurora halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="aurora-breathe h-44 w-44 rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, hsl(${hue} / 0.35), transparent 70%)`,
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative mx-auto flex max-w-md flex-col items-center gap-3"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-background/70 shadow-sm backdrop-blur"
            style={{ boxShadow: `0 8px 30px -10px hsl(${hue} / 0.45)` }}
          >
            <Icon className="h-6 w-6 text-foreground/80" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          {hint ? (
            <p className="text-xs uppercase tracking-wider text-muted-foreground/70">{hint}</p>
          ) : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </motion.div>
      </Card>
    );
  },
);
EmptyState.displayName = "EmptyState";
