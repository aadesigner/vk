import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { FileText, Search, User, HelpCircle, Tag } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { prefetchRouteFromHref } from "@/lib/prefetch-route";
import {
  dashboardPath,
  isDashboardLocation,
  isOffersLocation,
  normalizeClientPath,
  parseDashboardView,
} from "@/lib/dashboard-nav";

import { SUPPORTED_LANGS } from "@/lib/languages";
import { pathFor } from "@/lib/localized-routes";

const LANGS = new Set<string>(SUPPORTED_LANGS);

/** Pages where the logged-in bottom nav should not appear. */
export function isClientMobileNavExcluded(pathname: string): boolean {
  const path = normalizeClientPath(pathname);
  if (path.startsWith("/adminx")) return true;

  const segs = path.split("/").filter(Boolean);
  if (segs.length < 2 || !LANGS.has(segs[0])) return false;

  const section = segs[1];
  if (section === "checkout" || section === "vin") return true;
  if (
    section === "sign-in"
    || section === "sign-up"
    || section === "forgot-password"
    || section === "reset-password"
    || section === "set-password"
  ) {
    return true;
  }

  return false;
}

export function useShowClientMobileNav(): boolean {
  const { isSignedIn, isLoaded } = useAuth();
  const [location] = useLocation();
  return isLoaded && !!isSignedIn && !isClientMobileNavExcluded(location);
}

/** Space for the bottom client bar. */
export const CLIENT_MOBILE_NAV_PADDING = "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]";

type NavItem = {
  id: string;
  icon: typeof FileText;
  label: string;
  href: string;
  active: boolean;
};

export function ClientMobileNav() {
  const { t, language } = useTranslation();
  const { isSignedIn } = useAuth();
  const [location, setLocation] = useLocation();
  const show = useShowClientMobileNav();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentPath = normalizeClientPath(location);
  const isDashboard = isDashboardLocation(currentPath, language);
  const dashboardView = parseDashboardView(currentPath, language);
  const isHome = currentPath === `/${language}`;

  const isOffers = isOffersLocation(currentPath, language);

  const items: NavItem[] = [
    {
      id: "help",
      icon: HelpCircle,
      label: t("help"),
      href: dashboardPath(language, "help"),
      active: isDashboard && dashboardView === "help",
    },
    {
      id: "offers",
      icon: Tag,
      label: t("nav_offers"),
      href: pathFor(language, "pricing"),
      active: isOffers,
    },
    {
      id: "check-vin",
      icon: Search,
      label: t("check_vin"),
      href: `/${language}`,
      active: isHome,
    },
    {
      id: "reports",
      icon: FileText,
      label: t("my_reports"),
      href: dashboardPath(language),
      active: isDashboard && dashboardView === "reports",
    },
    {
      id: "account",
      icon: User,
      label: t("account"),
      href: dashboardPath(language, "account"),
      active: isDashboard && dashboardView === "account",
    },
  ];

  const navigateTo = useCallback((href: string) => {
    const target = normalizeClientPath(href);
    if (currentPath !== target) {
      setLocation(href);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPath, setLocation]);

  if (!show || !mounted) return null;

  const nav = (
    <nav
      aria-label="Main navigation"
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-40 print:hidden",
        "border-t border-white/10 bg-[#071018] text-white",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="relative mx-auto flex h-[3.75rem] max-w-lg items-stretch px-1">
        {items.map(({ id, icon: Icon, label, href, active }) => {
          const isCheckVin = id === "check-vin";

          return (
            <button
              key={id}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5",
                "touch-manipulation select-none",
                isCheckVin
                  ? "text-white"
                  : active
                    ? "text-[#7dd3fc]"
                    : "text-white/45 active:text-white",
              )}
              onPointerDown={() => {
                prefetchRouteFromHref(href, { isSignedIn });
              }}
              onClick={() => navigateTo(href)}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full",
                  isCheckVin
                    ? "h-8 w-8 bg-[#00a5fd] text-white shadow-[0_8px_16px_-8px_rgba(0,165,253,0.9)]"
                    : cn("h-6 w-6", active && "bg-[#00a5fd]/20"),
                )}
              >
                <Icon
                  className={cn("shrink-0 pointer-events-none", isCheckVin ? "h-4 w-4" : "h-4 w-4")}
                  strokeWidth={isCheckVin || active ? 2.25 : 1.75}
                />
              </span>
              <span
                className={cn(
                  "max-w-full truncate px-0.5 text-center text-[10px] leading-tight pointer-events-none",
                  isCheckVin || active ? "font-semibold" : "font-medium",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return createPortal(nav, document.body);
}
