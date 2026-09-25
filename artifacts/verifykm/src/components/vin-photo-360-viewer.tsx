import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RotateCcw, View } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { markVinImageSessionLoaded, isVinImageSessionLoaded } from "@/lib/vin-image-cache";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";

const MIN_SPIN_FRAMES = 8;
const PIXELS_PER_FRAME = 14;
const ZOOM_LEVELS = [1, 2, 3] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];
type SpinKind = "exterior" | "interior";

type Props = {
  exterior?: string[] | null;
  interior?: string[] | null;
  embedUrl?: string | string[] | null;
  embedExteriorUrl?: string | string[] | null;
  embedInteriorUrl?: string | string[] | null;
  className?: string;
};

function cleanFrames(urls: string[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.filter((u): u is string => typeof u === "string" && u.length > 0);
}

function safeEmbedUrl(raw: string | string[] | null | undefined): string | null {
  const candidate = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
  if (!candidate || typeof candidate !== "string") return null;
  try {
    const parsed = new URL(candidate.trim());
    if (parsed.protocol !== "https:") return null;
    if (!/(?:^|\.)(?:iaai\.com|copart\.com)$/i.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function VinPhoto360Viewer({
  exterior,
  interior,
  embedUrl,
  embedExteriorUrl,
  embedInteriorUrl,
  className,
}: Props) {
  const { t } = useTranslation();
  const exteriorFrames = useMemo(() => cleanFrames(exterior), [exterior]);
  const interiorFrames = useMemo(() => cleanFrames(interior), [interior]);

  const combinedEmbed = useMemo(() => safeEmbedUrl(embedUrl), [embedUrl]);
  const exteriorEmbed = useMemo(
    () => safeEmbedUrl(embedExteriorUrl) ?? combinedEmbed,
    [embedExteriorUrl, combinedEmbed],
  );
  const interiorEmbed = useMemo(
    () => safeEmbedUrl(embedInteriorUrl) ?? combinedEmbed,
    [embedInteriorUrl, combinedEmbed],
  );

  const hasExteriorFrames = exteriorFrames.length >= MIN_SPIN_FRAMES;
  const hasInteriorFrames = interiorFrames.length >= MIN_SPIN_FRAMES;
  const hasExterior = hasExteriorFrames || !!exteriorEmbed;
  const hasInterior = hasInteriorFrames || !!interiorEmbed;

  const [kind, setKind] = useState<SpinKind>(hasExterior ? "exterior" : "interior");
  const [zoom, setZoom] = useState<ZoomLevel>(1);

  const frames = kind === "exterior" ? exteriorFrames : interiorFrames;
  const useFrameMode = kind === "exterior" ? hasExteriorFrames : hasInteriorFrames;
  const activeEmbedUrl = kind === "exterior" ? exteriorEmbed : interiorEmbed;

  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [imgReady, setImgReady] = useState(false);
  const dragRef = useRef<{ x: number; startIndex: number } | null>(null);
  const preloadRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (hasExterior) setKind("exterior");
    else if (hasInterior) setKind("interior");
  }, [hasExterior, hasInterior]);

  useEffect(() => {
    setIndex(0);
    setZoom(1);
  }, [kind]);

  useEffect(() => {
    if (!useFrameMode || frames.length === 0) return;
    for (const url of frames) {
      if (preloadRef.current.has(url)) continue;
      preloadRef.current.add(url);
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  }, [frames, useFrameMode]);

  const currentUrl = frames[index] ?? frames[0];
  useEffect(() => {
    if (!currentUrl || !useFrameMode) {
      setImgReady(false);
      return;
    }
    setImgReady(isVinImageSessionLoaded(currentUrl));
  }, [currentUrl, useFrameMode]);

  const scrubByDelta = useCallback(
    (deltaX: number) => {
      if (frames.length < 2 || !dragRef.current) return;
      const frameDelta = Math.round(deltaX / PIXELS_PER_FRAME);
      const next = ((dragRef.current.startIndex + frameDelta) % frames.length + frames.length) % frames.length;
      setIndex(next);
    },
    [frames.length],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!useFrameMode || frames.length < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, startIndex: index };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    scrubByDelta(e.clientX - dragRef.current.x);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    dragRef.current = null;
    setDragging(false);
  };

  if (!hasExterior && !hasInterior) return null;

  const showSwitcher = hasExterior && hasInterior;

  return (
    <VinReportSection className={className} accent="sky">
      <VinReportSectionHeader
        icon={View}
        accent="sky"
        title={t("vin_360_title")}
      />

      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-3 py-2 sm:px-4">
        {showSwitcher ? (
          <div className="inline-flex w-full rounded-lg border border-border/70 bg-background/90 p-0.5 text-xs font-semibold shadow-sm sm:w-auto">
            <button
              type="button"
              onClick={() => setKind("exterior")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 transition-colors sm:flex-none",
                kind === "exterior"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("vin_360_exterior")}
            </button>
            <button
              type="button"
              onClick={() => setKind("interior")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 transition-colors sm:flex-none",
                kind === "interior"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("vin_360_interior")}
            </button>
          </div>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">
            {kind === "exterior" ? t("vin_360_exterior") : t("vin_360_interior")}
          </span>
        )}

        <div
          className="inline-flex rounded-lg border border-border/70 bg-background/90 p-0.5 text-xs font-semibold shadow-sm"
          role="group"
          aria-label={t("vin_360_zoom")}
        >
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoom(level)}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors tabular-nums",
                zoom === level
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={zoom === level}
            >
              {level}x
            </button>
          ))}
        </div>
      </div>

      {useFrameMode ? (
        <div
          className={cn(
            "relative z-[1] aspect-[16/10] overflow-hidden bg-muted/40 select-none touch-none",
            frames.length > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="img"
          aria-label={kind === "exterior" ? t("vin_360_exterior") : t("vin_360_interior")}
        >
          {currentUrl ? (
            <img
              key={currentUrl}
              src={currentUrl}
              alt=""
              draggable={false}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-[opacity,transform] duration-150",
                imgReady ? "opacity-100" : "opacity-0",
              )}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
              }}
              onLoad={() => {
                markVinImageSessionLoaded(currentUrl);
                setImgReady(true);
              }}
            />
          ) : null}
          {!imgReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/25 border-t-muted-foreground/70 animate-spin" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white/95">
              <RotateCcw className="h-3 w-3 opacity-90" />
              {t("vin_360_hint")}
            </span>
            <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold tabular-nums text-white/95">
              {index + 1}/{frames.length} · {zoom}x
            </span>
          </div>
        </div>
      ) : activeEmbedUrl ? (
        <div className="relative z-[1] aspect-[16/10] overflow-hidden bg-muted/30">
          <iframe
            key={`${kind}-${activeEmbedUrl}-${zoom}`}
            title={kind === "exterior" ? t("vin_360_exterior") : t("vin_360_interior")}
            src={activeEmbedUrl}
            className="absolute inset-0 h-full w-full border-0 transition-transform duration-150"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
            allow="fullscreen; accelerometer; gyroscope"
            referrerPolicy="no-referrer-when-downgrade"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent">
            <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-medium text-white/95">
              {t("vin_360_embed_hint")}
            </span>
            <span className="rounded-md bg-black/45 px-2 py-1 text-[11px] font-semibold tabular-nums text-white/95">
              {zoom}x
            </span>
          </div>
        </div>
      ) : null}

      {activeEmbedUrl ? (
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-3 py-2.5 sm:px-4">
          <p className="text-xs text-muted-foreground leading-snug">
            {useFrameMode ? t("vin_360_embed_extra") : t("vin_360_zoom_hint")}
          </p>
          <a
            href={activeEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/60"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("vin_360_open")}
          </a>
        </div>
      ) : null}
    </VinReportSection>
  );
}
