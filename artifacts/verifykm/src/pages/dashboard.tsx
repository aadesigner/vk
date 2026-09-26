import { useState } from "react";
import { useTranslation } from "@/i18n/context";
import { DashboardReportList, DASHBOARD_REPORTS_PER_PAGE } from "@/components/dashboard-report-list";
import { ClientAreaLayout } from "@/components/client-area-layout";
import { prefetchVinPageChunk, seedVinLookupsFromHistory } from "@/lib/prefetch-vin-report";
import { warmVinImages } from "@/lib/vin-image-cache";
import {
  useGetUserStats,
  useDeleteUserVinLookup,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { CLIENT_AREA_QUERY_OPTIONS, orvalQuery } from "@/lib/query-options";
import type { UserStats } from "@workspace/api-client-react";
import {
  fetchUserHistory,
  userHistoryQueryKey,
  type UserHistoryParams,
} from "@/lib/user-history-api";
import { useAuth } from "@/lib/auth-context";
import { useLocation, Link } from "wouter";
import { useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SiteFaqAccordion } from "@/components/site-faq-accordion";
import {
  FileText, Search, FolderOpen,
  AlertCircle, User, HelpCircle,
  ShieldCheck, Zap, Instagram, Globe, Loader2, Phone, PartyPopper,
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion-variants";
import { cn } from "@/lib/utils";
import { SEOHead, usePageSeo } from "@/components/seo";
import { UserCountrySelect } from "@/components/user-country-select";
import { UserPhoneFields } from "@/components/user-phone-fields";
import { FlagImg } from "@/components/flag-img";
import { userCountryLabel } from "@/lib/user-countries";
import { formatPhoneDisplay } from "@/lib/user-phone";
import { Label } from "@/components/ui/label";
import {
  buildPrefillOnlyCheckoutPath,
  clearStoredPendingVin,
  isEligiblePendingVin,
  readStoredPendingVin,
  type PendingVinPeek,
} from "@/lib/checkout-vin-flow";
import {
  dashboardPath,
  parseDashboardView,
  normalizeClientPath,
  type DashboardView,
} from "@/lib/dashboard-nav";
import { ClientQueryFallback } from "@/components/client-query-fallback";
import { getErrorStatus } from "@/lib/api-error";
import { pathFor } from "@/lib/localized-routes";

function useGreeting(t: (k: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("dashboard_good_morning");
  if (hour < 17) return t("dashboard_good_afternoon");
  return t("dashboard_good_evening");
}

type ActiveView = DashboardView;

export default function Dashboard() {
  const { t, language } = useTranslation();
  const seo = usePageSeo("dashboard");
  const { isSignedIn, isLoaded, user, refreshUser } = useAuth();
  // Refresh credit balance on mount / focus (admin pack edits, pack purchase, redeem)
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void refreshUser();
    const onFocus = () => { void refreshUser(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isLoaded, isSignedIn, refreshUser]);
  const [location, setLocation] = useLocation();
  const greeting = useGreeting(t);
  const activeView = parseDashboardView(location, language);
  const [accountCountry, setAccountCountry] = useState("");
  const [savingCountry, setSavingCountry] = useState(false);
  const [countryMsg, setCountryMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [countryChangesRemaining, setCountryChangesRemaining] = useState<number | null>(null);
  const [phonePrefix, setPhonePrefix] = useState("+355");
  const [phoneNational, setPhoneNational] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [phoneChangesRemaining, setPhoneChangesRemaining] = useState<number | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "account" || hash === "help") {
      setLocation(dashboardPath(language, hash), { replace: true });
    }
  }, [language, setLocation]);

  useEffect(() => {
    const path = normalizeClientPath(location);
    const base = dashboardPath(language);
    if (path === base || !path.startsWith(`${base}/`)) return;
    const segment = path.slice(base.length + 1);
    if (segment !== "account" && segment !== "help") {
      setLocation(base, { replace: true });
    }
  }, [location, language, setLocation]);

  const setActiveView = (view: ActiveView) => {
    setLocation(dashboardPath(language, view));
  };

  const queryClient = useQueryClient();

  const [historyPage, setHistoryPage] = useState(1);
  const historyParams = useMemo((): UserHistoryParams => ({
    page: historyPage,
    limit: DASHBOARD_REPORTS_PER_PAGE,
    view: "summary",
  }), [historyPage]);
  const authReady = isLoaded && isSignedIn;
  const {
    data: history,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErr,
    refetch: refetchHistory,
    isFetching: historyFetching,
  } = useQuery({
    queryKey: userHistoryQueryKey(historyParams),
    queryFn: ({ signal }) => fetchUserHistory(historyParams, signal),
    enabled: authReady,
    ...CLIENT_AREA_QUERY_OPTIONS,
    // Per-page cache: flipping 1↔2 within 30s reuses data instead of re-hitting the API.
    // New pages still fetch once (new query key). Window focus only refetches if stale.
    staleTime: 30_000,
    refetchOnMount: true,
    placeholderData: (prev) => prev,
  });
  const onHistoryPageChange = useCallback((page: number) => {
    if (historyFetching) return;
    setHistoryPage(Math.max(1, page));
  }, [historyFetching]);
  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsErr, refetch: refetchStats, isFetching: statsFetching } = useGetUserStats(
    { query: { enabled: authReady, ...orvalQuery<UserStats>(CLIENT_AREA_QUERY_OPTIONS) } },
  );

  const deleteLookup = useDeleteUserVinLookup({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/user/history"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      },
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation(pathFor(language, "sign_in"));
  }, [isLoaded, isSignedIn, language, setLocation]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (user.hasPassword === false) {
      setLocation(`/${language}/set-password`);
    }
  }, [isLoaded, isSignedIn, user, language, setLocation]);

  useEffect(() => {
    setAccountCountry(user?.countryCode ?? "");
    setCountryMsg(null);
    setPhonePrefix(user?.phonePrefix || "+355");
    setPhoneNational(user?.phoneNational ?? "");
    setPhoneMsg(null);
  }, [user?.id, user?.countryCode, user?.phonePrefix, user?.phoneNational]);

  useEffect(() => {
    if (activeView !== "account" || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/user/profile`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json() as {
          countryCode?: string | null;
          countryChangesRemaining?: number;
          phonePrefix?: string | null;
          phoneNational?: string | null;
          phoneChangesRemaining?: number;
        };
        if (cancelled) return;
        if (typeof data.countryChangesRemaining === "number") {
          setCountryChangesRemaining(data.countryChangesRemaining);
        }
        if (typeof data.phoneChangesRemaining === "number") {
          setPhoneChangesRemaining(data.phoneChangesRemaining);
        }
        if (data.phonePrefix) setPhonePrefix(data.phonePrefix);
        if (data.phoneNational != null) setPhoneNational(data.phoneNational);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [activeView, isSignedIn, user?.id]);

  useEffect(() => {
    const err = historyError ? historyErr : statsError ? statsErr : null;
    if (!err) return;
    if (getErrorStatus(err) === 401) {
      setLocation(pathFor(language, "sign_in"));
    }
  }, [historyError, historyErr, statsError, statsErr, language, setLocation]);

  useEffect(() => {
    if (!isSignedIn) return;
    prefetchVinPageChunk();
  }, [isSignedIn]);

  useEffect(() => {
    if (!history?.items?.length) return;
    seedVinLookupsFromHistory(queryClient, history.items);

    const thumbUrls = history.items
      .map((lookup) => {
        const d = lookup.data as { photos?: string[]; thumbnailUrl?: string | null } | null | undefined;
        if (!d) return null;
        if (Array.isArray(d.photos) && d.photos[0]) return d.photos[0];
        return d.thumbnailUrl ?? null;
      })
      .filter((url): url is string => typeof url === "string" && url.length > 0);
    if (thumbUrls.length) void warmVinImages(thumbUrls.slice(0, 3));
  }, [history?.items, queryClient]);

  // Pending VIN check saved in sessionStorage before auth / checkout
  const [pendingVin, setPendingVin] = useState<string | null>(() => readStoredPendingVin());
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const saveAccountCountry = async () => {
    if (!accountCountry) {
      setCountryMsg({ ok: false, text: t("auth_error_country_required") });
      return;
    }
    if (countryChangesRemaining === 0) {
      setCountryMsg({ ok: false, text: t("account_country_change_limit") });
      return;
    }
    setSavingCountry(true);
    setCountryMsg(null);
    try {
      const res = await fetch(`${basePath}/api/user/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ countryCode: accountCountry }),
      });
      const data = await res.json() as {
        error?: string;
        code?: string;
        countryCode?: string | null;
        countryChangesRemaining?: number;
        countryChangesLimit?: number;
        phoneChangesRemaining?: number;
      };
      if (typeof data.countryChangesRemaining === "number") {
        setCountryChangesRemaining(data.countryChangesRemaining);
      }
      if (typeof data.phoneChangesRemaining === "number") {
        setPhoneChangesRemaining(data.phoneChangesRemaining);
      }
      if (!res.ok) {
        setCountryMsg({
          ok: false,
          text: data.code === "COUNTRY_CHANGE_LIMIT"
            ? t("account_country_change_limit")
            : (data.error || t("error_generic")),
        });
        return;
      }
      await refreshUser();
      setCountryMsg({ ok: true, text: t("account_country_saved") });
    } catch {
      setCountryMsg({ ok: false, text: t("error_generic") });
    } finally {
      setSavingCountry(false);
    }
  };

  const saveAccountPhone = async () => {
    if (!phonePrefix || !phoneNational) {
      setPhoneMsg({ ok: false, text: t("account_phone_required") });
      return;
    }
    if (phoneChangesRemaining === 0) {
      setPhoneMsg({ ok: false, text: t("account_phone_change_limit") });
      return;
    }
    setSavingPhone(true);
    setPhoneMsg(null);
    try {
      const res = await fetch(`${basePath}/api/user/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phonePrefix, phoneNational }),
      });
      const data = await res.json() as {
        error?: string;
        code?: string;
        phonePrefix?: string | null;
        phoneNational?: string | null;
        phoneChangesRemaining?: number;
        countryChangesRemaining?: number;
      };
      if (typeof data.phoneChangesRemaining === "number") {
        setPhoneChangesRemaining(data.phoneChangesRemaining);
      }
      if (typeof data.countryChangesRemaining === "number") {
        setCountryChangesRemaining(data.countryChangesRemaining);
      }
      if (!res.ok) {
        setPhoneMsg({
          ok: false,
          text: data.code === "PHONE_CHANGE_LIMIT"
            ? t("account_phone_change_limit")
            : data.code === "INVALID_PHONE"
              ? t("account_phone_invalid")
              : (data.error || t("error_generic")),
        });
        return;
      }
      await refreshUser();
      setPhoneMsg({ ok: true, text: t("account_phone_saved") });
    } catch {
      setPhoneMsg({ ok: false, text: t("error_generic") });
    } finally {
      setSavingPhone(false);
    }
  };

  const { data: pendingPeek, isLoading: pendingPeekLoading, isError: pendingPeekError, error: pendingPeekErr } = useQuery<PendingVinPeek>({
    queryKey: ["/api/vin/peek", "pending-banner", pendingVin],
    enabled: !!pendingVin && !!isSignedIn,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/vin/peek/${encodeURIComponent(pendingVin!)}`, {
        credentials: "include",
      });
      if (r.status === 400) {
        const err = new Error("invalid_vin");
        (err as Error & { invalidVin?: boolean }).invalidVin = true;
        throw err;
      }
      if (!r.ok) throw new Error("peek_failed");
      return r.json() as Promise<PendingVinPeek>;
    },
  });

  const showPendingBanner =
    !!pendingVin &&
    !pendingPeekLoading &&
    !!pendingPeek &&
    isEligiblePendingVin(pendingPeek);

  // Drop ineligible or invalid pending VINs (nonsense VINs, not in local-exists / catalog)
  useEffect(() => {
    if (!pendingVin || pendingPeekLoading) return;
    if (pendingPeekError) {
      if ((pendingPeekErr as Error & { invalidVin?: boolean })?.invalidVin) {
        clearStoredPendingVin();
        setPendingVin(null);
      }
      return;
    }
    if (!pendingPeek || !isEligiblePendingVin(pendingPeek)) {
      clearStoredPendingVin();
      setPendingVin(null);
    }
  }, [pendingVin, pendingPeek, pendingPeekLoading, pendingPeekError, pendingPeekErr]);

  // Clear the pending-VIN banner if the user already has a completed report for it
  useEffect(() => {
    if (!pendingVin || !history?.items) return;
    const alreadyOwned = history.items.some(
      l => l.vin.toUpperCase() === pendingVin.toUpperCase() && (l.status === "complete" || l.status === "pending_manual")
    );
    if (alreadyOwned) {
      clearStoredPendingVin();
      setPendingVin(null);
    }
  }, [history, pendingVin]);

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  const lookups = history?.items ?? [];
  const hasHistoryData = history != null;
  const historyTotal = history?.total ?? lookups.length;
  const totalChecks = stats?.totalChecks ?? historyTotal;
  const isViewableReport = (status: string) => status === "complete" || status === "pending_manual";
  // Prefer full history total — page items alone under-count when paginated.
  const completed = historyTotal;
  const handlePendingVinCheckout = () => {
    if (!pendingVin) return;
    const target = buildPrefillOnlyCheckoutPath(pendingVin, language);
    if (target) setLocation(target);
  };

  const pendingBanner = showPendingBanner && pendingVin ? (
    <div className="w-full border-b border-[#00a5fd]/20 bg-[#030712] text-white">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-3.5">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#00a5fd]/25 bg-[#071018] px-4 py-3.5 shadow-[0_16px_40px_-28px_rgba(0,165,253,0.55)] sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3 text-left sm:items-center">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00a5fd] to-[#0077c8] text-white shadow-[0_8px_20px_-10px_rgba(0,165,253,0.9)] sm:mt-0">
              <AlertCircle className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7dd3fc]">
                {t("pending_vin_banner")}
              </p>
              <span className="inline-flex max-w-full items-center truncate rounded-lg border border-[#00a5fd]/30 bg-[#0c1524] px-2.5 py-1 font-mono text-[13px] tracking-[0.16em] text-white">
                {pendingVin}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            className="h-10 w-full shrink-0 gap-1.5 rounded-xl px-4 font-semibold sm:h-10 sm:w-auto"
            onClick={handlePendingVinCheckout}
          >
            <Zap className="h-3.5 w-3.5" />
            {t("complete_purchase")}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
    <SEOHead title={seo.title} description={seo.description} lang={seo.lang} noIndex />
    <ClientAreaLayout
      before={pendingBanner}
      heading={(
        <div className="text-left">
          <h1
            className={cn(
              "text-left text-xl font-extrabold tracking-tight md:text-3xl",
              activeView !== "account" && activeView !== "help" && "hidden md:block",
            )}
          >
            {activeView === "account"
              ? t("account")
              : activeView === "help"
                ? t("help_title")
                : `${greeting}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
          </h1>
          <p className="mt-1 text-left text-sm text-muted-foreground sm:text-base">
            {activeView === "account"
              ? t("account_subtitle")
              : activeView === "help"
                ? t("help_subtitle")
                : t("dashboard_subtitle")}
          </p>
        </div>
      )}
    >
      <div className="w-full space-y-6 px-4 pb-2 md:space-y-8 md:px-0 md:pb-0">

          {/* ── ACCOUNT VIEW ── */}
          {activeView === "account" ? (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="space-y-6"
            >
              <div className="rounded-2xl border bg-background shadow-sm overflow-hidden">
                {/* Profile header */}
                <div className="bg-[#071018] px-5 py-6 text-white sm:px-7">
                  <div className="flex items-center gap-4 min-w-0">
                  <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-4 border-white/10 shadow-md shrink-0">
                    <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name || ""} />
                    <AvatarFallback className="bg-white/10 text-xl text-white"><User className="h-8 w-8" /></AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5 min-w-0 flex-1 text-left">
                    <p className="text-lg sm:text-xl font-bold leading-tight truncate">{user?.name || "User"}</p>
                    <p className="text-sm text-white/55 truncate">{user?.email}</p>
                    {user?.createdAt && (
                      <p className="text-xs text-white/40">
                        {t("member_since")}{" "}
                        {new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                      </p>
                    )}
                  </div>
                  </div>
                </div>

                {/* Stats summary */}
                <div className="grid grid-cols-2 divide-x border-t">
                  {[
                    { label: t("total_checks"), value: String(totalChecks) },
                    { label: t("completed"), value: String(completed) },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-5 py-4 text-left sm:px-7 sm:py-5">
                      <p className="text-xl font-black tabular-nums">{statsLoading ? "—" : value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Profile: country + phone */}
                <div className={cn(
                  "px-4 sm:px-6 py-5 border-t min-w-0",
                )}>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 sm:p-5 space-y-5 min-w-0">
                    {(!user?.countryCode || !user?.phonePrefix || !user?.phoneNational) && (
                      <div
                        role="status"
                        className={cn(
                          "relative overflow-hidden rounded-xl",
                          "border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-primary/[0.06] to-transparent",
                          "dark:from-primary/20 dark:via-primary/10 dark:to-transparent",
                          "px-3.5 py-3.5 sm:px-4 sm:py-4",
                        )}
                      >
                        <div
                          className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl"
                          aria-hidden
                        />
                        <div className="relative flex gap-3 items-start">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20 shadow-sm">
                            <PartyPopper className="h-5 w-5" aria-hidden />
                          </span>
                          <div className="min-w-0 space-y-1 pt-0.5">
                            <p className="text-sm font-semibold leading-snug text-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{t("account_country_prompt_title")}</span>
                              <span className="text-base leading-none" aria-hidden>🎉</span>
                            </p>
                            <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground">
                              {t("account_country_prompt_body")}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Country */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                              <Globe className="h-3.5 w-3.5" />
                            </span>
                            {t("account_country_label")}
                          </p>
                        </div>
                        {(() => {
                          const currentCode = user?.countryCode ?? null;
                          const currentName = userCountryLabel(currentCode);
                          if (!currentCode || !currentName) {
                            return (
                              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                {t("account_country_unset")}
                              </span>
                            );
                          }
                          return (
                            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-background border border-border/70 px-2.5 py-1 text-[11px] font-medium shadow-sm max-w-[14rem]">
                              <FlagImg code={currentCode.toLowerCase()} size={14} />
                              <span className="max-w-[9rem] truncate">{currentName}</span>
                            </span>
                          );
                        })()}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="account-country" className="text-xs text-muted-foreground">
                          {t("account_country_choose")}
                        </Label>
                        <UserCountrySelect
                          id="account-country"
                          value={accountCountry}
                          onValueChange={(v) => {
                            setAccountCountry(v);
                            setCountryMsg(null);
                          }}
                          preferredCode={user?.countryCode}
                          placeholder={t("auth_country_placeholder")}
                          searchPlaceholder={t("auth_country_search")}
                          emptySearchLabel={t("auth_country_search_empty")}
                          emptyLabel={user?.countryCode ? t("account_country_unset") : undefined}
                          disabled={savingCountry || countryChangesRemaining === 0}
                          triggerClassName="h-11 rounded-xl bg-background"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => void saveAccountCountry()}
                          disabled={
                            savingCountry
                            || !accountCountry
                            || accountCountry === (user?.countryCode ?? "")
                            || countryChangesRemaining === 0
                          }
                        >
                          {savingCountry ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {t("account_country_save")}
                        </Button>
                      </div>

                      {countryMsg && (
                        <p
                          className={cn(
                            "text-xs font-medium rounded-lg px-3 py-2",
                            countryMsg.ok
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {countryMsg.text}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border/50" />

                    {/* Phone */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                            <Phone className="h-3.5 w-3.5" />
                          </span>
                          {t("account_phone_label")}
                        </p>
                        {formatPhoneDisplay(user?.phonePrefix, user?.phoneNational) ? (
                          <span className="shrink-0 max-w-[55%] truncate rounded-full bg-background border border-border/70 px-2.5 py-1 text-[11px] font-medium shadow-sm tabular-nums">
                            {formatPhoneDisplay(user?.phonePrefix, user?.phoneNational)}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {t("account_phone_unset")}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="account-phone-national" className="text-xs text-muted-foreground">
                          {t("account_phone_choose")}
                        </Label>
                        <UserPhoneFields
                          prefix={phonePrefix}
                          national={phoneNational}
                          onPrefixChange={(v) => { setPhonePrefix(v); setPhoneMsg(null); }}
                          onNationalChange={(v) => { setPhoneNational(v); setPhoneMsg(null); }}
                          disabled={savingPhone || phoneChangesRemaining === 0}
                          prefixId="account-phone-prefix"
                          nationalId="account-phone-national"
                          searchPlaceholder={t("account_phone_prefix_search")}
                          emptySearchLabel={t("account_phone_prefix_empty")}
                          nationalPlaceholder={t("account_phone_placeholder")}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => void saveAccountPhone()}
                          disabled={
                            savingPhone
                            || !phonePrefix
                            || !phoneNational
                            || (
                              phonePrefix === (user?.phonePrefix ?? "")
                              && phoneNational === (user?.phoneNational ?? "")
                            )
                            || phoneChangesRemaining === 0
                          }
                        >
                          {savingPhone ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {t("account_phone_save")}
                        </Button>
                      </div>

                      {phoneMsg && (
                        <p
                          className={cn(
                            "text-xs font-medium rounded-lg px-3 py-2",
                            phoneMsg.ok
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {phoneMsg.text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="ghost"
                    className="gap-2 text-muted-foreground"
                    onClick={() => setActiveView("reports")}
                  >
                    <FileText className="h-4 w-4" />
                    {t("my_reports")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="gap-2 text-muted-foreground"
                    onClick={() => setActiveView("help")}
                  >
                    <span className="h-4 w-4 flex items-center justify-center text-base">?</span>
                    {t("contact_support")}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : activeView === "help" ? (
            /* ── HELP VIEW ── */
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="space-y-6"
            >
              <SiteFaqAccordion
                idPrefix="help"
                items={(["1", "2", "credits", "3", "4", "5", "6"] as const).map((n) => ({
                  q: t(`help_faq_${n}_q`),
                  a: t(`help_faq_${n}_a`),
                }))}
              />

              <div className="flex items-start gap-4 rounded-2xl border border-[#00a5fd]/20 bg-[#071018] p-5 text-white">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00a5fd] text-white">
                  <Instagram className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold">{t("help_contact_title")}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/55">{t("help_contact_desc")}</p>
                  <a
                    href="https://www.instagram.com/verifykm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-[#7dd3fc] hover:underline"
                  >
                    @verifykm
                  </a>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── REPORTS VIEW ── */
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="space-y-6"
            >
              {/* History */}
              <div className="space-y-4">
                <h2 className="text-left text-lg font-semibold">{t("my_reports")}</h2>

                <ClientQueryFallback
                  isLoading={historyLoading}
                  isError={historyError}
                  isFetching={historyFetching}
                  hasData={hasHistoryData}
                  error={historyErr}
                  refetch={refetchHistory}
                  skeleton={(
                    <div className="space-y-2.5 sm:space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-[6.75rem] sm:h-[7.25rem] w-full rounded-md" />
                      ))}
                    </div>
                  )}
                >
                {historyTotal === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative overflow-hidden rounded-md border border-dashed border-[#00a5fd]/30 bg-muted/20"
                  >
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#00a5fd]/40" />

                    <div className="flex items-center gap-2.5 border-b border-dashed border-border/60 bg-[#00a5fd]/[0.04] px-4 py-2 pl-5">
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
                        {t("dashboard_empty_eyebrow")}
                      </p>
                      <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                        {t("dashboard_file_no")} 000
                      </span>
                    </div>

                    <div className="space-y-4 px-5 py-8 pl-6 sm:px-7 sm:pl-8">
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-bold">{t("no_reports")}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">{t("no_reports_desc")}</p>
                      </div>
                      <Button asChild className="h-9 gap-2 rounded-md">
                        <Link href={`/${language}`}>
                          <Search className="h-4 w-4" />
                          {t("run_first_check")}
                        </Link>
                      </Button>
                      <p className="font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground/60">
                        {t("dashboard_empty_hint")}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <DashboardReportList
                    lookups={lookups}
                    total={historyTotal}
                    page={historyPage}
                    onPageChange={onHistoryPageChange}
                    isFetching={historyFetching}
                    language={language}
                    deleteLookup={deleteLookup}
                  />
                )}
                </ClientQueryFallback>
              </div>
            </motion.div>
          )}
        </div>
    </ClientAreaLayout>
    </>
  );
}
