import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useAdminGetStats } from "@workspace/api-client-react";
import { adminStatsQuery } from "@/lib/admin-query-options";
import {
  applyAdminRevenueMoodStyles,
  moodNeedleAngle,
  resolveAdminRevenueMood,
  revenueToClusterSpeed,
  type AdminRevenueMood,
} from "@/lib/admin-revenue-mood";
import { fmtEuro, type ExtendedStats } from "@/lib/admin-dashboard-stats";
import { cn } from "@/lib/utils";

/** Shared stats cache with Overview — visual mood only, no payment logic. */
export function useAdminRevenueMood(enabled: boolean): {
  mood: AdminRevenueMood | null;
  revenueToday: number;
  ready: boolean;
} {
  const { data: rawStats, isSuccess } = useAdminGetStats({
    query: {
      ...adminStatsQuery(),
      enabled,
    },
  });

  const revenueToday = useMemo(() => {
    const stats = rawStats as unknown as ExtendedStats | undefined;
    const n = Number(stats?.revenueToday);
    return Number.isFinite(n) ? n : 0;
  }, [rawStats]);

  const mood = useMemo(
    () => (enabled && isSuccess ? resolveAdminRevenueMood(revenueToday) : null),
    [enabled, isSuccess, revenueToday],
  );

  useEffect(() => {
    if (!enabled || !mood) {
      return applyAdminRevenueMoodStyles(null);
    }
    return applyAdminRevenueMoodStyles(mood);
  }, [enabled, mood]);

  return { mood, revenueToday, ready: enabled && isSuccess };
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg >= startDeg ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

/** Needle + speed that hunt around the target — stays near daily-revenue speed, never drops to 0. */
function useHuntingCluster(targetSpeed: number, intensity: number, reduce: boolean) {
  const [displaySpeed, setDisplaySpeed] = useState(targetSpeed);
  const [displayAngle, setDisplayAngle] = useState(() =>
    moodNeedleAngle(Math.min(1, targetSpeed / 340)),
  );
  const targetRef = useRef(targetSpeed);
  /** Smoothed center that eases toward the money-based target. */
  const centerRef = useRef(targetSpeed);

  useEffect(() => {
    targetRef.current = targetSpeed;
  }, [targetSpeed]);

  useEffect(() => {
    if (reduce) {
      centerRef.current = targetSpeed;
      setDisplaySpeed(targetSpeed);
      setDisplayAngle(moodNeedleAngle(Math.min(1, targetSpeed / 340)));
      return;
    }

    let raf = 0;
    const start = performance.now();
    // Tight band around the money speed — a few km/h, not a full sweep.
    const band = Math.max(3, Math.min(12, 4 + intensity * 7));

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const target = targetRef.current;

      // Ease the center to the new money-based speed when revenue updates.
      centerRef.current += (target - centerRef.current) * 0.1;
      const center = centerRef.current;

      if (center <= 0.5) {
        setDisplaySpeed(0);
        setDisplayAngle(moodNeedleAngle(0));
        raf = requestAnimationFrame(tick);
        return;
      }

      // Small hunt around the center — never leave [center ± band].
      const wobble =
        Math.sin(t * 1.9) * (band * 0.55)
        + Math.sin(t * 4.3 + 0.8) * (band * 0.25)
        + Math.sin(t * 0.85) * (band * 0.2);
      // Occasional nudge upward (still inside the band).
      const dig = Math.max(0, Math.sin(t * 1.05)) ** 10 * (band * 0.35);

      const lo = Math.max(0, center - band);
      const hi = Math.min(340, center + band);
      const next = Math.min(hi, Math.max(lo, center + wobble + dig));

      const rounded = Math.round(next);
      const nextAngle = moodNeedleAngle(Math.min(1, next / 340));
      setDisplaySpeed((prev) => (prev === rounded ? prev : rounded));
      setDisplayAngle((prev) => (Math.abs(prev - nextAngle) < 0.35 ? prev : nextAngle));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, intensity, targetSpeed]);

  return { displaySpeed, displayAngle };
}

/** Soft count-up when revenue changes — “money being generated”. */
function useCountingMoney(target: number, reduce: boolean) {
  const [display, setDisplay] = useState(target);
  const [generating, setGenerating] = useState(false);
  const displayRef = useRef(target);

  useEffect(() => {
    if (reduce) {
      displayRef.current = target;
      setDisplay(target);
      setGenerating(false);
      return;
    }

    const from = displayRef.current;
    if (Math.abs(from - target) < 0.005) {
      setDisplay(target);
      return;
    }

    setGenerating(true);
    let raf = 0;
    const start = performance.now();
    const duration = Math.min(2200, 700 + Math.abs(target - from) * 18);

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // Ease-out cubic + tiny jitter while climbing.
      const eased = 1 - (1 - p) ** 3;
      const jitter = p < 0.92 ? (Math.sin(now / 40) * 0.35 + Math.random() * 0.25) : 0;
      const value = from + (target - from) * eased + (target >= from ? jitter : -jitter);
      displayRef.current = value;
      setDisplay(value);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        displayRef.current = target;
        setDisplay(target);
        setGenerating(false);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);

  return { display, generating };
}

/** Desktop sports-cluster gauge — more revenue → needle climbs like a tach/speedo. */
export function AdminRevenueMoodBadge({
  mood,
  revenueToday,
  className,
}: {
  mood: AdminRevenueMood;
  revenueToday: number;
  className?: string;
}) {
  const reduce = !!useReducedMotion();
  const targetSpeed = revenueToClusterSpeed(revenueToday);
  const { displaySpeed, displayAngle } = useHuntingCluster(
    targetSpeed,
    mood.intensity,
    reduce,
  );
  const { display: moneyDisplay, generating } = useCountingMoney(revenueToday, reduce);

  const wild = mood.intensity >= 0.68;
  const redline = mood.intensity >= 0.84;

  const cx = 72;
  const cy = 68;
  const rTrack = 48;
  const rTicks = 42;

  const ticks = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    const deg = -135 + t * 270;
    const outer = polar(cx, cy, rTicks + (i % 2 === 0 ? 5 : 2.5), deg);
    const inner = polar(cx, cy, rTicks - (i % 2 === 0 ? 1.5 : 0), deg);
    return { i, outer, inner, major: i % 2 === 0 };
  });

  return (
    <div
      className={cn(
        "admin-mood-gauge",
        wild && "admin-mood-gauge--sport",
        redline && "admin-mood-gauge--redline",
        generating && "admin-mood-gauge--minting",
        className,
      )}
      style={{ ["--admin-gauge-tick" as string]: `${Math.max(0.35, 1.8 - mood.intensity * 1.4)}s` }}
      title={`Today ${fmtEuro(revenueToday)} · ${mood.title}`}
    >
      <svg
        className="admin-mood-gauge__svg"
        viewBox="0 0 144 94"
        width="144"
        height="94"
        aria-hidden
      >
        <defs>
          <linearGradient id="adminGaugeArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(152 45% 42%)" />
            <stop offset="45%" stopColor="hsl(217 80% 45%)" />
            <stop offset="72%" stopColor="hsl(32 92% 48%)" />
            <stop offset="100%" stopColor="hsl(2 78% 46%)" />
          </linearGradient>
          <filter id="adminGaugeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={arcPath(cx, cy, rTrack + 6, -135, 135)}
          fill="none"
          stroke="hsl(var(--border) / 0.7)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, rTrack, -135, 135)}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.18)"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, rTrack, -135, displayAngle)}
          fill="none"
          stroke="url(#adminGaugeArc)"
          strokeWidth="5.5"
          strokeLinecap="round"
          filter={wild ? "url(#adminGaugeGlow)" : undefined}
          className="admin-mood-gauge__live-arc"
        />

        {ticks.map(({ i, outer, inner, major }) => (
          <line
            key={i}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={major ? "hsl(var(--foreground) / 0.45)" : "hsl(var(--foreground) / 0.22)"}
            strokeWidth={major ? 1.2 : 0.85}
            strokeLinecap="round"
          />
        ))}

        <g
          className="admin-mood-gauge__needle"
          transform={`rotate(${displayAngle} ${cx} ${cy})`}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - rTrack + 8}
            stroke="hsl(var(--foreground))"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="4.2" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy={cy} r="1.9" fill="hsl(var(--background))" />
        </g>
      </svg>

      <div className="admin-mood-gauge__cluster">
        <p className="admin-mood-gauge__speed tabular-nums">{displaySpeed}</p>
        <p className="admin-mood-gauge__unit">km/h</p>
      </div>

      <div className="admin-mood-gauge__footer">
        <div className="min-w-0">
          <p className="admin-mood-gauge__title">{mood.title}</p>
          <p className="admin-mood-gauge__sub">{mood.subtitle}</p>
        </div>
        <p
          className={cn(
            "admin-mood-gauge__amount tabular-nums",
            generating && "admin-mood-gauge__amount--live",
          )}
        >
          {fmtEuro(moneyDisplay)}
        </p>
      </div>
    </div>
  );
}
