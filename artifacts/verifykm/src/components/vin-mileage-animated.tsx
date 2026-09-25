import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { mileageColor } from "@/lib/mileage-color";
import { formatMilesInParens } from "@/lib/format-km-with-miles";
import { useLightMotion } from "@/hooks/use-light-motion";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Fast count-up on each mount (re-runs when odometer value changes). */
export function useCountUp(target: number, durationMs = 880): number {
  const reduced = useReducedMotion();
  const light = useLightMotion();
  const skip = !!(reduced || light);
  const [value, setValue] = useState(skip ? target : 0);

  useEffect(() => {
    if (skip) {
      setValue(target);
      return;
    }
    setValue(0);
    if (target <= 0) return;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, skip]);

  return value;
}

type AnimatedMileageKmProps = {
  value: number;
  className?: string;
  animateSlide?: boolean;
};

/** Odometer digits that count up + optional slide-in from the left. */
export function AnimatedMileageKm({ value, className, animateSlide = true }: AnimatedMileageKmProps) {
  const reduced = useReducedMotion();
  const light = useLightMotion();
  const display = useCountUp(value);

  if (reduced || light || !animateSlide) {
    return <span className={className}>{display.toLocaleString()}</span>;
  }

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.42, ease: EASE_OUT }}
    >
      {display.toLocaleString()}
    </motion.span>
  );
}

type VinMileageGaugeProps = {
  odometer: number;
  odoMax?: number;
  t: (k: string) => string;
  className?: string;
  size?: "lg" | "sm";
  showScale?: boolean;
  showMiles?: boolean;
  /** Localized date of the highest recorded reading (shown beside the km readout). */
  recordedDate?: string | null;
};

/** Bar grows from the left while the km readout counts up. */
export function VinMileageGauge({
  odometer,
  odoMax = 300_000,
  t,
  className,
  size = "lg",
  showScale = true,
  showMiles = true,
  recordedDate,
}: VinMileageGaugeProps) {
  const reduced = useReducedMotion();
  const light = useLightMotion();
  const skipMotion = !!(reduced || light);
  const odoCol = mileageColor(odometer);
  const odoPct = Math.min(100, (odometer / odoMax) * 100);
  const displayKm = useCountUp(odometer);
  const isLg = size === "lg";

  return (
    <motion.div
      className={cn(className)}
      initial={skipMotion ? false : { opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.48, ease: EASE_OUT }}
    >
      <div className={cn("flex items-end justify-between gap-3", isLg ? "mb-4" : "mb-3")}>
        <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
          <span className={cn("font-black tabular-nums", odoCol.text, isLg ? "text-3xl" : "text-2xl")}>
            {displayKm.toLocaleString()}
          </span>
          {recordedDate ? (
            <span
              className={cn(
                "font-medium text-muted-foreground/55 tabular-nums leading-tight",
                isLg ? "text-sm" : "text-xs",
              )}
            >
              {recordedDate}
            </span>
          ) : null}
        </div>
        <div className="text-right mb-0.5">
          <span className={cn("text-muted-foreground block", isLg ? "text-sm" : "text-xs")}>km</span>
          {showMiles ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatMilesInParens(odometer, t)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5 overflow-hidden">
        <div className={cn("w-full rounded-full bg-muted overflow-hidden", isLg ? "h-2.5" : "h-2")}>
          <motion.div
            className={cn("h-full rounded-full origin-left", odoCol.bar)}
            initial={skipMotion ? { scaleX: odoPct / 100 } : { scaleX: 0 }}
            animate={{ scaleX: odoPct / 100 }}
            transition={{ duration: 0.95, ease: EASE_OUT, delay: skipMotion ? 0 : 0.1 }}
            style={{ width: "100%" }}
          />
        </div>
        {showScale && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 km</span>
            <span>150,000 km</span>
            <span>300,000 km</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

type AnimatedMileageBadgeProps = {
  odometer: number;
  t?: (k: string) => string;
  className?: string;
  showMiles?: boolean;
};

/** Compact pill used in section headers (counts up on load). */
export function AnimatedMileageBadge({
  odometer,
  t,
  className,
  showMiles = false,
}: AnimatedMileageBadgeProps) {
  const display = useCountUp(odometer);
  const reduced = useReducedMotion();
  const light = useLightMotion();

  const content = (
    <>
      {display.toLocaleString()} km
      {showMiles && t && (
        <span className="text-[10px] font-normal opacity-80">
          {" "}{formatMilesInParens(odometer, t)}
        </span>
      )}
    </>
  );

  if (reduced || light) {
    return <span className={className}>{content}</span>;
  }

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      {content}
    </motion.span>
  );
}
