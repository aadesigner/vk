import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionFallback } from "@/components/section-fallback";

type Props = {
  children: ReactNode;
  /** Reserve space before mount to limit layout shift. */
  minHeight?: number;
  rootMargin?: string;
  className?: string;
};

/** Mount children when the placeholder nears the viewport — keeps first paint light. */
export function DeferredSection({
  children,
  minHeight,
  rootMargin = "280px 0px",
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={!visible && minHeight != null ? { minHeight } : undefined}
    >
      {visible ? children : minHeight != null ? (
        <SectionFallback minHeight={minHeight} className="rounded-none bg-muted/15" />
      ) : null}
    </div>
  );
}
