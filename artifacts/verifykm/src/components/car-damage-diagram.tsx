import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DAMAGE_SEVERITY_META,
  normalizeDamagePartLabel,
  parseCarDamageFromRepairExtras,
  type CarDamageHit,
  type CarDamageZoneId,
  type DamageSeverity,
} from "@/lib/car-damage-zones";
import { translateBodyPanelLabel } from "@/lib/translate-damage-label";

type ExtraLike = {
  key?: string | null;
  label?: string | null;
  value?: string | null;
};

type Props = {
  extras: ExtraLike[];
  t: (key: string) => string;
  className?: string;
  /** Tighter layout for homepage / marketing report previews. */
  compact?: boolean;
};

/** Panel ids from the Car History / KIDI multi-view body map. */
const ZONE_PANELS: Record<CarDamageZoneId, string[]> = {
  front_bumper: ["p01"],
  grille: ["p20"],
  hood: ["p03"],
  front_fender_l: ["p10"],
  front_fender_r: ["p11"],
  front_door_l: ["p06"],
  front_door_r: ["p07"],
  rear_door_l: ["p08"],
  rear_door_r: ["p09"],
  rear_fender_l: ["p12"],
  rear_fender_r: ["p13"],
  side_sill_l: ["p25"],
  side_sill_r: ["p26"],
  rear_bumper: ["p02"],
  trunk: ["p04", "p05"],
  roof: ["p16", "p15"],
  glass: ["p14", "p19"],
};

const PANEL_TO_ZONE: Record<string, CarDamageZoneId> = Object.fromEntries(
  (Object.entries(ZONE_PANELS) as [CarDamageZoneId, string[]][]).flatMap(([zone, ids]) =>
    ids.map((id) => [id, zone]),
  ),
) as Record<string, CarDamageZoneId>;

function hatchClass(sev: DamageSeverity): string {
  if (sev === "paint") return "st4";
  if (sev === "repair") return "st3"; // red
  if (sev === "replace") return "st2"; // steel/slate
  return "st6"; // sheet_metal
}

function severityLabelKey(sev: DamageSeverity): string {
  return DAMAGE_SEVERITY_META[sev].titleKey;
}

function shortPartLabel(label: string, t: (key: string) => string): string {
  const cleaned = normalizeDamagePartLabel(label)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return translateBodyPanelLabel(t, cleaned) ?? cleaned;
}

function markerFill(sev: DamageSeverity): string {
  return DAMAGE_SEVERITY_META[sev].hatch;
}

function setPanelHatch(el: Element, sev: DamageSeverity | null) {
  const cls = el.getAttribute("class") ?? "";
  const rest = cls
    .replace(/\bst[2-6]\b/g, "")
    .replace(/\bkm-active\b/g, "")
    .replace(/\bkm-dim\b/g, "")
    .replace(/\bkm-damage\b/g, "")
    .trim();
  const hatch = sev ? hatchClass(sev) : "st5";
  el.setAttribute("class", [hatch, sev ? "km-damage" : "", rest].filter(Boolean).join(" "));
  if (el instanceof SVGElement) {
    el.style.cursor = sev ? "pointer" : "";
    el.style.stroke = "";
    el.style.strokeWidth = "";
    el.style.filter = "";
    el.style.opacity = "";
  }
}

function toggleFocusClass(el: Element, kind: "active" | "dim", on: boolean) {
  const token = kind === "active" ? "km-active" : "km-dim";
  const cls = el.getAttribute("class") ?? "";
  const has = new RegExp(`\\b${token}\\b`).test(cls);
  if (on === has) return;
  el.setAttribute(
    "class",
    on ? `${cls} ${token}`.trim() : cls.replace(new RegExp(`\\s*\\b${token}\\b`, "g"), "").trim(),
  );
}

function elementCenter(el: SVGGraphicsElement): { x: number; y: number } | null {
  try {
    const box = el.getBBox();
    if (!box.width && !box.height) return null;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  } catch {
    return null;
  }
}

function zoneFromTarget(target: Element | null): CarDamageZoneId | null {
  if (!target) return null;
  const panel = target.closest("[id^='p']");
  if (!panel?.id) return null;
  return PANEL_TO_ZONE[panel.id] ?? null;
}

export function CarDamageDiagram({ extras, t, className, compact = false }: Props) {
  const uid = useId().replace(/:/g, "");
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [svgLoaded, setSvgLoaded] = useState(false);

  const hits = useMemo(() => parseCarDamageFromRepairExtras(extras), [extras]);
  const byZone = useMemo(() => {
    const map = new Map<CarDamageZoneId, CarDamageHit>();
    for (const hit of hits) map.set(hit.zone, hit);
    return map;
  }, [hits]);

  /** Click-pinned zone (detail panel). */
  const [pinned, setPinned] = useState<CarDamageZoneId | null>(null);
  /** Hover / pointer focus for fade emphasis. */
  const [hoverZone, setHoverZone] = useState<CarDamageZoneId | null>(null);

  const focusZone =
    (hoverZone && byZone.has(hoverZone) ? hoverZone : null)
    ?? (pinned && byZone.has(pinned) ? pinned : null);
  const activeHit = focusZone ? byZone.get(focusZone) ?? null : null;
  const fading = focusZone != null;

  // Load the multi-view body map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/damage-diagram/body-map.svg?v=hover-fast-1");
        if (!res.ok) return;
        let markup = await res.text();
        // Scope pattern ids so multiple instances don't clash (incl. dark-mode CSS selectors).
        markup = markup
          .replace(/\bid="(redHatch|blueHatch|YellowHatch|sheetHatch)"/g, `id="${uid}-$1"`)
          .replace(/url\(#(redHatch|blueHatch|YellowHatch|sheetHatch)\)/g, `url(#${uid}-$1)`)
          .replace(/#(redHatch|blueHatch|YellowHatch|sheetHatch)\b/g, `#${uid}-$1`);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = markup;
        const svg = hostRef.current.querySelector("svg");
        if (svg) {
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", t("damage_diagram_aria"));
          svg.classList.add("w-full", "h-auto", "block");
        }
        setSvgLoaded(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, t]);

  // Paint hatches + markers once; listeners only change React hover/pin state.
  useEffect(() => {
    if (!svgLoaded || !hostRef.current) return;
    const svg = hostRef.current.querySelector("svg");
    if (!svg) return;

    for (const ids of Object.values(ZONE_PANELS)) {
      for (const id of ids) {
        const el = svg.querySelector(`#${CSS.escape(id)}`);
        if (el) setPanelHatch(el, null);
      }
    }
    for (const hit of hits) {
      for (const id of ZONE_PANELS[hit.zone]) {
        const el = svg.querySelector(`#${CSS.escape(id)}`);
        if (el) setPanelHatch(el, hit.severity);
      }
    }

    let markers = svg.querySelector("#km-damage-markers") as SVGGElement | null;
    if (!markers) {
      markers = document.createElementNS("http://www.w3.org/2000/svg", "g");
      markers.setAttribute("id", "km-damage-markers");
      markers.setAttribute("pointer-events", "none");
      svg.appendChild(markers);
    }
    markers.replaceChildren();

    for (const hit of hits) {
      const primaryId = ZONE_PANELS[hit.zone][0];
      const el = svg.querySelector(`#${CSS.escape(primaryId)}`);
      if (!(el instanceof SVGGraphicsElement)) continue;
      const pt = elementCenter(el);
      if (!pt) continue;
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("data-zone", hit.zone);
      g.setAttribute("class", "km-marker");

      const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      ring.setAttribute("class", "km-marker-ring");
      ring.setAttribute("cx", String(pt.x));
      ring.setAttribute("cy", String(pt.y));
      ring.setAttribute("r", "18");
      ring.setAttribute("fill", "none");
      ring.setAttribute("stroke", markerFill(hit.severity));
      ring.setAttribute("stroke-width", "3");
      ring.setAttribute("opacity", "0.9");
      g.appendChild(ring);

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", "km-marker-dot");
      circle.setAttribute("cx", String(pt.x));
      circle.setAttribute("cy", String(pt.y));
      circle.setAttribute("r", "11");
      circle.setAttribute("fill", markerFill(hit.severity));
      circle.setAttribute("stroke", "#fff");
      circle.setAttribute("stroke-width", "1.5");
      g.appendChild(circle);

      if (hit.severity === "paint") {
        const brush = document.createElementNS("http://www.w3.org/2000/svg", "path");
        brush.setAttribute(
          "d",
          `M${pt.x - 4} ${pt.y + 3} l3 -8 2 1 -3 8 z M${pt.x - 1} ${pt.y - 5} l4 -2`,
        );
        brush.setAttribute("fill", "#fff");
        brush.setAttribute("stroke", "#fff");
        brush.setAttribute("stroke-width", "0.8");
        g.appendChild(brush);
      } else {
        const wrench = document.createElementNS("http://www.w3.org/2000/svg", "path");
        wrench.setAttribute(
          "d",
          `M${pt.x - 5} ${pt.y + 4} L${pt.x + 4} ${pt.y - 5} M${pt.x + 2} ${pt.y - 6} l3 3 M${pt.x - 6} ${pt.y + 2} l3 3`,
        );
        wrench.setAttribute("fill", "none");
        wrench.setAttribute("stroke", "#fff");
        wrench.setAttribute("stroke-width", "1.6");
        wrench.setAttribute("stroke-linecap", "round");
        g.appendChild(wrench);
      }
      markers.appendChild(g);
    }

    const damaged = byZone;
    const onClick = (e: Event) => {
      const zone = zoneFromTarget(e.target as Element | null);
      if (zone && damaged.has(zone)) {
        setPinned(zone);
        setHoverZone(zone);
        return;
      }
      setPinned(null);
      setHoverZone(null);
    };
    const onMove = (e: Event) => {
      const zone = zoneFromTarget(e.target as Element | null);
      const next = zone && damaged.has(zone) ? zone : null;
      setHoverZone((prev) => (prev === next ? prev : next));
    };
    const onLeave = () => {
      setHoverZone((prev) => (prev == null ? prev : null));
    };

    svg.addEventListener("click", onClick);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerleave", onLeave);
    return () => {
      svg.removeEventListener("click", onClick);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerleave", onLeave);
    };
  }, [svgLoaded, hits, byZone]);

  // Cheap focus pass: toggle classes only (no getBBox / marker rebuild).
  useEffect(() => {
    if (!svgLoaded || !hostRef.current) return;
    const svg = hostRef.current.querySelector("svg");
    if (!svg) return;

    for (const [zone, ids] of Object.entries(ZONE_PANELS) as [CarDamageZoneId, string[]][]) {
      const hit = byZone.get(zone);
      const isFocus = focusZone === zone;
      for (const id of ids) {
        const el = svg.querySelector(`#${CSS.escape(id)}`);
        if (!el) continue;
        toggleFocusClass(el, "active", Boolean(hit) && isFocus);
        toggleFocusClass(el, "dim", fading && (!hit || !isFocus));
      }
    }

    svg.querySelectorAll(".st1").forEach((el) => {
      toggleFocusClass(el, "dim", fading);
    });

    svg.querySelectorAll("#km-damage-markers > [data-zone]").forEach((g) => {
      const zone = g.getAttribute("data-zone") as CarDamageZoneId | null;
      const selected = zone != null && focusZone === zone;
      const dimmed = fading && !selected;
      g.setAttribute(
        "class",
        ["km-marker", selected ? "km-marker-selected" : "", dimmed ? "km-marker-dim" : ""]
          .filter(Boolean)
          .join(" "),
      );
    });
  }, [svgLoaded, byZone, focusZone, fading]);

  // Click outside the whole diagram card clears pin + hover
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        setPinned(null);
        setHoverZone(null);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  if (!hits.length) return null;

  const usedSeverities = [...new Set(hits.map((h) => h.severity))];

  return (
    <div
      ref={rootRef}
      className={cn(
        "rounded-xl border border-border/70 bg-zinc-50/80 dark:bg-transparent",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4",
        className,
      )}
    >
      <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-4")}>
        <div>
          <p className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
            {compact ? t("wwc_demo_accident_map") : t("damage_diagram_title")}
          </p>
          {!compact ? (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t("damage_diagram_note")}</p>
          ) : null}
        </div>

        <div className="w-full">
          <div
            ref={hostRef}
            className={cn(
              "w-full rounded-lg bg-zinc-100/50 dark:bg-transparent [&_svg]:w-full [&_svg]:h-auto",
              compact && "max-h-[220px] overflow-hidden [&_svg]:max-h-[220px] [&_svg]:object-contain",
            )}
          />
          {!svgLoaded ? (
            <div
              className={cn(
                "w-full animate-pulse rounded-md bg-zinc-200/70 dark:bg-transparent dark:border dark:border-border/40",
                compact ? "h-[180px]" : "aspect-[706/889]",
              )}
            />
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 justify-center px-1">
            {usedSeverities.map((sev) => {
              const meta = DAMAGE_SEVERITY_META[sev];
              const angle = sev === "repair" || sev === "sheet_metal" ? 45 : -45;
              return (
                <div key={sev} className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <svg width="34" height="14" className="border border-zinc-300 dark:border-zinc-600 overflow-hidden rounded-[2px]">
                    <defs>
                      <pattern
                        id={`${uid}-leg-${sev}`}
                        patternUnits="userSpaceOnUse"
                        width="9"
                        height="9"
                        patternTransform={`rotate(${angle})`}
                      >
                        <rect
                          width="9"
                          height="9"
                          className={cn(
                            sev === "replace" && "fill-zinc-200 dark:fill-zinc-700/50",
                            sev === "repair" && "fill-red-200 dark:fill-red-900/45",
                            sev === "paint" && "fill-amber-200 dark:fill-amber-900/40",
                            sev === "sheet_metal" && "fill-rose-200 dark:fill-rose-900/45",
                          )}
                        />
                        <path d="M0 4.5 H9" stroke={meta.hatch} strokeWidth="2.4" />
                      </pattern>
                    </defs>
                    <rect width="34" height="14" fill={`url(#${uid}-leg-${sev})`} />
                  </svg>
                  <span>{t(severityLabelKey(sev))}</span>
                </div>
              );
            })}
          </div>
        </div>

        {!compact ? (
          <div className="w-full space-y-2.5">
            <div className="rounded-lg border border-border/60 overflow-hidden dark:bg-transparent">
              <div className="px-3 py-1.5 bg-zinc-50/80 dark:bg-transparent border-b border-border/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("damage_diagram_repair_zones")}
              </div>
              <ul className="divide-y divide-border/40 max-h-[280px] sm:max-h-none overflow-y-auto">
                {hits.map((hit) => {
                  const selected = focusZone === hit.zone;
                  const meta = DAMAGE_SEVERITY_META[hit.severity];
                  const angle = hit.severity === "repair" || hit.severity === "sheet_metal" ? 45 : -45;
                  return (
                    <li key={hit.zone}>
                      <button
                        type="button"
                        onClick={() => {
                          setPinned(hit.zone);
                          setHoverZone(hit.zone);
                        }}
                        onMouseEnter={() => setHoverZone(hit.zone)}
                        onMouseLeave={() => setHoverZone(null)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-left border-l-[3px] transition-colors",
                          selected
                            ? "bg-zinc-100/80 dark:bg-muted/25 border-l-zinc-500 dark:border-l-zinc-300"
                            : "border-l-transparent hover:bg-muted/30",
                        )}
                        style={selected ? { boxShadow: `inset 0 0 0 1px ${meta.stroke}33` } : undefined}
                      >
                        <svg width="28" height="12" className="shrink-0 border border-zinc-300 dark:border-zinc-600 overflow-hidden rounded-[2px]">
                          <defs>
                            <pattern
                              id={`${uid}-row-${hit.zone}`}
                              patternUnits="userSpaceOnUse"
                              width="9"
                              height="9"
                              patternTransform={`rotate(${angle})`}
                            >
                              <rect
                                width="9"
                                height="9"
                                className={cn(
                                  hit.severity === "replace" && "fill-zinc-200 dark:fill-zinc-700/50",
                                  hit.severity === "repair" && "fill-red-200 dark:fill-red-900/45",
                                  hit.severity === "paint" && "fill-amber-200 dark:fill-amber-900/40",
                                  hit.severity === "sheet_metal" && "fill-rose-200 dark:fill-rose-900/45",
                                )}
                              />
                              <path d="M0 4.5 H9" stroke={meta.hatch} strokeWidth="2.4" />
                            </pattern>
                          </defs>
                          <rect width="28" height="12" fill={`url(#${uid}-row-${hit.zone})`} />
                        </svg>
                        <span className="text-[11px] font-medium flex-1 truncate">
                          {t(`damage_zone_${hit.zone}`)}
                        </span>
                        <span
                          className="text-[10px] font-medium shrink-0"
                          style={{ color: meta.stroke }}
                        >
                          {t(severityLabelKey(hit.severity))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-lg border border-border/60 px-3 py-2.5 min-h-[5rem] bg-zinc-50/60 dark:bg-transparent">
              {activeHit ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold">
                    {t(`damage_zone_${activeHit.zone}`)}
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                      {t(severityLabelKey(activeHit.severity))}
                    </span>
                  </p>
                  <ul className="space-y-0.5">
                    {activeHit.labels.slice(0, 6).map((label) => (
                      <li key={label} className="text-[11px] text-muted-foreground leading-snug">
                        {shortPartLabel(label, t)}
                      </li>
                    ))}
                    {activeHit.labels.length > 6 ? (
                      <li className="text-[11px] text-muted-foreground/80">
                        +{activeHit.labels.length - 6} {t("damage_diagram_more")}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">{t("damage_diagram_hover")}</p>
              )}
            </div>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 px-0.5">
            {hits.map((hit) => (
              <li key={hit.zone} className="text-[10px] font-medium text-muted-foreground">
                <span className="text-foreground">{t(`damage_zone_${hit.zone}`)}</span>
                {" · "}
                {t(severityLabelKey(hit.severity))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
