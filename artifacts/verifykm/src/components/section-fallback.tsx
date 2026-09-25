import { cn } from "@/lib/utils";

export function SectionFallback({
  minHeight = 120,
  className,
}: {
  minHeight?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("w-full rounded-2xl bg-muted/25 animate-pulse", className)}
      style={{ minHeight }}
      aria-hidden
    />
  );
}
