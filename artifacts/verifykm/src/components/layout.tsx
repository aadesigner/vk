import { useState, useEffect, useRef, useCallback, useLayoutEffect, useSyncExternalStore, type CSSProperties, type Dispatch, type MouseEvent as ReactMouseEvent, type MutableRefObject, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { PrefetchLink } from "@/components/prefetch-link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation, ensureDict } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  User, Shield, LogOut, HelpCircle, FileText,
  ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Footer } from "@/components/footer";
import { VerifyKMLogo } from "@/components/logo";
import { BannedSessionRedirect } from "@/components/banned-session-redirect";
import { cn } from "@/lib/utils";
import { setStoredLangPreference } from "@/lib/lang-preference";
import { AnnouncementBar } from "@/components/announcement-bar";
import { ClientMobileNav, useShowClientMobileNav, CLIENT_MOBILE_NAV_PADDING } from "@/components/client-mobile-nav";
import { CountryNavMenuGroups } from "@/components/nav-country-menu";
import { NavbarMobileMenu } from "@/components/navbar-mobile-menu";
import { LANG_PICKER_OPTIONS, isSupportedLang, type Language } from "@/lib/languages";
import { pathFor, remapPathForLang, resolveRest, CARS_SEGMENT, pageSlug, type PageId } from "@/lib/localized-routes";
import { dashboardPath } from "@/lib/dashboard-nav";
import { FlagImg } from "@/components/flag-img";
import { formatImageFlagAlt } from "@/lib/flag-alt";
import { LangPickerList, usePrefetchPickerFlags } from "@/components/lang-picker-list";
import { NavAssetWarmup } from "@/components/nav-asset-warmup";
import { prefetchNavMenuAssets } from "@/lib/nav-assets";
import { prefetchCountryPages, prefetchAuthAreaRoutes, prefetchRoute, prefetchCommonRoutes } from "@/lib/prefetch-route";
import { clearLeakedAdminDocumentStyles } from "@/lib/admin-revenue-mood";
import { shouldDeferHeavyClientWarmup } from "@/hooks/use-light-motion";

const LANGS = LANG_PICKER_OPTIONS.map((l) => ({
  code: l.code,
  label: l.label,
  short: l.short,
  img: l.flag,
}));

/** Country dropdown — compact list panel (solid fill, no blur). */
const NAV_COUNTRY_PANEL = cn(
  "rounded-xl border border-border/80 bg-background shadow-lg shadow-black/8",
  "overflow-hidden",
);

/** User menu — solid fill for snappy open (same idea as country mega). */
const NAV_USER_MENU_PANEL = cn(
  "rounded-2xl border border-border/80 bg-background shadow-xl shadow-black/10",
  "overflow-hidden",
);

/** Positions panel below trigger; pt-2 bridges the gap for hover travel. */
const NAV_DROPDOWN_ANCHOR = "absolute top-full z-[110] pt-2";

type NavDropdownKey = "country" | "user";

function navDropdownHoverProps(
  key: NavDropdownKey,
  timers: MutableRefObject<Record<NavDropdownKey, ReturnType<typeof setTimeout> | null>>,
  setOpen: Dispatch<SetStateAction<boolean>>,
  closeOthers: () => void,
  delayMs = 0,
) {
  return {
    onMouseEnter: () => {
      const timer = timers.current[key];
      if (timer) {
        clearTimeout(timer);
        timers.current[key] = null;
      }
      closeOthers();
      setOpen(true);
    },
    onMouseLeave: () => {
      const existing = timers.current[key];
      if (existing) clearTimeout(existing);
      timers.current[key] = setTimeout(() => {
        timers.current[key] = null;
        setOpen(false);
      }, delayMs);
    },
  };
}

/** Desktop dropdown triggers — hover opens via parent wrapper; click must not toggle. */
function navDropdownTriggerProps(open: boolean, label?: string) {
  return {
    type: "button" as const,
    tabIndex: -1,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    ...(label ? { "aria-label": label } : {}),
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => e.preventDefault(),
  };
}

/** True when hover menus are safe (desktop). Touch devices synthesize mouseleave and close instantly. */
function subscribeFinePointer(onChange: () => void) {
  const fine = window.matchMedia("(pointer: fine)");
  const hover = window.matchMedia("(hover: hover)");
  fine.addEventListener("change", onChange);
  hover.addEventListener("change", onChange);
  return () => {
    fine.removeEventListener("change", onChange);
    hover.removeEventListener("change", onChange);
  };
}

function getFinePointer() {
  return window.matchMedia("(pointer: fine)").matches
    && window.matchMedia("(hover: hover)").matches;
}

function useFinePointerHover() {
  return useSyncExternalStore(subscribeFinePointer, getFinePointer, () => false);
}

function MobileLangPicker({
  language,
  onLanguageChange,
  isDarkNav,
  mobileMenuOpen = false,
}: {
  language: string;
  onLanguageChange: (code: string) => void;
  isDarkNav: boolean;
  mobileMenuOpen?: boolean;
}) {
  const { t } = useTranslation();
  const finePointer = useFinePointerHover();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const clearHoverClose = useCallback(() => {
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(288, window.innerWidth - margin * 2);
    // Center under the language trigger, clamped to the viewport.
    const centerX = rect.left + rect.width / 2;
    let left = centerX - width / 2;
    left = Math.min(Math.max(left, margin), window.innerWidth - margin - width);
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left,
      width,
      zIndex: 130,
    });
  }, []);

  const close = useCallback(() => {
    clearHoverClose();
    setOpen(false);
  }, [clearHoverClose]);

  const openMenu = useCallback(() => {
    clearHoverClose();
    updateMenuPosition();
    setOpen(true);
  }, [clearHoverClose, updateMenuPosition]);

  const scheduleClose = useCallback(() => {
    if (!finePointer) return;
    clearHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      hoverCloseTimer.current = null;
      setOpen(false);
    }, 120);
  }, [clearHoverClose, finePointer]);

  useEffect(() => () => clearHoverClose(), [clearHoverClose]);

  useEffect(() => {
    if (mobileMenuOpen) close();
  }, [mobileMenuOpen, close]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReflow = () => updateMenuPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  usePrefetchPickerFlags(open);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!open) {
      updateMenuPosition();
      setOpen(true);
    } else {
      close();
    }
  };

  const current = LANGS.find((l) => l.code === language);
  const hoverProps = finePointer
    ? { onMouseEnter: openMenu, onMouseLeave: scheduleClose }
    : {};

  const menu = mounted
    ? createPortal(
        <AnimatePresence>
          {open && (
              <motion.div
                ref={menuRef}
                role="menu"
                aria-label="Language"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{ ...menuStyle, transformOrigin: "top center" }}
                className="rounded-2xl border border-border/80 bg-background shadow-2xl shadow-black/15 p-2"
                {...hoverProps}
              >
                <LangPickerList
                  language={language as Language}
                  layout="mobile"
                  hrefForLanguage={(code) =>
                    remapPathForLang(
                      typeof window !== "undefined"
                        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                        : `/${language}`,
                      language as Language,
                      code,
                    )
                  }
                  onSelect={(code) => {
                    close();
                    requestAnimationFrame(() => onLanguageChange(code));
                  }}
                />
              </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <div className="relative" {...hoverProps}>
      <button
        ref={btnRef}
        type="button"
        title={current?.label ?? language}
        aria-label={current?.label ?? language}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-1 px-2 font-medium tracking-wide transition-colors duration-75 outline-none h-9 text-[15px]",
          open
            ? isDarkNav
              ? "text-white"
              : "text-foreground"
            : isDarkNav
              ? "text-white/60 hover:text-white"
              : "text-foreground/65 hover:text-foreground",
        )}
      >
        <FlagImg code={current?.img ?? "gb"} variant="nav" size={18} priority alt={formatImageFlagAlt(current?.label ?? language, t)} />
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-100",
            isDarkNav ? "text-white/40" : "text-muted-foreground",
            open && "rotate-180",
          )}
        />
      </button>
      {menu}
    </div>
  );
}

export function Navbar({ announcementOffset = 0 }: { announcementOffset?: number }) {
  const { t, language, setLanguage } = useTranslation();
  const [location, setLocation] = useLocation();
  const { isSignedIn, isLoaded, user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== "undefined" ? window.scrollY > 16 : false,
  );
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [userOpen, setUserOpen]       = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const userRef    = useRef<HTMLDivElement>(null);
  const hoverCloseTimers = useRef<Record<NavDropdownKey, ReturnType<typeof setTimeout> | null>>({
    country: null,
    user: null,
  });

  const closeUser = useCallback(() => {
    setUserOpen(false);
  }, []);

  const closeCountry = useCallback(() => {
    setCountryOpen(false);
  }, []);

  useEffect(() => () => {
    for (const key of Object.keys(hoverCloseTimers.current) as NavDropdownKey[]) {
      const timer = hoverCloseTimers.current[key];
      if (timer) clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // After first paint — avoid competing with logo/hero on cold mobile loads.
    // Phones still get this small same-origin set (flags + wordmarks); only delayed longer.
    const delayMs = shouldDeferHeavyClientWarmup() ? 1_600 : 800;
    const id = window.setTimeout(() => {
      prefetchNavMenuAssets();
    }, delayMs);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!countryOpen) return;
    prefetchCountryPages();
  }, [countryOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    // Don't compete with the open animation — warm routes after the frame settles.
    // Light devices: skip — menu open already feels heavy enough.
    if (shouldDeferHeavyClientWarmup()) return;
    const run = () => {
      prefetchCommonRoutes();
      prefetchCountryPages();
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(run, 280);
    }
    return () => {
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [mobileOpen]);

  useEffect(() => {
    let ticking = false;
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 16);
        ticking = false;
      });
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const close = (e: globalThis.MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryOpen(false);
      if (userRef.current    && !userRef.current.contains(e.target as Node))    setUserOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLanguageChange = (lang: string) => {
    if (!isSupportedLang(lang)) return;
    const next: Language = lang;
    const target = remapPathForLang(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
      language,
      next,
    );
    void ensureDict(next)
      .catch(() => {
        // Still switch language — English fallback strings apply if locale bundle failed.
      })
      .finally(() => {
        setStoredLangPreference(next);
        setLanguage(next);
        setLocation(target);
        setMobileOpen(false);
      });
  };

  const handleLogout = async () => {
    await logout();
    setLocation(`/${language}`);
    setMobileOpen(false);
    setUserOpen(false);
  };

  const closeMenus = () => {
    setUserOpen(false);
    setMobileOpen(false);
  };

  const isAdmin     = user?.isAdmin === true;
  const isOnPage = (seg: string) => {
    const pathOnly = (location.split("?")[0] ?? location).replace(/\/$/, "") || "/";
    const rest = pathOnly.replace(new RegExp(`^/${language}`), "") || "";
    const resolved = resolveRest(rest, language);
    if (seg === "cars" || seg.startsWith("cars/")) {
      if (resolved.kind !== "country") return false;
      if (seg === "cars") return true;
      return resolved.country === seg.slice("cars/".length);
    }
    if (seg === "blog") {
      return resolved.kind === "blog_post" || (resolved.kind === "page" && resolved.page === "blog");
    }
    const pageMap: Record<string, PageId> = {
      "how-it-works": "how_it_works",
      pricing: "pricing",
      faq: "faq",
      "sign-in": "sign_in",
      "sign-up": "sign_up",
      "forgot-password": "forgot_password",
      "reset-password": "reset_password",
      "set-password": "set_password",
      dashboard: "dashboard",
      purchases: "purchases",
      checkout: "checkout",
    };
    const page = pageMap[seg];
    if (page && resolved.kind === "page") return resolved.page === page;
    // Also match English or localized slug literally
    if (page) {
      const locSlug = pageSlug(language, page === "how_it_works" ? "how_it_works" : page as any);
      if (pathOnly.includes(`/${locSlug}`)) return true;
    }
    return pathOnly.includes(`/${seg}`);
  };
  const isHome      = /^\/[a-z]{2}\/?$/.test(location.split("?")[0] ?? location) || location === "/";
  const isCountry   = (() => {
    const pathOnly = (location.split("?")[0] ?? location);
    const rest = pathOnly.replace(new RegExp(`^/${language}`), "") || "";
    return resolveRest(rest, language).kind === "country"
      || pathOnly.includes(`/${CARS_SEGMENT[language]}/`);
  })();
  const isHeroTransparentNav = isHome || isCountry || isOnPage("pricing");
  const isAuthNavPage =
    isOnPage("sign-in")
    || isOnPage("sign-up")
    || isOnPage("forgot-password")
    || isOnPage("reset-password")
    || isOnPage("set-password");
  // Always dark chrome — white VerifyKM wordmark needs a dark bar on every page.
  const isDarkNav = true;

  useEffect(() => {
    if (!userOpen) return;
    prefetchAuthAreaRoutes();
    if (isAdmin) prefetchRoute("adminx");
  }, [userOpen, isAdmin]);

  const currentLang  = LANGS.find(l => l.code === language);
  const displayName  = user?.name ?? user?.email?.split("@")[0] ?? "";
  const avatarInitial = displayName?.[0]?.toUpperCase() ?? <User className="h-3 w-3" />;

  const navLink = (active: boolean) => cn(
    "relative inline-flex items-center gap-1.5 font-medium tracking-wide outline-none",
    "transition-[color,transform] duration-200 ease-out",
    scrolled ? "px-3.5 py-2 text-[15px]" : "px-4 py-2.5 text-[15px]",
    active
      ? "text-white"
      : "text-white/55 hover:text-white hover:-translate-y-px",
  );

  const navActiveMark = () => (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-3.5 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#33bbfd] to-[#0088d4]"
    />
  );

  const utilityClusterCls = "flex items-center gap-0.5";

  return (
    <header
      style={{ top: announcementOffset }}
      className={cn(
      "fixed inset-x-0 z-[100] w-full print:hidden",
      "md:transition-[border-color,background-color,box-shadow] md:duration-200",
      mobileOpen && "max-md:hidden",
      scrolled
        ? "bg-[#030712]/98 border-b border-[#00a5fd]/20 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        : "bg-[#030712]/92 border-b border-white/10 backdrop-blur-md",
    )}>
      <div className={cn(
        "max-w-[1400px] mx-auto px-5 flex justify-between items-center gap-4",
        "md:grid md:grid-cols-[auto_1fr_auto] md:gap-6",
        "h-[4.25rem] md:h-[5.25rem] md:transition-[height] md:duration-200 md:ease-out",
        scrolled && "md:h-[4.5rem]",
      )}>

        {/* ── Logo ── */}
        <div className="flex items-center min-w-0 md:justify-self-start">
          <PrefetchLink href={`/${language}`} className="flex items-center shrink-0 group -translate-y-px">
            <VerifyKMLogo
              syncDecode
              className={cn(
                "h-[43px] w-auto",
                scrolled ? "md:h-[47px]" : "md:h-[55px]",
              )}
            />
          </PrefetchLink>
        </div>

        {/* ── Centered nav links (desktop) — no box ── */}
        <div className="hidden md:flex items-center justify-center justify-self-center min-w-0">
          <nav className="inline-flex items-center gap-1.5" aria-label="Primary">
            <div
              ref={countryRef}
              className="relative"
              {...navDropdownHoverProps("country", hoverCloseTimers, setCountryOpen, closeUser)}
            >
              <button
                {...navDropdownTriggerProps(countryOpen, t("nav_country"))}
                className={cn(navLink(isOnPage("cars") || countryOpen))}
              >
                {t("nav_country")}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-75",
                    isDarkNav ? "text-white/35" : "text-muted-foreground/80",
                    countryOpen && "rotate-180",
                  )}
                />
                {(isOnPage("cars") || countryOpen) && navActiveMark()}
              </button>

              <div
                className={cn(
                  NAV_DROPDOWN_ANCHOR,
                  "left-1/2 -translate-x-1/2",
                  countryOpen ? "visible" : "invisible pointer-events-none",
                )}
                aria-hidden={!countryOpen}
              >
                <div className={cn(NAV_COUNTRY_PANEL, "w-[17rem] max-w-[calc(100vw-1.5rem)] p-0")}>
                  <CountryNavMenuGroups
                    language={language}
                    isActive={(slug) => isOnPage(`cars/${slug}`)}
                    onNavigate={() => setCountryOpen(false)}
                  />
                </div>
              </div>
            </div>

            <PrefetchLink href={pathFor(language, "how_it_works")} className={navLink(isOnPage("how-it-works"))}>
              {t("nav_how_it_works")}
              {isOnPage("how-it-works") && navActiveMark()}
            </PrefetchLink>
            <PrefetchLink href={pathFor(language, "pricing")} className={navLink(isOnPage("pricing"))}>
              {t("pricing")}
              {isOnPage("pricing") && navActiveMark()}
            </PrefetchLink>
            <PrefetchLink href={pathFor(language, "faq")} className={navLink(isOnPage("faq"))}>
              {t("nav_faq")}
              {isOnPage("faq") && navActiveMark()}
            </PrefetchLink>
            <PrefetchLink href={pathFor(language, "blog")} className={navLink(isOnPage("blog"))}>
              {t("nav_blog")}
              {isOnPage("blog") && navActiveMark()}
            </PrefetchLink>
          </nav>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-1.5 shrink-0 md:justify-self-end">
          <div className={utilityClusterCls}>
            <MobileLangPicker
              language={language}
              onLanguageChange={handleLanguageChange}
              isDarkNav={isDarkNav}
              mobileMenuOpen={mobileOpen}
            />
          </div>

          <div className="hidden md:flex items-center gap-2">
            <div className={cn("h-4 w-px", isDarkNav ? "bg-white/15" : "bg-border/70")} />

            {/* Auth / Check VIN */}
            {!isLoaded ? (
              <div className="h-9 w-24 rounded-lg bg-muted/80 animate-pulse" aria-hidden />
            ) : isSignedIn ? (
              <div
                ref={userRef}
                className="relative"
                {...navDropdownHoverProps("user", hoverCloseTimers, setUserOpen, closeCountry)}
              >
                <button
                  {...navDropdownTriggerProps(userOpen, displayName || t("my_reports"))}
                  className={cn(
                    "flex items-center gap-2 pl-1 pr-2 rounded-lg outline-none transition-colors duration-75 h-9 py-1",
                    userOpen
                      ? isDarkNav
                        ? "text-white"
                        : "text-foreground"
                      : isDarkNav
                        ? "text-white/75 hover:text-white"
                        : "text-foreground/75 hover:text-foreground",
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {avatarInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium tracking-wide max-w-[7.5rem] truncate hidden lg:block text-[15px]">
                    {displayName}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-75",
                      isDarkNav ? "text-white/40" : "text-muted-foreground",
                      userOpen && "rotate-180",
                    )}
                  />
                </button>

                <div
                  className={cn(
                    NAV_DROPDOWN_ANCHOR,
                    "right-0",
                    userOpen ? "visible" : "invisible pointer-events-none",
                  )}
                  aria-hidden={!userOpen}
                >
                  <div className={cn(NAV_USER_MENU_PANEL, "w-56 py-1.5")}>
                    <div className="px-4 py-3 border-b border-border/60 mb-1">
                      {user?.name && <p className="font-semibold text-sm truncate">{user.name}</p>}
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link
                      href={dashboardPath(language)}
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/60 rounded-md mx-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("my_reports")}
                    </Link>
                    <Link
                      href={dashboardPath(language, "help")}
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/60 rounded-md mx-1.5"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("help")}
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/adminx"
                        onClick={closeMenus}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted/60 rounded-md mx-1.5"
                      >
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("admin")}
                      </Link>
                    )}
                    <div className="border-t border-border/60 mt-1 pt-1 mx-1.5">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/8 rounded-md"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        {t("logout")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <PrefetchLink
                  href={pathFor(language, "sign_in")}
                  className={cn(
                    "inline-flex items-center px-2.5 h-9 text-[13px] font-medium tracking-wide transition-colors duration-75",
                    isDarkNav
                      ? "text-white/55 hover:text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("sign_in")}
                </PrefetchLink>
                <Button
                  size="sm"
                  className="h-9 px-3.5 text-[13px] font-semibold tracking-wide rounded-lg shadow-none transition-opacity duration-75 hover:opacity-90"
                  asChild
                >
                  <PrefetchLink href={`/${language}`}>{t("check_vin")}</PrefetchLink>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu */}
          <div className="md:hidden flex items-center gap-1.5">
            <NavbarMobileMenu
              open={mobileOpen}
              onOpenChange={setMobileOpen}
              language={language}
              isDarkNav={isDarkNav}
              isOnPage={isOnPage}
              isLoaded={isLoaded}
              isSignedIn={!!isSignedIn}
              isAdmin={isAdmin}
              user={user}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [announcementHeight, setAnnouncementHeight] = useState(0);
  const showClientNav = useShowClientMobileNav();

  // Admin themes used to write CSS vars onto <html>; scrub leftovers on public shell.
  useLayoutEffect(() => {
    clearLeakedAdminDocumentStyles();
  }, []);

  useLayoutEffect(() => {
    const apply = () => {
      // Match Navbar heights: h-[4.25rem] on mobile, h-[5.25rem] before scroll on desktop.
      const navbarHeight = window.matchMedia("(min-width: 768px)").matches
        ? "5.25rem"
        : "4.25rem";
      document.documentElement.style.setProperty(
        "--site-header-offset",
        `calc(${navbarHeight} + ${announcementHeight}px)`,
      );
      document.documentElement.style.setProperty(
        "--announcement-bar-height",
        `${announcementHeight}px`,
      );
    };
    apply();
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.style.removeProperty("--site-header-offset");
      document.documentElement.style.removeProperty("--announcement-bar-height");
    };
  }, [announcementHeight]);

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-clip w-full">
      <NavAssetWarmup />
      <BannedSessionRedirect />
      <AnnouncementBar onHeightChange={setAnnouncementHeight} />
      <Navbar announcementOffset={announcementHeight} />
      <div
        className={cn(
          "flex flex-col flex-1",
          showClientNav && `md:pb-0 ${CLIENT_MOBILE_NAV_PADDING}`,
        )}
      >
        <main className="overflow-x-hidden pt-[var(--site-header-offset,76px)] print:pt-0">
          {children}
        </main>
        <Footer />
      </div>
      <ClientMobileNav />
    </div>
  );
}
