import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtEuro } from "@/lib/admin-dashboard-stats";

const DURATION_MS = 680;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Count from 0 once per replayKey. Later updates of the same key snap, no second loop. */
function useRisingNumber(target: number, replayKey: string): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const finishedKey = useRef<string | null>(prefersReducedMotion() ? replayKey : null);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    if (prefersReducedMotion()) {
      finishedKey.current = replayKey;
      setShown(targetRef.current);
      return;
    }
    if (finishedKey.current === replayKey) return;

    const start = performance.now();
    let raf = 0;
    setShown(0);
    const tick = (now: number) => {
      const goal = targetRef.current;
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(goal * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finishedKey.current = replayKey;
        setShown(goal);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [replayKey]);

  useEffect(() => {
    if (finishedKey.current !== replayKey) return;
    setShown(target);
  }, [target, replayKey]);

  return shown;
}

function formatEuroToward(current: number, finalValue: number): string {
  if (finalValue >= 1000) return `€${(current / 1000).toFixed(1)}k`;
  return fmtEuro(current);
}

export function RisingCompactEuro({ value, replayKey }: { value: number; replayKey: string }): ReactNode {
  const shown = useRisingNumber(value, replayKey);
  return formatEuroToward(shown, value);
}

export function RisingEuro({ value, replayKey }: { value: number; replayKey: string }): ReactNode {
  const shown = useRisingNumber(value, replayKey);
  return fmtEuro(shown);
}

export function RisingInteger({ value, replayKey }: { value: number; replayKey: string }): ReactNode {
  const shown = useRisingNumber(value, replayKey);
  return String(Math.round(shown));
}

export function RisingPercent({ value, replayKey }: { value: number; replayKey: string }): ReactNode {
  const shown = useRisingNumber(value, replayKey);
  return `${shown.toFixed(1)}%`;
}
