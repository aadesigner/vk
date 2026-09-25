import { cn } from "@/lib/utils";

/**
 * Suspense placeholder for lazy routes rendered *inside* Layout.
 * Content only — no fake sticky header (that double-chrome flicker under the real nav).
 */
export function RouteShellFallback({ className }: { className?: string }) {
  return (
    <div className={cn("bg-background", className)} aria-hidden>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14 space-y-6">
        <div className="h-10 w-2/3 max-w-xl rounded-xl bg-muted/60 animate-pulse" />
        <div className="h-5 w-full max-w-2xl rounded-lg bg-muted/40 animate-pulse" />
        <div className="h-5 w-5/6 max-w-xl rounded-lg bg-muted/35 animate-pulse" />
        <div className="h-40 sm:h-52 w-full rounded-2xl bg-muted/30 animate-pulse mt-4" />
      </div>
    </div>
  );
}
