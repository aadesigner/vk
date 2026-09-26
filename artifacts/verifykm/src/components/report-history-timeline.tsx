import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { localizeProviderDate, translateKoreanProviderText, translateProviderDateInText } from "@/lib/korean-provider-text";
import { formatMilesInParens } from "@/lib/format-km-with-miles";
import { ACCIDENT_SEVERITY_I18N_KEYS, formatAccidentDescription } from "@/lib/accident-display";
import { translateMappedValue } from "@/lib/vehicle-attr-options";
import { translateDamageLabel } from "@/lib/translate-damage-label";
import {
  translateInsuranceClaimType,
  translateInsuranceClaimDescription,
  formatInsuranceAmount,
} from "@/lib/insurance-claims";
import { translateLotStatus } from "@/lib/translate-lot-status";
import { translateTitleStatus } from "@/lib/translate-title-status";
import { cleanDisplayText } from "@/lib/report-display";
import { formatLocationLabel, countryLabelsFromT } from "@/lib/format-country-name";
import { translateRegistryFieldLabel } from "@/lib/registry-history";
import type { Language } from "@/i18n/context";
import {
  TIMELINE_EVENT_TYPES,
  type TimelineEvent,
  type TimelineEventType,
  latestMileageDayKey,
  shouldShowTimelineMarkerGroup,
} from "@/lib/report-history-timeline";
import { historyDateSortKey } from "@/lib/history-sort";
import { VIN_REPORT_SECTION_SURFACE } from "@/components/vin-report-section";

const TYPE_LABEL_KEY: Record<TimelineEventType, string> = {
  production: "report_timeline_production",
  accident: "report_timeline_accident",
  insurance: "report_timeline_insurance",
  mileage: "report_timeline_mileage",
  service: "report_timeline_service",
  auction: "report_timeline_auction",
  owner: "report_timeline_owner",
  registry: "report_timeline_registry",
};

const TYPE_DOT: Record<TimelineEventType, string> = {
  production: "bg-slate-500 dark:bg-slate-300",
  accident: "bg-red-500",
  insurance: "bg-amber-500",
  mileage: "bg-primary",
  service: "bg-[#00a5fd]",
  auction: "bg-violet-500",
  owner: "bg-sky-500",
  registry: "bg-teal-500",
};

function defaultEnabledTypes(present: TimelineEventType[]): Set<TimelineEventType> {
  return new Set(present);
}

const VIEW_W = 1000;
const VIEW_H = 240;
/** Tight plot inset — left room for in-chart mileage labels. */
const PAD = { l: 48, r: 20, t: 26, b: 18 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_FACTOR = 1.25;
const DOUBLE_TAP_ZOOM = 2;

type ChartZoom = { scale: number; x: number; y: number };

function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

function clampPan(x: number, y: number, scale: number, vw: number, vh: number): { x: number; y: number } {
  const cw = vw * scale;
  const ch = vh * scale;
  if (cw <= vw) x = (vw - cw) / 2;
  else x = Math.min(0, Math.max(vw - cw, x));
  if (ch <= vh) y = (vh - ch) / 2;
  else y = Math.min(0, Math.max(vh - ch, y));
  return { x, y };
}

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function touchMidpoint(a: Touch, b: Touch): { x: number; y: number } {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

/**
 * @param bindKey – change when the viewport DOM node swaps (e.g. fullscreen open/close)
 *   so wheel/pan listeners re-attach to the visible chart. React refs alone do not
 *   re-run this effect when the element they point at changes.
 */
function useChartZoom(enabled: boolean, bindKey: string | number | boolean = 0) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ChartZoom>({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    contentX: number;
    contentY: number;
  } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const panActiveRef = useRef(false);
  const lastTapRef = useRef(0);
  const [zoom, setZoom] = useState<ChartZoom>({ scale: 1, x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);

  const paintTransform = useCallback((next: ChartZoom) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
    el.style.transition = "none";
  }, []);

  const resetZoom = useCallback(() => {
    const next = { scale: 1, x: 0, y: 0 };
    zoomRef.current = next;
    setZoom(next);
    paintTransform(next);
  }, [paintTransform]);

  useEffect(() => {
    if (!enabled) resetZoom();
  }, [enabled, resetZoom]);

  const applyZoom = useCallback((next: ChartZoom, origin?: { x: number; y: number }, opts?: { silent?: boolean }) => {
    const viewport = viewportRef.current;
    const vw = viewport?.clientWidth ?? 0;
    const vh = viewport?.clientHeight ?? 0;
    const scale = clampZoom(next.scale);
    let x = next.x;
    let y = next.y;
    if (origin && vw > 0) {
      const current = zoomRef.current;
      const cx = (origin.x - current.x) / current.scale;
      const cy = (origin.y - current.y) / current.scale;
      x = origin.x - cx * scale;
      y = origin.y - cy * scale;
    }
    const clamped = scale <= 1.001
      ? { scale: 1, x: 0, y: 0 }
      : { scale, ...clampPan(x, y, scale, vw, vh) };
    zoomRef.current = clamped;
    paintTransform(clamped);
    if (!opts?.silent) setZoom(clamped);
  }, [paintTransform]);

  const zoomAtCenter = useCallback((factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      applyZoom({ ...zoomRef.current, scale: zoomRef.current.scale * factor });
      return;
    }
    const rect = viewport.getBoundingClientRect();
    applyZoom(
      { ...zoomRef.current, scale: zoomRef.current.scale * factor },
      { x: rect.width / 2, y: rect.height / 2 },
    );
  }, [applyZoom]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let detach: (() => void) | null = null;
    let raf = 0;

    const attach = () => {
      const viewport = viewportRef.current;
      if (!viewport) return false;

      // Viewport size changes when entering/leaving fullscreen — reclamp pan so
      // the chart stays movable within the new bounds.
      const z = zoomRef.current;
      if (z.scale > 1.001) {
        applyZoom(z);
      }

      const localPoint = (clientX: number, clientY: number) => {
        const rect = viewport.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const isMarkerControl = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return false;
        return Boolean(
          target.closest("button")
          || target.closest("[data-timeline-marker]")
          || target.closest("[data-radix-popper-content-wrapper]"),
        );
      };

      const onWheel = (e: WheelEvent) => {
        const zoomingIn = e.deltaY < 0;
        const scale = zoomRef.current.scale;
        if ((zoomingIn && scale >= MAX_ZOOM - 0.001) || (!zoomingIn && scale <= MIN_ZOOM + 0.001)) {
          return;
        }
        e.preventDefault();
        const factor = zoomingIn ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        applyZoom(
          { ...zoomRef.current, scale: zoomRef.current.scale * factor },
          localPoint(e.clientX, e.clientY),
        );
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        if (e.button !== 0 || zoomRef.current.scale <= 1.02) return;
        if (isMarkerControl(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        panRef.current = {
          x: e.clientX,
          y: e.clientY,
          tx: zoomRef.current.x,
          ty: zoomRef.current.y,
        };
        panActiveRef.current = false;
        setGesturing(true);
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        if (!panRef.current || zoomRef.current.scale <= 1.02) return;
        const dx = e.clientX - panRef.current.x;
        const dy = e.clientY - panRef.current.y;
        if (!panActiveRef.current && Math.hypot(dx, dy) < 4) return;
        e.preventDefault();
        panActiveRef.current = true;
        // Silent: paint via DOM during drag; commit React state on pointerup
        applyZoom(
          {
            scale: zoomRef.current.scale,
            x: panRef.current.tx + dx,
            y: panRef.current.ty + dy,
          },
          undefined,
          { silent: true },
        );
      };

      const endPointerPan = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        if (!panRef.current) return;
        panRef.current = null;
        panActiveRef.current = false;
        setGesturing(false);
        // Commit final position to React state
        setZoom({ ...zoomRef.current });
        if (viewport.hasPointerCapture?.(e.pointerId)) {
          try {
            viewport.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
      };

      const onTouchStart = (e: TouchEvent) => {
        if (isMarkerControl(e.target)) return;

        if (e.touches.length === 2) {
          const a = e.touches[0]!;
          const b = e.touches[1]!;
          const mid = localPoint(touchMidpoint(a, b).x, touchMidpoint(a, b).y);
          const zNow = zoomRef.current;
          const dist = touchDistance(a, b);
          if (dist < 1) return;
          pinchRef.current = {
            distance: dist,
            scale: zNow.scale,
            contentX: (mid.x - zNow.x) / zNow.scale,
            contentY: (mid.y - zNow.y) / zNow.scale,
          };
          panRef.current = null;
          setGesturing(true);
          return;
        }

        if (e.touches.length === 1 && zoomRef.current.scale > 1.02) {
          const t = e.touches[0]!;
          panRef.current = {
            x: t.clientX,
            y: t.clientY,
            tx: zoomRef.current.x,
            ty: zoomRef.current.y,
          };
          panActiveRef.current = false;
          setGesturing(true);
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && pinchRef.current) {
          e.preventDefault();
          const a = e.touches[0]!;
          const b = e.touches[1]!;
          const mid = localPoint(touchMidpoint(a, b).x, touchMidpoint(a, b).y);
          const dist = touchDistance(a, b);
          const p = pinchRef.current;
          const scale = clampZoom(p.scale * (dist / p.distance));
          applyZoom(
            {
              scale,
              x: mid.x - p.contentX * scale,
              y: mid.y - p.contentY * scale,
            },
            undefined,
            { silent: true },
          );
          return;
        }

        if (e.touches.length === 1 && panRef.current && zoomRef.current.scale > 1.02) {
          const t = e.touches[0]!;
          const dx = t.clientX - panRef.current.x;
          const dy = t.clientY - panRef.current.y;
          if (!panActiveRef.current && Math.hypot(dx, dy) < 6) return;
          e.preventDefault();
          panActiveRef.current = true;
          applyZoom(
            {
              scale: zoomRef.current.scale,
              x: panRef.current.tx + dx,
              y: panRef.current.ty + dy,
            },
            undefined,
            { silent: true },
          );
        }
      };

      const onTouchEnd = (e: TouchEvent) => {
        const didPan = panActiveRef.current;
        const tappedMarker = isMarkerControl(e.target);
        const wasPinching = pinchRef.current != null;
        pinchRef.current = null;
        panRef.current = null;
        panActiveRef.current = false;
        setGesturing(false);
        setZoom({ ...zoomRef.current });

        if (e.touches.length > 0 || didPan || tappedMarker || wasPinching) return;
        const now = Date.now();
        if (now - lastTapRef.current < 320) {
          if (zoomRef.current.scale > 1.05) resetZoom();
          else {
            const t = e.changedTouches[0];
            if (t) {
              const pt = localPoint(t.clientX, t.clientY);
              applyZoom(
                { ...zoomRef.current, scale: DOUBLE_TAP_ZOOM },
                pt,
              );
            }
          }
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      };

      viewport.addEventListener("wheel", onWheel, { passive: false });
      viewport.addEventListener("touchstart", onTouchStart, { passive: true });
      viewport.addEventListener("touchmove", onTouchMove, { passive: false });
      viewport.addEventListener("touchend", onTouchEnd, { passive: true });
      viewport.addEventListener("pointerdown", onPointerDown);
      // Listen on window so drag keeps working if the cursor leaves the chart
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endPointerPan);
      window.addEventListener("pointercancel", endPointerPan);

      detach = () => {
        viewport.removeEventListener("wheel", onWheel);
        viewport.removeEventListener("touchstart", onTouchStart);
        viewport.removeEventListener("touchmove", onTouchMove);
        viewport.removeEventListener("touchend", onTouchEnd);
        viewport.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", endPointerPan);
        window.removeEventListener("pointercancel", endPointerPan);
      };
      return true;
    };

    if (!attach()) {
      raf = requestAnimationFrame(() => {
        if (!cancelled) attach();
      });
    }

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      detach?.();
    };
  }, [enabled, applyZoom, resetZoom, bindKey]);

  return {
    viewportRef,
    contentRef,
    zoom,
    gesturing,
    zoomAtCenter,
    resetZoom,
    zoomed: zoom.scale > 1.02,
  };
}

function ChartZoomControls({
  t,
  zoom,
  zoomed,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  t: (key: string) => string;
  zoom: ChartZoom;
  zoomed: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-background p-0.5 shadow-sm">
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
        aria-label={t("report_timeline_zoom_out")}
        disabled={zoom.scale <= MIN_ZOOM}
        onClick={onZoomOut}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[2.25rem] px-0.5 text-center text-[10px] font-semibold tabular-nums text-foreground/70">
        {`${Number.isInteger(zoom.scale) ? zoom.scale.toFixed(0) : zoom.scale.toFixed(1)}×`}
      </span>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
        aria-label={t("report_timeline_zoom_in")}
        disabled={zoom.scale >= MAX_ZOOM}
        onClick={onZoomIn}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35"
        aria-label={t("report_timeline_zoom_reset")}
        disabled={!zoomed}
        onClick={onReset}
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}

function pickYears(startYear: number, endYear: number, maxTicks: number): number[] {
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) return [];
  if (endYear === startYear) return [startYear];
  const span = endYear - startYear;
  const count = Math.min(Math.max(2, maxTicks), span + 1);
  const years: number[] = [];
  for (let i = 0; i < count; i++) {
    years.push(Math.round(startYear + (i / (count - 1)) * span));
  }
  return [...new Set(years)];
}

type Props = {
  events: TimelineEvent[];
  t: (key: string) => string;
  language: Language;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  krwPerUsd?: number | null;
  className?: string;
};

type MileagePoint = { sortKey: number; km: number };

function formatKmAxis(km: number): string {
  if (km <= 0) return "0 km";
  if (km >= 1_000_000) {
    const m = km / 1_000_000;
    const value = Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
    return `${value} km`;
  }
  // Only use "Nk" when the value is an exact thousand — never invent a higher ceiling.
  if (km >= 1000 && km % 1000 === 0) return `${km / 1000}k km`;
  if (km >= 1000) return `${Math.round(km).toLocaleString()} km`;
  return `${Math.round(km)} km`;
}

/** Keep axis labels inside the column (avoid top/bottom crop from -50% translate). */
function yAxisLabelStyle(topPct: number, index: number, total: number): CSSProperties {
  if (index === total - 1) {
    // max km — top of chart
    return { top: `${Math.max(topPct, 0)}%`, transform: "translateY(0)" };
  }
  if (index === 0) {
    // 0 km — baseline
    return { top: `${Math.min(topPct, 100)}%`, transform: "translateY(-100%)" };
  }
  return { top: `${topPct}%`, transform: "translateY(-50%)" };
}

function xOf(sortKey: number, min: number, span: number): number {
  if (span <= 0) return (PAD.l + VIEW_W - PAD.r) / 2;
  return PAD.l + ((sortKey - min) / span) * (VIEW_W - PAD.l - PAD.r);
}

function yOf(km: number, maxKm: number): number {
  const t = maxKm <= 0 ? 0 : Math.min(1, Math.max(0, km / maxKm));
  return PAD.t + (1 - t) * (VIEW_H - PAD.t - PAD.b);
}

/** Straight segments between mileage points. */
function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function interpolateKm(sortKey: number, series: MileagePoint[]): number {
  if (series.length === 0) return 0;
  if (sortKey <= series[0]!.sortKey) return series[0]!.km;
  const last = series[series.length - 1]!;
  if (sortKey >= last.sortKey) return last.km;
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i]!;
    const b = series[i + 1]!;
    if (sortKey >= a.sortKey && sortKey <= b.sortKey) {
      const s = b.sortKey - a.sortKey;
      if (s <= 0) return b.km;
      return a.km + ((sortKey - a.sortKey) / s) * (b.km - a.km);
    }
  }
  return last.km;
}

function buildMileageSeries(events: TimelineEvent[]): MileagePoint[] {
  const points: MileagePoint[] = [];
  for (const event of events) {
    if (event.type === "production") {
      points.push({ sortKey: event.sortKey, km: 0 });
      continue;
    }
    if (event.mileage != null && event.mileage > 0) {
      points.push({ sortKey: event.sortKey, km: event.mileage });
    }
  }
  points.sort((a, b) => a.sortKey - b.sortKey || a.km - b.km);
  const out: MileagePoint[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && prev.sortKey === p.sortKey) {
      prev.km = p.km;
      continue;
    }
    out.push({ ...p });
  }
  return out;
}

const MARKER_TYPE_ORDER: TimelineEventType[] = [
  "accident",
  "insurance",
  "auction",
  "mileage",
  "service",
  "owner",
  "registry",
  "production",
];

function clusterTimelineEvents(events: TimelineEvent[]): TimelineEvent[][] {
  const grouped = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.dayKey);
    if (list) list.push(event);
    else grouped.set(event.dayKey, [event]);
  }
  return [...grouped.values()].map((group) =>
    [...group].sort(
      (a, b) =>
        MARKER_TYPE_ORDER.indexOf(a.type) - MARKER_TYPE_ORDER.indexOf(b.type) ||
        a.id.localeCompare(b.id),
    ),
  );
}

/**
 * Pull visually close dates into one bubble at default zoom.
 * Zooming in drops the threshold quickly so different days separate when there is space.
 */
const PROXIMITY_X_THRESHOLD = 14;

type PlotMarker = {
  id: string;
  events: TimelineEvent[];
  leftPct: number;
  topPct: number;
  x: number;
  y: number;
};

function mergeMarkersByProximity(markers: PlotMarker[], zoomScale: number): PlotMarker[] {
  if (markers.length <= 1) return markers;
  // Quadratic falloff — by ~1.5–2× nearby dates already split if there is room.
  const threshold = PROXIMITY_X_THRESHOLD / Math.pow(Math.max(zoomScale, 1), 2);
  const sorted = [...markers].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
  const groups: PlotMarker[][] = [[sorted[0]!]];

  for (let i = 1; i < sorted.length; i++) {
    const marker = sorted[i]!;
    const group = groups[groups.length - 1]!;
    const first = group[0]!;
    const prev = group[group.length - 1]!;
    // Near the previous point AND within the cluster window — avoids chaining a long run of days.
    const nearPrev = marker.x - prev.x < threshold;
    const withinSpan = marker.x - first.x < threshold;
    if (nearPrev && withinSpan) group.push(marker);
    else groups.push([marker]);
  }

  return groups.map((group) => {
    if (group.length === 1) return group[0]!;

    const events = group
      .flatMap((g) => g.events)
      .sort(
        (a, b) =>
          a.sortKey - b.sortKey ||
          MARKER_TYPE_ORDER.indexOf(a.type) - MARKER_TYPE_ORDER.indexOf(b.type) ||
          a.id.localeCompare(b.id),
      );
    const x = group.reduce((sum, g) => sum + g.x, 0) / group.length;
    const y = group.reduce((sum, g) => sum + g.y, 0) / group.length;
    return {
      id: group
        .map((g) => g.id)
        .sort()
        .join("~"),
      events,
      x,
      y,
      leftPct: (x / VIEW_W) * 100,
      topPct: (y / VIEW_H) * 100,
    };
  });
}

function clusterTypes(events: TimelineEvent[]): TimelineEventType[] {
  const seen = new Set<TimelineEventType>();
  const types: TimelineEventType[] = [];
  for (const type of MARKER_TYPE_ORDER) {
    if (events.some((e) => e.type === type) && !seen.has(type)) {
      seen.add(type);
      types.push(type);
    }
  }
  for (const event of events) {
    if (!seen.has(event.type)) {
      seen.add(event.type);
      types.push(event.type);
    }
  }
  return types;
}

/** Only known claim-type slugs (e.g. insurance_third_party_own_damage). */
function translateKnownClaimType(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const claimLabel = translateInsuranceClaimType(t, raw);
  if (claimLabel && claimLabel !== raw.replace(/_/g, " ")) return claimLabel;
  return null;
}

/** Only known lot/condition slugs (e.g. run_and_drives). */
function translateKnownLotToken(
  t: (key: string) => string,
  value: string | null | undefined,
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const translated = translateLotStatus(t, raw);
  if (!translated) return null;
  const fallback = raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (translated !== fallback && translated !== raw) return translated;
  return null;
}

function humanizeLeftoverSlug(value: string): string {
  const trimmed = value.trim();
  if (!/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatKmFact(km: number, t: (key: string) => string): string {
  return `${km.toLocaleString()} km ${formatMilesInParens(km, t)}`.trim();
}

const ACCIDENT_SEVERITY_TIERS = new Set([
  "minor", "light", "moderate", "major", "severe", "total_loss", "unknown",
]);

function factDedupeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^:]+:\s*/, "") // strip "Primary Damage:" / similar labels
    .replace(/[^a-z0-9]+/g, "");
}

function pushUniqueFact(facts: string[], value: string | null | undefined): void {
  const raw = value?.trim();
  if (!raw) return;
  const key = factDedupeKey(raw);
  if (!key) return;
  if (facts.some((f) => {
    const existing = factDedupeKey(f);
    return existing === key || existing.includes(key) || key.includes(existing);
  })) {
    return;
  }
  facts.push(raw);
}

function formatDamageFacts(
  event: Pick<TimelineEvent, "damage" | "primaryDamage" | "secondaryDamage">,
  t: (key: string) => string,
): string[] {
  const facts: string[] = [];
  const translateParts = (raw: string | null | undefined): string[] =>
    (raw ?? "")
      .split(/[;,]/)
      .map((part) => translateDamageLabel(t, part.trim()))
      .filter((part): part is string => Boolean(part));

  const primaryRaw = event.primaryDamage?.trim();
  const secondaryRaw = event.secondaryDamage?.trim();

  if (primaryRaw && /[;,]/.test(primaryRaw)) {
    const parts = translateParts(primaryRaw);
    if (parts.length) facts.push(`${t("damage_location")}: ${parts.join(" · ")}`);
    return facts;
  }

  const primary = translateDamageLabel(t, primaryRaw);
  const secondary = translateDamageLabel(t, secondaryRaw);
  if (primary) facts.push(`${t("primary_damage")}: ${primary}`);
  if (secondary) facts.push(`${t("secondary_damage")}: ${secondary}`);

  if (!primary && !secondary && event.damage) {
    const parts = translateParts(event.damage);
    if (parts.length === 1) facts.push(`${t("damage_location")}: ${parts[0]}`);
    else if (parts.length > 1) facts.push(`${t("damage_location")}: ${parts.join(" · ")}`);
  }

  return facts;
}

function clusterRecordedKm(events: TimelineEvent[]): number {
  return Math.max(0, ...events.map((e) => (e.mileage != null && e.mileage > 0 ? e.mileage : 0)));
}

function localizeTimelineText(
  t: (key: string) => string,
  language: Language,
  value: string | null | undefined,
): string | null {
  const raw = cleanDisplayText(value);
  if (!raw) return null;
  const claim = translateKnownClaimType(t, raw);
  if (claim) return claim;
  const lot = translateKnownLotToken(t, raw);
  if (lot) return lot;
  const withCosts = translateInsuranceClaimDescription(t, raw) ?? raw;
  const withPhrases = translateKoreanProviderText(t, withCosts) ?? withCosts;
  const withDates = translateProviderDateInText(withPhrases, language) ?? withPhrases;
  const withTitle = translateTitleStatus(t, withDates);
  return humanizeLeftoverSlug(withTitle || withDates);
}

function eventFacts(
  event: TimelineEvent,
  t: (key: string) => string,
  language: Language,
  vehicleCountry?: string | null,
  krwPerUsd?: number | null,
): string[] {
  // Insurance claims: section title is enough — popup shows total payout only (no parts/labor/paint).
  if (event.type === "insurance") {
    if (event.lossAmount != null && event.lossAmount > 0) {
      return [
        formatInsuranceAmount(event.lossAmount, vehicleCountry, krwPerUsd, {
          currency: event.currency,
          hasKoreanInsuranceClaims: true,
        }),
      ];
    }
    return [];
  }

  const facts: string[] = [];
  if (event.mileage != null && event.mileage > 0) {
    pushUniqueFact(
      facts,
      `${event.mileage.toLocaleString()} km ${formatMilesInParens(event.mileage, t)}`.trim(),
    );
  }

  if (event.type === "accident") {
    // Only real severity tiers — skip GCA "primary"/"secondary" category leftovers.
    if (event.severity) {
      const sevKey = event.severity.toLowerCase().trim().replace(/\s+/g, "_");
      if (ACCIDENT_SEVERITY_TIERS.has(sevKey)) {
        const sev = translateMappedValue(event.severity, ACCIDENT_SEVERITY_I18N_KEYS, t) ?? event.severity;
        pushUniqueFact(facts, sev);
      }
    }
    for (const d of formatDamageFacts(event, t)) pushUniqueFact(facts, d);
    if (event.lossAmount != null && event.lossAmount > 0) {
      pushUniqueFact(
        facts,
        formatInsuranceAmount(event.lossAmount, vehicleCountry, krwPerUsd, {
          currency: event.currency,
          accidentType: event.accidentType,
          accidentCountry: event.accidentCountry,
          hasKoreanInsuranceClaims: false,
        }),
      );
    }
    if (event.description) {
      const desc = formatAccidentDescription(t, language, event.description);
      // Skip generic "Accident" / damage text already covered by Primary Damage.
      if (
        desc
        && !/^accident$/i.test(desc.trim())
        && !/^primary|secondary$/i.test(desc.trim())
      ) {
        pushUniqueFact(facts, desc);
      }
    }
    return facts.slice(0, 6);
  }

  if (event.severity) {
    const sev = translateMappedValue(event.severity, ACCIDENT_SEVERITY_I18N_KEYS, t) ?? event.severity;
    pushUniqueFact(facts, sev);
  }
  if (event.title) {
    pushUniqueFact(facts, localizeTimelineText(t, language, event.title));
  }
  if (event.subtitle) {
    pushUniqueFact(facts, localizeTimelineText(t, language, event.subtitle));
  }
  if (event.type === "registry" && event.details?.length) {
    for (const row of event.details.slice(0, 5)) {
      const label = translateRegistryFieldLabel(t, row.label);
      const value = localizeTimelineText(t, language, row.value);
      pushUniqueFact(facts, `${label}: ${value}`);
    }
  }
  if (event.location) {
    const loc = formatLocationLabel(event.location, language, countryLabelsFromT(t))
      || localizeTimelineText(t, language, event.location);
    pushUniqueFact(facts, loc);
  }
  if (event.condition) {
    const cond = translateLotStatus(t, event.condition)
      ?? localizeTimelineText(t, language, event.condition);
    pushUniqueFact(facts, cond);
  }
  for (const d of formatDamageFacts(event, t)) pushUniqueFact(facts, d);
  if (event.lotStatus) {
    const lot = translateLotStatus(t, event.lotStatus)
      ?? localizeTimelineText(t, language, event.lotStatus);
    pushUniqueFact(facts, lot);
  }
  if (event.lossAmount != null && event.lossAmount > 0) {
    pushUniqueFact(
      facts,
      formatInsuranceAmount(event.lossAmount, vehicleCountry, krwPerUsd, {
        currency: event.currency,
        accidentType: event.accidentType,
        accidentCountry: event.accidentCountry,
        hasKoreanInsuranceClaims: false,
      }),
    );
  }
  const price = event.finalPrice ?? event.auctionPrice;
  if (price != null && price > 0) {
    pushUniqueFact(facts, `$${price.toLocaleString()}`);
  }
  if (event.description) {
    pushUniqueFact(facts, localizeTimelineText(t, language, event.description));
  }
  return facts
    .map((fact) => translateInsuranceClaimDescription(t, fact) ?? fact)
    .map(humanizeLeftoverSlug)
    .filter(Boolean)
    .slice(0, 6);
}

function TimelineMarker({
  events,
  leftPct,
  topPct,
  t,
  language,
  vehicleYear,
  vehicleCountry,
  krwPerUsd,
  interactive,
  zoomScale = 1,
}: {
  events: TimelineEvent[];
  leftPct: number;
  topPct: number;
  t: (key: string) => string;
  language: Language;
  vehicleYear?: number | null;
  vehicleCountry?: string | null;
  krwPerUsd?: number | null;
  interactive: boolean;
  zoomScale?: number;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primary = events[0];
  if (!primary) return null;

  const openNow = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  const closeSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  const dayGroups = (() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const list = map.get(event.dayKey);
      if (list) list.push(event);
      else map.set(event.dayKey, [event]);
    }
    return [...map.entries()]
      .map(([dayKey, dayEvents]) => ({
        dayKey,
        events: dayEvents,
        sortKey: Math.min(...dayEvents.map((e) => e.sortKey)),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  })();

  const types = clusterTypes(events);
  const multiDay = dayGroups.length > 1;
  const clustered = multiDay || types.length > 1;
  const bubbleCount = multiDay ? dayGroups.length : types.length;
  const recordedKm = clusterRecordedKm(events);
  const markerType = types[0] ?? primary.type;

  const formatDayLabel = (dayEvents: TimelineEvent[]) => {
    const lead = dayEvents[0]!;
    if (lead.type === "production" && lead.productionYear) return String(lead.productionYear);
    return localizeProviderDate(lead.date, language, vehicleYear, vehicleCountry) ?? lead.dayKey;
  };

  const resolveMileageTitle = (dayEvents: TimelineEvent[]): string | null => {
    for (const event of dayEvents) {
      if (event.type !== "mileage") continue;
      const raw = event.titleStatus?.trim() || event.title?.trim();
      if (!raw) continue;
      return translateTitleStatus(t, raw) ?? raw;
    }
    return null;
  };

  const dateLabel = multiDay
    ? t("registry_events_count").replace("{count}", String(dayGroups.length))
    : formatDayLabel(dayGroups[0]?.events ?? events);

  const mileageTitleLabel = multiDay ? null : resolveMileageTitle(events);
  const headline =
    mileageTitleLabel
    || (!multiDay && !clustered ? t(TYPE_LABEL_KEY[markerType]) : null)
    || (!multiDay && types.length === 1 ? t(TYPE_LABEL_KEY[types[0]!]) : null);

  const kmShort = recordedKm > 0 ? `${recordedKm.toLocaleString()} km` : null;
  const typeLabels = types.map((type) => t(TYPE_LABEL_KEY[type]));

  const buildSections = (dayEvents: TimelineEvent[], hideMileageType: boolean) => {
    const dayTypes = clusterTypes(dayEvents);
    const seenFacts = new Set<string>();
    const dayKm = clusterRecordedKm(dayEvents);
    const dayKmFact = dayKm > 0 ? formatKmFact(dayKm, t) : null;
    const dayTitle = resolveMileageTitle(dayEvents);
    return dayTypes.flatMap((type) => {
      if (hideMileageType && type === "mileage") return [];
      const group = dayEvents.filter((e) => e.type === type);
      let facts = [...new Set(group.flatMap((e) => eventFacts(e, t, language, vehicleCountry, krwPerUsd)))];
      if (dayKmFact) facts = facts.filter((fact) => fact !== dayKmFact);
      if (dayKm > 0) {
        const prefix = `${dayKm.toLocaleString()} km`;
        facts = facts.filter((fact) => fact !== prefix && !fact.startsWith(`${prefix} `));
      }
      if (dayTitle) facts = facts.filter((fact) => fact !== dayTitle);
      if (type !== "owner") {
        facts = facts.filter((fact) => {
          if (seenFacts.has(fact)) return false;
          seenFacts.add(fact);
          return true;
        });
      }
      facts = facts.slice(0, 5);
      if (hideMileageType && facts.length === 0) return [];
      return [{ type, label: t(TYPE_LABEL_KEY[type]), facts }];
    });
  };

  const singleDaySections = !multiDay ? buildSections(events, false) : [];
  const showSectionLabels = multiDay || singleDaySections.length > 1;
  const bodySections = !multiDay
    ? singleDaySections
        .map((section) => {
          if (section.type === "mileage" && mileageTitleLabel) {
            return {
              ...section,
              facts: section.facts.filter((fact) => fact !== mileageTitleLabel),
            };
          }
          return section;
        })
        .filter((section) => section.facts.length > 0 || (showSectionLabels && section.type !== "mileage"))
    : [];

  const accident = !clustered && types.includes("accident");
  const inverse = 1 / Math.max(zoomScale, 0.01);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-timeline-marker=""
          aria-label={[headline, dateLabel, kmShort].filter(Boolean).join(", ")}
          className={cn(
            "absolute z-[2] group flex h-12 w-12 items-center justify-center rounded-full sm:h-11 sm:w-11",
            "touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-1",
            open && "z-[6]",
            !interactive && "pointer-events-none",
          )}
          style={{
            left: `${leftPct}%`,
            top: `${topPct}%`,
            transform: `translate(-50%, -50%) scale(${inverse})`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            openNow();
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") openNow();
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") closeSoon();
          }}
        >
          <span
            className={cn(
              "relative flex items-center justify-center rounded-full",
              "ring-[2.5px] ring-background shadow-md shadow-black/10",
              "transition-transform duration-150",
              open ? "scale-110" : "group-hover:scale-105",
              clustered
                ? "h-5 w-5 sm:h-6 sm:w-6 bg-primary"
                : accident
                  ? "h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]"
                  : markerType === "production"
                    ? "h-2.5 w-2.5 sm:h-3 sm:w-3 bg-slate-400 dark:bg-slate-300"
                    : "h-3 w-3 sm:h-3.5 sm:w-3.5",
              !clustered && markerType !== "production" && TYPE_DOT[markerType],
            )}
          >
            {clustered ? (
              <span className="text-[9px] font-bold leading-none tabular-nums text-primary-foreground sm:text-[10px]">
                {bubbleCount}
              </span>
            ) : null}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={12}
        collisionPadding={16}
        className={cn(
          /* Above timeline fullscreen overlay (z-[100]) and site chrome */
          "z-[120] w-[min(17.5rem,calc(100vw-1.5rem))] max-h-[min(20rem,70vh)] overflow-y-auto",
          "rounded-2xl border border-border/60 bg-background p-0 shadow-xl shadow-black/10",
        )}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") openNow();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") closeSoon();
        }}
      >
        {/* Header */}
        <div className="px-3.5 pt-3.5 pb-3">
          {headline ? (
            <div className="flex items-start gap-2">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TYPE_DOT[markerType])} />
              <p className="text-sm font-semibold leading-snug text-foreground">{headline}</p>
            </div>
          ) : clustered ? (
            <p className="text-sm font-semibold leading-snug text-foreground">
              {typeLabels.join(" · ")}
            </p>
          ) : (
            <div className="flex items-start gap-2">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TYPE_DOT[markerType])} />
              <p className="text-sm font-semibold leading-snug text-foreground">
                {t(TYPE_LABEL_KEY[markerType])}
              </p>
            </div>
          )}
          <div
            className={cn(
              "mt-2",
              (headline || !clustered) && "pl-4",
            )}
          >
            <span className="inline-flex items-center rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background">
              {[dateLabel, !multiDay ? kmShort : null].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>

        {multiDay ? (
          <div className="border-t border-border/50">
            {dayGroups.map((day) => {
              const sections = buildSections(day.events, true)
                .map((section) => {
                  const dayTitle = resolveMileageTitle(day.events);
                  if (section.type === "mileage" && dayTitle) {
                    return { ...section, facts: section.facts.filter((fact) => fact !== dayTitle) };
                  }
                  return section;
                })
                .filter((section) => section.facts.length > 0 || section.type !== "mileage");
              const dayKm = clusterRecordedKm(day.events);
              const dayKmShort = dayKm > 0 ? `${dayKm.toLocaleString()} km` : null;
              return (
                <div
                  key={day.dayKey}
                  className="border-b border-border/40 px-3.5 py-3 last:border-b-0"
                >
                  <span className="inline-flex items-center rounded-md bg-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background">
                    {[formatDayLabel(day.events), dayKmShort].filter(Boolean).join(" · ")}
                  </span>
                  <div className="mt-2 space-y-2.5">
                    {sections.map((section) => (
                      <div key={`${day.dayKey}-${section.type}`}>
                        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                          <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[section.type])} />
                          {section.label}
                        </p>
                        {section.facts.length > 0 ? (
                          <ul className="mt-1 space-y-1 pl-0.5">
                            {section.facts.map((fact) => (
                              <li key={fact} className="flex gap-2 text-[12px] leading-snug text-muted-foreground">
                                <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-foreground/25" />
                                <span>{fact}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : bodySections.length > 0 ? (
          <div className="border-t border-border/50 px-3.5 py-3 space-y-2.5">
            {bodySections.map((section) => (
              <div key={section.type}>
                {showSectionLabels ? (
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
                    <span className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[section.type])} />
                    {section.label}
                  </p>
                ) : null}
                {section.facts.length > 0 ? (
                  <ul className={cn("space-y-1", showSectionLabels && "pl-0.5")}>
                    {section.facts.map((fact) => (
                      <li key={fact} className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground">
                        <span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-foreground/25" />
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function ReportHistoryTimeline({
  events,
  t,
  language,
  vehicleYear,
  vehicleCountry,
  krwPerUsd,
  className,
}: Props) {
  const fillId = useId().replace(/:/g, "");
  const fullscreenFillId = useId().replace(/:/g, "");
  const [fullscreen, setFullscreen] = useState(false);
  // bindKey remounts pan/wheel listeners onto whichever chart is visible
  const chartZoom = useChartZoom(true, fullscreen ? "fs" : "inline");
  const { resetZoom, ...chartZoomUi } = chartZoom;

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const presentTypes = useMemo(
    () =>
      TIMELINE_EVENT_TYPES.filter(
        (type) => type !== "mileage" && type !== "production" && events.some((e) => e.type === type),
      ),
    [events],
  );

  /** null = use lean defaults derived from presentTypes */
  const [enabledOverride, setEnabledOverride] = useState<Set<TimelineEventType> | null>(null);

  useEffect(() => {
    setEnabledOverride(null);
  }, [events]);

  const enabledTypes = useMemo(
    () => enabledOverride ?? defaultEnabledTypes(presentTypes),
    [enabledOverride, presentTypes],
  );

  const toggleType = useCallback(
    (type: TimelineEventType) => {
      setEnabledOverride((prev) => {
        const next = new Set(prev ?? defaultEnabledTypes(presentTypes));
        if (next.has(type)) {
          if (next.size <= 1) return next;
          next.delete(type);
        } else {
          next.add(type);
        }
        return next;
      });
    },
    [presentTypes],
  );

  const layout = useMemo(() => {
    if (events.length === 0) return null;
    const min = events[0]!.sortKey;
    const max = events[events.length - 1]!.sortKey;
    const span = Math.max(0, max - min);
    const series = buildMileageSeries(events);
    const maxKm = Math.max(0, ...series.map((p) => p.km), ...events.map((e) => e.mileage ?? 0));
    const axisMax = maxKm > 0 ? maxKm : 1;

    const startYear = Number(events[0]!.dayKey.slice(0, 4));
    const endYear = Number(events[events.length - 1]!.dayKey.slice(0, 4));
    const years = pickYears(startYear, endYear, 5).map((year) => ({
      year,
      leftPct: (xOf(historyDateSortKey(`${year}-01-01`), min, span) / VIEW_W) * 100,
    }));

    const yTicks = [0, axisMax / 2, axisMax].map((km) => ({
      km,
      topPct: (yOf(km, axisMax) / VIEW_H) * 100,
    }));
    const baselineY = yOf(0, axisMax);

    const linePts = series.map((p) => ({
      x: xOf(p.sortKey, min, span),
      y: yOf(p.km, axisMax),
      km: p.km,
    }));

    const lineD = smoothLinePath(linePts);
    const areaD =
      linePts.length >= 2
        ? `${lineD} L ${linePts[linePts.length - 1]!.x.toFixed(1)} ${baselineY} L ${linePts[0]!.x.toFixed(1)} ${baselineY} Z`
        : "";

    const latestMileageDay = latestMileageDayKey(events);
    const markers: PlotMarker[] = clusterTimelineEvents(events)
      .filter((group) => shouldShowTimelineMarkerGroup(group, { latestMileageDay }))
      .map((group) => {
        const lead = group[0]!;
        const km =
          Math.max(0, ...group.map((e) => (e.mileage != null && e.mileage > 0 ? e.mileage : 0)))
          || interpolateKm(lead.sortKey, series);
        const x = Math.min(VIEW_W - PAD.r, Math.max(PAD.l, xOf(lead.sortKey, min, span)));
        const y = yOf(km, axisMax);
        return {
          id: group.map((e) => e.id).join("+"),
          events: group,
          x,
          y,
          leftPct: (x / VIEW_W) * 100,
          topPct: (y / VIEW_H) * 100,
        };
      });

    return {
      maxKm: axisMax,
      years,
      yTicks,
      baselineY,
      lineD,
      areaD,
      markers,
    };
  }, [events]);

  const displayMarkers = useMemo(() => {
    if (!layout) return [];
    const latestMileageDay = latestMileageDayKey(events);
    const filtered = layout.markers
      .map((marker) => {
        const kept = marker.events.filter((e) => {
          if (e.type === "mileage" || e.type === "production") return true;
          return enabledTypes.has(e.type);
        });
        const hasSelectedType = kept.some(
          (e) => e.type !== "mileage" && e.type !== "production",
        );
        if (!hasSelectedType) {
          const originallyQuiet = marker.events.every(
            (e) => e.type === "mileage" || e.type === "production",
          );
          if (!originallyQuiet) return null;
        }
        if (!shouldShowTimelineMarkerGroup(kept, { latestMileageDay })) return null;
        return { ...marker, events: kept, id: kept.map((e) => e.id).join("+") };
      })
      .filter((m): m is PlotMarker => m != null);
    return mergeMarkersByProximity(filtered, chartZoomUi.zoom.scale);
  }, [layout, events, enabledTypes, chartZoomUi.zoom.scale]);

  if (!layout || events.length === 0) return null;

  const renderChart = (opts: {
    gradientId: string;
    heightClass: string;
    labelClass?: string;
    fillHeight?: boolean;
    zoom?: {
      viewportRef: RefObject<HTMLDivElement | null>;
      contentRef: RefObject<HTMLDivElement | null>;
      zoom: ChartZoom;
      gesturing: boolean;
      interactive: boolean;
    };
  }) => {
    const zoomScale = opts.zoom?.zoom.scale ?? 1;
    const chartBody = (
      <>
        <div className={cn("relative min-w-0 w-full overflow-visible", opts.fillHeight && "h-full min-h-0")}>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={cn("pointer-events-none block w-full max-w-full", opts.heightClass)}
            preserveAspectRatio="none"
            role="img"
            aria-hidden
          >
            <defs>
              <linearGradient id={opts.gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Soft horizontal guides — skip baseline (drawn separately) */}
            {layout.yTicks.slice(1).map((tick) => (
              <line
                key={tick.km}
                x1={PAD.l}
                x2={VIEW_W - PAD.r}
                y1={(tick.topPct / 100) * VIEW_H}
                y2={(tick.topPct / 100) * VIEW_H}
                className="stroke-border/25"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <line
              x1={PAD.l}
              x2={VIEW_W - PAD.r}
              y1={layout.baselineY}
              y2={layout.baselineY}
              className="stroke-foreground/12"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />

            {layout.years.map(({ year, leftPct }) => {
              const x = (leftPct / 100) * VIEW_W;
              return (
                <line
                  key={year}
                  x1={x}
                  x2={x}
                  y1={layout.baselineY}
                  y2={layout.baselineY + 5}
                  className="stroke-foreground/18"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {layout.areaD ? <path d={layout.areaD} fill={`url(#${opts.gradientId})`} /> : null}
            {layout.lineD ? (
              <>
                <path
                  d={layout.lineD}
                  className="stroke-primary/20"
                  fill="none"
                  strokeWidth="7"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={layout.lineD}
                  className="stroke-primary"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
          </svg>

          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {layout.yTicks.map((tick, i) => (
              <span
                key={tick.km}
                className={cn(
                  "absolute left-1.5 text-[10px] font-medium tabular-nums leading-none tracking-tight text-muted-foreground/80 sm:left-2.5 sm:text-[11px]",
                  opts.labelClass,
                )}
                style={yAxisLabelStyle(tick.topPct, i, layout.yTicks.length)}
              >
                {formatKmAxis(tick.km)}
              </span>
            ))}
          </div>

          {displayMarkers.map((m) => (
            <TimelineMarker
              key={m.id}
              events={m.events}
              leftPct={m.leftPct}
              topPct={m.topPct}
              t={t}
              language={language}
              vehicleYear={vehicleYear}
              vehicleCountry={vehicleCountry}
              krwPerUsd={krwPerUsd}
              interactive={opts.zoom?.interactive ?? true}
              zoomScale={zoomScale}
            />
          ))}
        </div>

        <div className="relative mt-0.5 h-5 min-w-0 w-full shrink-0 overflow-visible sm:h-5">
          {layout.years.map(({ year, leftPct }, i) => {
            const align =
              i === 0
                ? "translate-x-0"
                : i === layout.years.length - 1
                  ? "-translate-x-full"
                  : "-translate-x-1/2";
            return (
              <span
                key={year}
                className={cn(
                  "absolute top-0.5 text-[10px] font-medium tabular-nums leading-none text-muted-foreground/75 sm:text-[11px]",
                  align,
                )}
                style={{ left: `${leftPct}%` }}
              >
                {year}
              </span>
            );
          })}
        </div>
      </>
    );

    if (!opts.zoom) return chartBody;

    const zoomed = opts.zoom.zoom.scale > 1.02;
    return (
      <div
        ref={opts.zoom.viewportRef}
        className={cn(
          "min-h-0 overflow-hidden overscroll-contain select-none rounded-md",
          opts.fillHeight ? "h-full flex-1" : "",
          opts.zoom.gesturing || zoomed ? "touch-none" : "touch-pan-y",
          zoomed && "cursor-grab",
          opts.zoom.gesturing && zoomed && "cursor-grabbing",
        )}
      >
        <div
          ref={opts.zoom.contentRef}
          className={cn("origin-top-left will-change-transform", opts.fillHeight && "h-full min-h-0 flex flex-col")}
          style={{
            transform: `translate(${opts.zoom.zoom.x}px, ${opts.zoom.zoom.y}px) scale(${opts.zoom.zoom.scale})`,
            // Never animate while zoomed — CSS transitions fight drag updates and feel "stuck"
            transition: zoomed || opts.zoom.gesturing ? "none" : "transform 140ms ease-out",
          }}
        >
          {chartBody}
        </div>
      </div>
    );
  };

  const legend = presentTypes.length > 0 ? (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 px-3 py-2.5 sm:gap-2 sm:px-5">
      <p className="sr-only">{t("report_timeline_filter_hint")}</p>
      {presentTypes.map((type) => {
        const on = enabledTypes.has(type);
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            onClick={() => toggleType(type)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
              "text-[11px] font-medium transition-colors sm:text-xs",
              on
                ? "bg-muted/70 text-foreground ring-1 ring-border/70"
                : "text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-opacity",
                TYPE_DOT[type],
                !on && "opacity-30",
              )}
            />
            {t(TYPE_LABEL_KEY[type])}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <section
      className={cn(
        "print:hidden max-w-full min-w-0 overflow-x-hidden vin-report-section--decorated",
        VIN_REPORT_SECTION_SURFACE,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#00a5fd]/10 bg-[#f7fbfe] px-4 py-3.5 sm:px-6">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#071018] sm:text-[12px]">
          {t("report_timeline_title")}
        </h2>
        <div className="flex items-center gap-1.5">
          <ChartZoomControls
            t={t}
            zoom={chartZoomUi.zoom}
            zoomed={chartZoomUi.zoomed}
            onZoomIn={() => chartZoomUi.zoomAtCenter(ZOOM_FACTOR)}
            onZoomOut={() => chartZoomUi.zoomAtCenter(1 / ZOOM_FACTOR)}
            onReset={resetZoom}
          />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("report_timeline_fullscreen")}
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="w-full min-w-0 pt-2 pb-1 sm:pt-2.5 sm:pb-1.5">
        {fullscreen ? (
          /* Keep layout height while fullscreen owns the interactive viewport */
          <div className="h-[14rem] sm:h-[17rem] lg:h-[19rem]" aria-hidden />
        ) : (
          renderChart({
            gradientId: fillId,
            heightClass: "h-[14rem] sm:h-[17rem] lg:h-[19rem]",
            zoom: {
              viewportRef: chartZoomUi.viewportRef,
              contentRef: chartZoomUi.contentRef,
              zoom: chartZoomUi.zoom,
              gesturing: chartZoomUi.gesturing,
              interactive: !chartZoomUi.gesturing,
            },
          })
        )}
      </div>

      {legend}

      {fullscreen
        && createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm"
            style={{ paddingTop: "var(--site-header-offset, 4rem)" }}
            role="dialog"
            aria-modal="true"
            aria-label={t("report_timeline_title")}
          >
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-3 pb-3 pt-2 sm:px-5 sm:pb-4 sm:pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {t("report_timeline_title")}
                </h2>
                <div className="flex items-center gap-1.5">
                  <ChartZoomControls
                    t={t}
                    zoom={chartZoomUi.zoom}
                    zoomed={chartZoomUi.zoomed}
                    onZoomIn={() => chartZoomUi.zoomAtCenter(ZOOM_FACTOR)}
                    onZoomOut={() => chartZoomUi.zoomAtCenter(1 / ZOOM_FACTOR)}
                    onReset={resetZoom}
                  />
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t("report_timeline_fullscreen_close")}
                    onClick={() => setFullscreen(false)}
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="min-h-0 flex-1 px-2 pt-3 sm:px-4 sm:pt-4">
                    {renderChart({
                      gradientId: fullscreenFillId,
                      heightClass: "h-full min-h-[18rem]",
                      fillHeight: true,
                      labelClass: "sm:text-xs",
                      zoom: {
                        viewportRef: chartZoomUi.viewportRef,
                        contentRef: chartZoomUi.contentRef,
                        zoom: chartZoomUi.zoom,
                        gesturing: chartZoomUi.gesturing,
                        interactive: !chartZoomUi.gesturing,
                      },
                    })}
                  </div>
                  {legend}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
