import type { ReactNode } from "react";
import { pathFor } from "@/lib/localized-routes";
import { Link, useLocation } from "wouter";
import {
  FileText,
  Search,
  User,
  HelpCircle,
  ShoppingBag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useGetUserStats } from "@workspace/api-client-react";
import type { UserStats } from "@workspace/api-client-react";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { useClientAreaLiveRefresh } from "@/hooks/use-client-area-live-refresh";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  dashboardPath,
  parseClientAreaSection,
  type ClientAreaSection,
} from "@/lib/dashboard-nav";
import { CLIENT_AREA_QUERY_OPTIONS, orvalQuery } from "@/lib/query-options";

type NavItem = {
  id: ClientAreaSection;
  icon: LucideIcon;
  label: string;
  href: string;
};

type Props = {
  children: ReactNode;
  /** Page title, aligned to the left edge of the desktop shell. */
  heading?: ReactNode;
  /** Renders above the client shell (e.g. pending VIN banner). */
  before?: ReactNode;
  className?: string;
};

function ClientAreaUserStats({
  credits,
  reports,
  compact = false,
  onLight = false,
}: {
  credits: number;
  reports: number | undefined;
  compact?: boolean;
  onLight?: boolean;
}) {
  const { t } = useTranslation();
  const showCredits = credits > 0;
  if (!showCredits && reports == null) return null;

  const tileClass = onLight
    ? "min-w-0 rounded-lg border px-2.5 py-1.5"
    : compact
      ? "min-w-0 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5"
      : "min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5";

  return (
    <div className={cn("grid gap-1.5", showCredits && reports != null ? "grid-cols-2" : "grid-cols-1")}>
      {showCredits ? (
        <div
          className={cn(tileClass, onLight ? "border-[#00a5fd]/20 bg-[#eef8fd]" : "border-[#00a5fd]/30 bg-[#00a5fd]/12")}
          title={t("dashboard_stat_credits_tooltip")}
        >
          <p className={cn(
            "font-black tabular-nums leading-none",
            onLight ? "text-base text-[#071018]" : compact ? "text-lg text-white" : "text-[1.65rem] text-white",
          )}>
            {credits}
          </p>
          <p className={cn(
            "mt-0.5 font-semibold uppercase tracking-[0.12em]",
            onLight ? "text-[9px] text-[#0088d4]" : compact ? "text-[9px] text-[#7dd3fc]" : "text-[10px] text-[#7dd3fc]",
          )}>
            {t("dashboard_stat_credits_ready")}
          </p>
        </div>
      ) : null}
      {reports != null ? (
        <div className={cn(tileClass, onLight && "border-slate-200 bg-slate-50")}>
          <p className={cn(
            "font-black tabular-nums leading-none",
            onLight ? "text-base text-[#071018]" : compact ? "text-lg text-white" : "text-[1.65rem] text-white",
          )}>
            {reports}
          </p>
          <p className={cn(
            "mt-0.5 font-semibold uppercase tracking-[0.12em]",
            onLight ? "text-[9px] text-slate-500" : compact ? "text-[9px] text-white/45" : "text-[10px] text-white/45",
          )}>
            {t("dashboard_stat_dossiers")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ClientAreaLayout({ children, heading, before, className }: Props) {
  const { t, language } = useTranslation();
  const { user, isSignedIn } = useAuth();
  const [location] = useLocation();
  const activeSection = parseClientAreaSection(location, language);
  const { data: stats } = useGetUserStats({
    query: { enabled: Boolean(isSignedIn), ...orvalQuery<UserStats>(CLIENT_AREA_QUERY_OPTIONS) },
  });

  useClientAreaLiveRefresh();
  const creditBalance = user?.creditBalance ?? 0;
  const totalReports = stats?.totalChecks;

  const navItems: NavItem[] = [
    { id: "reports", icon: FileText, label: t("my_reports"), href: dashboardPath(language, "reports") },
    { id: "purchases", icon: ShoppingBag, label: t("purchases_title"), href: pathFor(language, "purchases") },
    { id: "account", icon: User, label: t("account"), href: dashboardPath(language, "account") },
    { id: "help", icon: HelpCircle, label: t("help"), href: dashboardPath(language, "help") },
  ];

  const displayName = user?.name?.trim() || t("account");

  return (
    <div className={cn("w-full min-h-[50vh] pb-12 md:pb-16", className)}>
      {before}

      <div className="bg-[#071018] text-white md:hidden">
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 scrollbar-none" aria-label={t("account")}>
          {navItems.map(({ id, icon: Icon, label, href }) => {
            const isActive = activeSection === id;
            return (
              <Link
                key={id}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                  isActive ? "bg-[#00a5fd] text-white" : "bg-white/8 text-white/65",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto w-full max-w-6xl md:px-8 md:pt-10">
        {heading ? (
          <div className="px-4 pb-1 pt-4 text-left md:px-0 md:pb-7 md:pt-0">
            <div className="mb-3 md:hidden">
              <ClientAreaUserStats credits={creditBalance} reports={totalReports} compact onLight />
            </div>
            {heading}
          </div>
        ) : null}

        <div className="flex items-start gap-10">
        <aside className="sticky top-[calc(var(--site-header-offset,76px)+1rem)] hidden w-[16.5rem] shrink-0 self-start overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#071018] text-white shadow-[0_24px_50px_-32px_rgba(0,0,0,0.7)] md:block">
          <div className="h-1 bg-gradient-to-r from-[#0077c8] via-[#00a5fd] to-[#7dd3fc]" />

          <Link
            href={dashboardPath(language, "account")}
            aria-label={t("account")}
            className="flex items-center gap-3 px-4 py-4 hover:bg-white/[0.04]"
          >
            <Avatar className="h-9 w-9 ring-1 ring-white/15">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name || ""} />
              <AvatarFallback className="bg-white/10 text-white">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{displayName}</span>
              {user?.email ? (
                <span className="block truncate text-[11px] text-white/45">{user.email}</span>
              ) : null}
            </span>
          </Link>

          <div className="px-3 pb-3">
            <ClientAreaUserStats credits={creditBalance} reports={totalReports} />
          </div>

          <nav className="flex flex-col gap-0.5 px-2 pb-2" aria-label={t("account")}>
            {navItems.map(({ id, icon: Icon, label, href }) => {
              const isActive = activeSection === id;
              return (
                <Link
                  key={id}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-[#00a5fd]/15 text-white"
                      : "text-white/55 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  {isActive ? (
                    <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-[#00a5fd]" />
                  ) : null}
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#7dd3fc]" : "text-white/40")} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-3 pt-1">
            <Button asChild className="h-10 w-full gap-2 rounded-xl font-semibold">
              <Link href={`/${language}`}>
                <Search className="h-4 w-4" />
                {t("check_vin")}
              </Link>
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {children}
        </div>
        </div>
      </div>
    </div>
  );
}
