import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import { ChevronUp, CreditCard, FileText, HelpCircle, LogOut, Shield, User, X } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifyKMLogo } from "@/components/logo";
import { CountryNavMenuGroups } from "@/components/nav-country-menu";
import { dashboardPath } from "@/lib/dashboard-nav";
import { prefetchNavMenuAssets } from "@/lib/nav-assets";
import { cn } from "@/lib/utils";
import { pathFor } from "@/lib/localized-routes";

const MobileMenuToggle = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    open: boolean;
    isDarkNav: boolean;
    label: string;
  }
>(({ open, isDarkNav, label, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    aria-expanded={open}
    className={cn(
      "md:hidden relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full touch-manipulation transition-colors duration-75 active:scale-95",
      open
        ? "bg-primary/12 text-primary"
        : isDarkNav
          ? "text-white/85 hover:bg-white/10 hover:text-white"
          : "text-foreground/70 hover:bg-muted/90 hover:text-foreground",
      className,
    )}
    {...props}
  >
    <span className="relative block h-3.5 w-[17px]" aria-hidden>
      <span
        className={cn(
          "absolute left-0 block h-[1.5px] w-[17px] rounded-full bg-current transition-transform duration-100 ease-out",
          open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0",
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-1/2 block h-[1.5px] w-[17px] -translate-y-1/2 rounded-full bg-current transition-opacity duration-75",
          open ? "opacity-0" : "opacity-100",
        )}
      />
      <span
        className={cn(
          "absolute left-0 block h-[1.5px] w-[17px] rounded-full bg-current transition-transform duration-100 ease-out",
          open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0",
        )}
      />
    </span>
  </button>
));
MobileMenuToggle.displayName = "MobileMenuToggle";

function MenuLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active?: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center border-b border-border/40 text-[15px] font-medium touch-manipulation",
        active ? "text-primary" : "text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

type NavbarMobileMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  isDarkNav: boolean;
  isOnPage: (seg: string) => boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  user?: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  onLogout: () => void;
};

export function NavbarMobileMenu({
  open,
  onOpenChange,
  language,
  isDarkNav,
  isOnPage,
  isLoaded,
  isSignedIn,
  isAdmin,
  user,
  onLogout,
}: NavbarMobileMenuProps) {
  const { t } = useTranslation();
  const [accountOpen, setAccountOpen] = useState(false);
  const close = () => onOpenChange(false);
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "";
  const avatarInitial = displayName?.[0]?.toUpperCase() || <User className="h-3.5 w-3.5" />;

  useEffect(() => {
    if (!open) setAccountOpen(false);
  }, [open]);

  const siteLinks = [
    { href: pathFor(language, "how_it_works"), seg: "how-it-works" as const, label: t("nav_how_it_works") },
    { href: pathFor(language, "pricing"), seg: "pricing" as const, label: language === "sq" ? t("pricing_mobile") : t("pricing") },
    { href: pathFor(language, "faq"), seg: "faq" as const, label: t("nav_faq") },
    { href: pathFor(language, "blog"), seg: "blog" as const, label: t("nav_blog") },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <MobileMenuToggle
          open={open}
          isDarkNav={isDarkNav}
          label={open ? t("nav_close_menu") : t("nav_open_menu")}
          onPointerDown={prefetchNavMenuAssets}
        />
      </SheetTrigger>

      <SheetContent
        side="right"
        speed="fast"
        overlayClassName="z-[110]"
        className={cn(
          "z-[110] inset-0 left-0 right-0 w-auto max-w-none sm:max-w-none gap-0 p-0 flex flex-col overflow-hidden",
          "h-[100dvh] max-h-[100dvh] border-0 bg-background shadow-none",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex h-[4.25rem] shrink-0 items-center justify-between border-b border-white/10 bg-[#030712] px-5">
          <Link href={`/${language}`} onClick={close} className="flex items-center">
            <VerifyKMLogo variant="dark" className="h-11" syncDecode />
          </Link>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10"
            aria-label={t("nav_close_menu")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <div className="px-4 pt-4 pb-3">
            <Button
              className="mx-auto flex h-11 w-full rounded-xl text-[15px] font-semibold"
              asChild
            >
              <Link href={`/${language}`} onClick={close} className="justify-center">
                {t("check_vin")}
              </Link>
            </Button>
          </div>

          <nav className="px-4" aria-label="Site">
            {siteLinks.map(({ href, seg, label }) => (
              <MenuLink
                key={seg}
                href={href}
                active={isOnPage(seg)}
                onNavigate={close}
              >
                {label}
              </MenuLink>
            ))}
          </nav>

          <div className="px-4 pt-4 pb-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("nav_country")}
            </p>
            <CountryNavMenuGroups
              language={language}
              layout="grid"
              isActive={(slug) => isOnPage(`cars/${slug}`)}
              onNavigate={close}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-border/50 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          {!isLoaded ? (
            <div className="h-16 rounded-xl bg-muted/60 animate-pulse" aria-hidden />
          ) : isSignedIn ? (
            <div className="space-y-2.5">
              <div className={cn("grid gap-2", isAdmin ? "grid-cols-2" : "grid-cols-1")}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full rounded-lg text-[13px] font-medium justify-center gap-1.5"
                  asChild
                >
                  <Link href={dashboardPath(language)} onClick={close}>
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    {t("my_reports")}
                  </Link>
                </Button>
                {isAdmin ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full rounded-lg text-[13px] font-medium justify-center gap-1.5"
                    asChild
                  >
                    <Link href="/adminx" onClick={close}>
                      <Shield className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      {t("admin")}
                    </Link>
                  </Button>
                ) : null}
              </div>

              <div className="relative min-w-0 overflow-visible rounded-2xl border border-[#d7e9f6] bg-gradient-to-br from-[#eef8fd] to-white p-2.5 shadow-[0_10px_24px_-18px_rgba(7,52,84,0.45)]">
                <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-[#073454] text-sm font-bold text-white">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>

                <div className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((v) => !v)}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    className={cn(
                      "flex w-full min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left touch-manipulation",
                      "active:bg-white/70",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold leading-tight text-slate-950">
                        {displayName || user?.email}
                      </p>
                      {user?.email ? (
                        <p className="mt-1 truncate text-[11px] font-medium leading-none text-[#0088d4]">
                          {user.email}
                        </p>
                      ) : null}
                    </div>
                    <ChevronUp
                      className={cn(
                        "h-4 w-4 shrink-0 text-[#0088d4] transition-transform duration-200",
                        accountOpen ? "rotate-0" : "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>

                  {accountOpen ? (
                    <div
                      role="menu"
                      className={cn(
                        "absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden",
                        "rounded-xl border border-border/70 bg-popover shadow-lg shadow-black/10",
                        "ring-1 ring-black/5 dark:ring-white/10",
                      )}
                    >
                      <div className="p-1">
                        <Link
                          href={pathFor(language, "purchases")}
                          role="menuitem"
                          onClick={() => {
                            setAccountOpen(false);
                            close();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium text-foreground touch-manipulation active:bg-muted"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5" />
                          </span>
                          {t("purchases_title")}
                        </Link>
                        <Link
                          href={dashboardPath(language, "help")}
                          role="menuitem"
                          onClick={() => {
                            setAccountOpen(false);
                            close();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] font-medium text-foreground touch-manipulation active:bg-muted"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </span>
                          {t("help_title")}
                        </Link>
                      </div>
                      <div className="border-t border-border/50 p-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setAccountOpen(false);
                            onLogout();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium text-red-600 touch-manipulation active:bg-red-500/10 dark:text-red-400"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                            <LogOut className="h-3.5 w-3.5" />
                          </span>
                          {t("logout")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-lg text-sm font-medium"
                asChild
              >
                <Link href={pathFor(language, "sign_in")} onClick={close} className="justify-center">
                  {t("sign_in")}
                </Link>
              </Button>
              <Button className="h-10 rounded-lg text-sm font-semibold" asChild>
                <Link href={pathFor(language, "sign_up")} onClick={close} className="justify-center">
                  {t("sign_up")}
                </Link>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
