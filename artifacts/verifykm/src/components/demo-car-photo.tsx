import { useEffect, useRef, useState } from "react";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  /** Active carousel / hero slides should load immediately. */
  eager?: boolean;
  placeholderClassName?: string;
};

const MAX_RETRIES = 2;

/**
 * Demo car image with per-URL failure tracking (avoids carousel stale onError bugs).
 */
export function DemoCarPhoto({
  src,
  alt,
  className,
  eager = false,
  placeholderClassName,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setFailed(false);
    setRetry(0);
    return () => {
      mountedRef.current = false;
    };
  }, [src]);

  if (!src?.trim() || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted/35 dark:bg-white/[0.04]",
          placeholderClassName,
        )}
        aria-hidden={!alt}
      >
        <Car className="h-10 w-10 text-muted-foreground/25 dark:text-white/15" />
      </div>
    );
  }

  const imgSrc = retry > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${retry}` : src;

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={cn(
        "h-full w-full min-h-full min-w-full object-cover object-[center_58%]",
        className,
      )}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      onLoad={() => {
        if (!mountedRef.current) return;
        setFailed(false);
      }}
      onError={(e) => {
        if (!mountedRef.current) return;
        const img = e.currentTarget;
        if (img.naturalWidth > 0) return;
        if (retry < MAX_RETRIES) {
          setRetry((n) => n + 1);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

/** Warm the browser cache for a list of demo photo URLs. */
export function preloadDemoCarPhotos(urls: string[]) {
  for (const url of urls) {
    if (!url?.trim()) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}
