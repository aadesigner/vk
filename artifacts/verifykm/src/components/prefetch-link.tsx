import { Link } from "wouter";
import { prefetchRouteFromHref } from "@/lib/prefetch-route";
import { prefetchVinFromHref } from "@/lib/prefetch-vin-report";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";

type Props = {
  to?: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  role?: string;
  "aria-label"?: string;
  "aria-current"?: "page" | "step" | "location" | "date" | "time" | "true" | "false" | boolean;
};

/** wouter Link that prefetches the target page chunk (and VIN data when applicable) on hover/focus. */
export function PrefetchLink({
  to,
  href,
  children,
  className,
  onClick,
  role,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
}: Props) {
  const { isSignedIn } = useAuth();
  const path = to ?? href ?? "";

  const warmHref = () => {
    prefetchRouteFromHref(path, { isSignedIn });
    prefetchVinFromHref(queryClient, path, { isSignedIn });
  };

  const scheduleWarmHref = () => {
    if (typeof window === "undefined") return;
    const run = () => warmHref();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 120 });
    } else {
      globalThis.setTimeout(run, 0);
    }
  };

  return (
    <Link
      to={path}
      className={className}
      role={role}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onMouseEnter={scheduleWarmHref}
      onFocus={scheduleWarmHref}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
