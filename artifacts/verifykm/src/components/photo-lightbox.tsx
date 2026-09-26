import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { isVinImageSessionLoaded, markVinImageSessionLoaded, warmVinImageNeighbors } from "@/lib/vin-image-cache";
import { nextAvailablePhotoIndex } from "@/lib/report-photos";

type PhotoLightboxProps = {
  photos: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
};

const SWIPE_THRESHOLD = 50;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const ZOOM_STEP = 0.5;

type Transform = { scale: number; x: number; y: number };

function getTouchDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function clampPan(
  x: number,
  y: number,
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  if (scale <= 1) return { x: 0, y: 0 };
  const scaledW = imageWidth * scale;
  const scaledH = imageHeight * scale;
  const maxX = Math.max(0, (scaledW - viewportWidth) / 2);
  const maxY = Math.max(0, (scaledH - viewportHeight) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
}

function clampScale(scale: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

/** Full-screen photo viewer with keyboard nav, touch swipe, pinch-zoom, and locked background scroll. */
export function PhotoLightbox({ photos, index, onClose, onNav }: PhotoLightboxProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const mousePanActive = useRef(false);
  const lastTap = useRef(0);
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const mounted = typeof document !== "undefined";

  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  const [activeReady, setActiveReady] = useState(() =>
    isVinImageSessionLoaded(photos[index] ?? ""),
  );
  const [activeFailed, setActiveFailed] = useState(false);
  const failedUrlsRef = useRef<Set<string>>(new Set());
  const skipAttemptsRef = useRef(0);

  const bufferIndices = useMemo(() => {
    const n = photos.length;
    if (n === 0) return [];
    if (n === 1) return [0];
    const prev = (index - 1 + n) % n;
    const next = (index + 1) % n;
    return [...new Set([prev, index, next])];
  }, [index, photos.length]);

  useEffect(() => {
    if (photos.length === 0) return;
    void warmVinImageNeighbors(photos, index, 1);
    const src = photos[index] ?? "";
    setActiveFailed(false);
    setActiveReady(isVinImageSessionLoaded(src));
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setActiveReady(true);
    } else if (img?.complete && img.naturalWidth === 0) {
      setActiveFailed(true);
    }
  }, [photos, index]);

  useEffect(() => {
    failedUrlsRef.current = new Set();
    skipAttemptsRef.current = 0;
  }, [photos.join("\0")]); // eslint-disable-line react-hooks/exhaustive-deps -- URL identity

  // Dead active frame → auto-advance to the next URL that still loads.
  useEffect(() => {
    if (!activeFailed || photos.length <= 1) return;
    const src = photos[index] ?? "";
    if (src) failedUrlsRef.current.add(src);
    if (skipAttemptsRef.current >= photos.length) return;
    skipAttemptsRef.current += 1;
    const failedMap: Record<string, boolean> = {};
    for (const u of failedUrlsRef.current) failedMap[u] = true;
    const next = nextAvailablePhotoIndex(photos, index, failedMap, 1);
    if (next != null && next !== index) onNav(next);
  }, [activeFailed, photos, index, onNav]);

  /** Stop infinite spinner if upstream image hangs without firing onError. */
  useEffect(() => {
    if (activeReady || activeFailed) return;
    const src = photos[index] ?? "";
    if (!src) return;
    const timer = window.setTimeout(() => setActiveFailed(true), 18_000);
    return () => window.clearTimeout(timer);
  }, [photos, index, activeReady, activeFailed]);

  const measureImage = useCallback(() => {
    const img = imageRef.current;
    if (!img) return { width: 0, height: 0 };
    const rect = img.getBoundingClientRect();
    const scale = transformRef.current.scale || 1;
    return {
      width: rect.width / scale,
      height: rect.height / scale,
    };
  }, []);

  const applyTransform = useCallback((next: Transform) => {
    const viewport = viewportRef.current;
    const width = viewport?.clientWidth ?? 0;
    const height = viewport?.clientHeight ?? 0;
    const { width: imageWidth, height: imageHeight } = measureImage();
    const scale = clampScale(next.scale);
    const panned = clampPan(next.x, next.y, scale, width, height, imageWidth, imageHeight);
    const value = { scale, ...panned };
    transformRef.current = value;
    setTransform(value);
  }, [measureImage]);

  const resetZoom = useCallback(() => {
    applyTransform({ scale: 1, x: 0, y: 0 });
  }, [applyTransform]);

  const zoomBy = useCallback((delta: number) => {
    applyTransform({
      ...transformRef.current,
      scale: clampScale(transformRef.current.scale + delta),
    });
  }, [applyTransform]);

  useEffect(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    setTransform({ scale: 1, x: 0, y: 0 });
  }, [index]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (transformRef.current.scale > 1) return;
      if (e.key === "ArrowLeft") onNav((index - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") onNav((index + 1) % photos.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, photos.length, onClose, onNav]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const { style } = document.body;
    const prev = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
      overflow: style.overflow,
      touchAction: style.touchAction,
    };

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.width = "100%";
    style.overflow = "hidden";
    style.touchAction = "none";

    return () => {
      style.position = prev.position;
      style.top = prev.top;
      style.left = prev.left;
      style.right = prev.right;
      style.width = prev.width;
      style.overflow = prev.overflow;
      style.touchAction = prev.touchAction;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const blockBackdropScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-lightbox-viewport]")) return;
      e.preventDefault();
    };

    overlay.addEventListener("touchmove", blockBackdropScroll, { passive: false });
    return () => overlay.removeEventListener("touchmove", blockBackdropScroll);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        setIsGesturing(true);
        pinchStart.current = {
          distance: getTouchDistance(e.touches),
          scale: transformRef.current.scale,
        };
        panStart.current = null;
        touchStart.current = null;
        return;
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
        panStart.current = {
          x: t.clientX,
          y: t.clientY,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        };
        pinchStart.current = null;
        if (transformRef.current.scale > 1.02) setIsGesturing(true);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStart.current) {
        const distance = getTouchDistance(e.touches);
        const ratio = distance / pinchStart.current.distance;
        applyTransform({
          ...transformRef.current,
          scale: pinchStart.current.scale * ratio,
        });
        e.preventDefault();
        return;
      }

      if (e.touches.length !== 1 || !panStart.current) return;
      const t = e.touches[0];
      const dx = t.clientX - panStart.current.x;
      const dy = t.clientY - panStart.current.y;

      if (transformRef.current.scale > 1.02) {
        applyTransform({
          scale: transformRef.current.scale,
          x: panStart.current.tx + dx,
          y: panStart.current.ty + dy,
        });
        e.preventDefault();
        return;
      }

      if (touchStart.current) {
        const sx = t.clientX - touchStart.current.x;
        const sy = t.clientY - touchStart.current.y;
        if (Math.abs(sx) > Math.abs(sy) && Math.abs(sx) > 8) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;
      setIsGesturing(false);

      const now = Date.now();
      if (touchStart.current && !pinchStart.current) {
        const dx = e.changedTouches[0].clientX - touchStart.current.x;
        const dy = e.changedTouches[0].clientY - touchStart.current.y;
        const moved = Math.hypot(dx, dy);

        if (moved < 10) {
          if (now - lastTap.current < 280) {
            const current = transformRef.current;
            if (current.scale > 1.05) {
              resetZoom();
            } else {
              applyTransform({ scale: DOUBLE_TAP_SCALE, x: 0, y: 0 });
            }
            lastTap.current = 0;
          } else {
            lastTap.current = now;
          }
        } else if (
          transformRef.current.scale <= 1.02 &&
          photos.length > 1 &&
          Math.abs(dx) >= SWIPE_THRESHOLD &&
          Math.abs(dx) > Math.abs(dy)
        ) {
          if (dx < 0) onNav((index + 1) % photos.length);
          else onNav((index - 1 + photos.length) % photos.length);
        }
      }

      touchStart.current = null;
      panStart.current = null;
      pinchStart.current = null;
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform, index, onNav, photos.length, resetZoom]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!mousePanActive.current || !panStart.current) return;
      if (transformRef.current.scale <= 1.02) return;
      e.preventDefault();
      applyTransform({
        scale: transformRef.current.scale,
        x: panStart.current.tx + (e.clientX - panStart.current.x),
        y: panStart.current.ty + (e.clientY - panStart.current.y),
      });
    };

    const endMousePan = () => {
      mousePanActive.current = false;
      panStart.current = null;
      setIsGesturing(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endMousePan);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endMousePan);
    };
  }, [applyTransform]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (transformRef.current.scale <= 1.02) return;
    e.preventDefault();
    e.stopPropagation();
    mousePanActive.current = true;
    setIsGesturing(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transformRef.current.x,
      ty: transformRef.current.y,
    };
  };

  const goPrev = () => {
    resetZoom();
    onNav((index - 1 + photos.length) % photos.length);
  };

  const goNext = () => {
    resetZoom();
    onNav((index + 1) % photos.length);
  };

  const isZoomed = transform.scale > 1.02;

  if (!mounted) return null;

  return createPortal(
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[200] flex items-center justify-center overscroll-none touch-none bg-black"
      style={{
        width: "100vw",
        height: "100dvh",
        minHeight: "100vh",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-10"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="bg-black/60 text-white text-xs font-mono px-3 py-1 rounded-full">
          {index + 1}/{photos.length}
        </div>
      </div>

      <div
        className="absolute left-4 flex flex-col gap-2 z-10"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          className="h-11 w-11 rounded-full bg-white/15 active:bg-white/25 text-white flex items-center justify-center transition-colors disabled:opacity-40"
          disabled={transform.scale >= MAX_SCALE}
          onClick={(e) => { e.stopPropagation(); zoomBy(ZOOM_STEP); }}
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="h-11 w-11 rounded-full bg-white/15 active:bg-white/25 text-white flex items-center justify-center transition-colors disabled:opacity-40"
          disabled={transform.scale <= MIN_SCALE}
          onClick={(e) => { e.stopPropagation(); zoomBy(-ZOOM_STEP); }}
        >
          <ZoomOut className="h-5 w-5" />
        </button>
      </div>

      {photos.length > 1 && !isZoomed && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        ref={viewportRef}
        data-lightbox-viewport
        className="relative flex items-center justify-center w-[90vw] h-[85vh] max-h-[85dvh] touch-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {!activeReady && !activeFailed && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none">
            <div className="h-9 w-9 rounded-full border-2 border-white/25 border-t-white/80 animate-spin" />
          </div>
        )}
        {activeFailed && (
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 pointer-events-none text-white/70">
            <p className="text-sm font-medium">{t("report_no_photo_found")}</p>
          </div>
        )}
        {bufferIndices.map((i) => {
          const src = photos[i];
          if (!src) return null;
          const isActive = i === index;
          return (
            <img
              key={`${i}-${src}`}
              ref={isActive ? imageRef : undefined}
              src={src}
              alt={isActive ? `Photo ${index + 1}` : ""}
              aria-hidden={!isActive}
              className={cn(
                "max-h-[85dvh] max-w-[90vw] rounded-xl object-contain shadow-2xl select-none will-change-transform",
                isActive ? "relative z-[2]" : "absolute inset-0 m-auto opacity-0 pointer-events-none",
                isActive && (isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"),
                isActive && !activeReady && !activeFailed && "opacity-0",
                isActive && activeFailed && "opacity-0",
              )}
              style={
                isActive
                  ? {
                      transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
                      transition: isGesturing ? "none" : "transform 0.15s ease-out",
                    }
                  : undefined
              }
              draggable={false}
              decoding="async"
              referrerPolicy="no-referrer"
              loading={isActive || i === (index + 1) % photos.length ? "eager" : "lazy"}
              fetchPriority={isActive ? "high" : "low"}
              onLoad={() => {
                markVinImageSessionLoaded(src);
                if (!isActive) return;
                setActiveFailed(false);
                setActiveReady(true);
                if (transformRef.current.scale > 1.02) {
                  applyTransform({ ...transformRef.current });
                }
              }}
              onError={() => {
                if (!isActive) return;
                setActiveFailed(true);
                setActiveReady(false);
              }}
              onMouseDown={isActive ? handleMouseDown : undefined}
              onDoubleClick={
                isActive
                  ? (e) => {
                      e.stopPropagation();
                      if (transform.scale > 1.05) resetZoom();
                      else applyTransform({ scale: DOUBLE_TAP_SCALE, x: 0, y: 0 });
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    </motion.div>,
    document.body,
  );
}
