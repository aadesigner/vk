import { Switch, Route, Redirect, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/layout";
import { useEffect, Suspense, type ReactNode } from "react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { RouteSEO } from "@/components/seo";
import NotFound from "@/pages/not-found";
import { isVin17 } from "@/lib/vin-route";
import { WarmCache } from "@/components/warm-cache";
import { SiteAnalytics } from "@/components/site-analytics";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { RouteErrorBoundary } from "@/components/error-boundary";
import { MaintenanceGuard } from "@/components/maintenance-guard";
import { VinAccessGate } from "@/components/vin-access-gate";
import { RouteShellFallback } from "@/components/route-shell-fallback";
import { ensureDict, useTranslation } from "@/i18n/context";
import {
  pathNeedingLangPrefix,
  buildLocalizedPath,
  markGeoLanguageEvaluated,
  getStoredLangPreference,
  setStoredLangPreference,
} from "@/lib/lang-preference";
import {
  resolveEntryLanguage,
  resolveEntryLanguageSync,
} from "@/lib/geo-language-client";
import { SUPPORTED_LANGS, isSupportedLang, type Language, LANG_PATH_ALT } from "@/lib/languages";
import {
  normalizeAppPath,
  pathNormalizeRedirectTarget,
  splitRouterLocation,
} from "@/lib/normalize-app-path";
import { isAdminAppPath, matchAdminRoute } from "@/lib/admin-routes";
import {
  allSlugsFor,
  allCarsSegments,
  allCountrySlugs,
  countryIdFromSlug,
  needsCanonicalSlugRedirect,
  pathFor,
  pathForCountry,
  type CountryId,
} from "@/lib/localized-routes";

import AdminNotFound from "@/pages/admin/not-found";
import Home from "@/pages/home";
// Lazy-loaded
const AdminLayout     = lazyWithRetry(() =>
  import("@/pages/admin/layout").then((m) => ({ default: m.AdminLayout })),
);
const AdminOverview   = lazyWithRetry(() => import("@/pages/admin/index"));
const Pricing       = lazyWithRetry(() => import("@/pages/pricing"));
const Dashboard     = lazyWithRetry(() => import("@/pages/dashboard"));
const VinResult     = lazyWithRetry(() => import("@/pages/vin-result"));
const VinPublic     = lazyWithRetry(() => import("@/pages/vin-public"));
const VinProcessing = lazyWithRetry(() => import("@/pages/vin-processing"));
const CountryPage   = lazyWithRetry(() => import("@/pages/country"));
const Terms         = lazyWithRetry(() => import("@/pages/terms"));
const Privacy       = lazyWithRetry(() => import("@/pages/privacy"));
const AdminUsers     = lazyWithRetry(() => import("@/pages/admin/users"));
const AdminUserDetail = lazyWithRetry(() => import("@/pages/admin/user-detail"));
const AdminLookups   = lazyWithRetry(() => import("@/pages/admin/lookups"));
const AdminProviders = lazyWithRetry(() => import("@/pages/admin/providers"));
const AdminPricing   = lazyWithRetry(() => import("@/pages/admin/pricing"));
const AdminSettings  = lazyWithRetry(() => import("@/pages/admin/settings"));
const AdminLogs      = lazyWithRetry(() => import("@/pages/admin/logs"));
const AdminCoupons   = lazyWithRetry(() => import("@/pages/admin/coupons"));
const AdminEmails    = lazyWithRetry(() => import("@/pages/admin/emails"));
const AdminVinCatalog    = lazyWithRetry(() => import("@/pages/admin/vin-catalog"));
const AdminVinDetail     = lazyWithRetry(() => import("@/pages/admin/vin-detail"));
const AdminPendingVinChecks = lazyWithRetry(() => import("@/pages/admin/pending-vin-checks"));
const AdminPendingVinDetail = lazyWithRetry(() => import("@/pages/admin/pending-vin-detail"));
const AdminSecurity      = lazyWithRetry(() => import("@/pages/admin/security"));
const AdminTransactions     = lazyWithRetry(() => import("@/pages/admin/transactions"));
const AdminAnnouncements    = lazyWithRetry(() => import("@/pages/admin/announcements"));
const AdminAnalytics        = lazyWithRetry(() => import("@/pages/admin/analytics"));
const AdminPlugins          = lazyWithRetry(() => import("@/pages/admin/plugins"));
const Checkout         = lazyWithRetry(() => import("@/pages/checkout"));
const CreditsCheckout  = lazyWithRetry(() => import("@/pages/credits-checkout"));
const ForgotPassword  = lazyWithRetry(() => import("@/pages/forgot-password"));
const ResetPassword   = lazyWithRetry(() => import("@/pages/reset-password"));
const SetPassword     = lazyWithRetry(() => import("@/pages/set-password"));
const FreeVinDecoder  = lazyWithRetry(() => import("@/pages/free-vin-decoder"));
const Purchases       = lazyWithRetry(() => import("@/pages/purchases"));
const HowItWorks      = lazyWithRetry(() => import("@/pages/how-it-works"));
const FAQ             = lazyWithRetry(() => import("@/pages/faq"));
const BlogIndex       = lazyWithRetry(() => import("@/pages/blog").then((m) => ({ default: m.BlogIndexPage })));
const BlogArticle     = lazyWithRetry(() => import("@/pages/blog").then((m) => ({ default: m.BlogArticlePage })));
const MeaningHintsDev = import.meta.env.DEV
  ? lazyWithRetry(() => import("@/pages/dev-meaning-hints"))
  : null;
const Maintenance     = lazyWithRetry(() => import("@/pages/maintenance"));
const AuthFormLazy    = lazyWithRetry(() => import("@/pages/auth").then((m) => ({ default: m.AuthForm })));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function PageLoader() {
  return <RouteShellFallback />;
}

/** Hold the shell until the locale dictionary is ready — avoids English text flash on /sq, /de, etc. */
function LocaleReadyGate({ children }: { children: ReactNode }) {
  const { ready, language } = useTranslation();
  if (!ready && language !== "en") return <RouteShellFallback />;
  return <>{children}</>;
}

function withLang(
  Component: React.ComponentType<{ params: { lang: string; [key: string]: string } }>,
  errorScope?: string,
) {
  return function LangWrapper(props: { params: { lang: string; [key: string]: string } }) {
    const [location, setLocation] = useLocation();
    const resetKey = location.split("?")[0] ?? location;
    const validLangs = SUPPORTED_LANGS as readonly string[];
    const langValid = validLangs.includes(props.params.lang);
    const lang = (langValid ? props.params.lang : "en") as Language;
    const pathOnly = location.split("?")[0] ?? location;
    const restMatch = pathOnly.match(new RegExp(`^/${props.params.lang}(/.*)?$`));
    const rest = restMatch?.[1] ?? "";
    const canonicalTarget = langValid ? needsCanonicalSlugRedirect(lang, rest) : null;

    useEffect(() => {
      if (!canonicalTarget) return;
      // Wouter's location is the path only, so `?pack=` lives on window.location.
      const fromRouter = location.includes("?") || location.includes("#")
        ? location.slice(Math.min(
            location.includes("?") ? location.indexOf("?") : location.length,
            location.includes("#") ? location.indexOf("#") : location.length,
          ))
        : "";
      const search = typeof window !== "undefined" ? window.location.search : "";
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const suffix = fromRouter || `${search}${hash}`;
      setLocation(`${canonicalTarget}${suffix}`, { replace: true });
    }, [canonicalTarget, location, setLocation]);

    if (!langValid) {
      return <Redirect to="/en" />;
    }
    if (canonicalTarget) return <RouteShellFallback />;

    const page = (
      <Suspense fallback={<PageLoader />}>
        <Component {...props} />
      </Suspense>
    );
    return (
      <I18nProvider initialLanguage={lang}>
        <RouteSEO />
        <LocaleReadyGate>
          <Layout>
            {errorScope ? <RouteErrorBoundary scope={errorScope} resetKey={resetKey}>{page}</RouteErrorBoundary> : page}
          </Layout>
        </LocaleReadyGate>
      </I18nProvider>
    );
  };
}

function AuthPage({ params, mode }: { params: { lang: string }; mode: "sign-in" | "sign-up" }) {
  const [location] = useLocation();
  const resetKey = location.split("?")[0] ?? location;
  const validLangs = SUPPORTED_LANGS as readonly string[];
  const lang = validLangs.includes(params.lang) ? params.lang : "en";

  return (
    <I18nProvider initialLanguage={lang as Language}>
      <RouteSEO />
      <LocaleReadyGate>
        <Layout>
          <RouteErrorBoundary scope="auth" resetKey={resetKey}>
            <Suspense fallback={<PageLoader />}>
              <AuthFormLazy lang={lang} mode={mode} />
            </Suspense>
          </RouteErrorBoundary>
        </Layout>
      </LocaleReadyGate>
    </I18nProvider>
  );
}

function AuthSubPage({ lang, children }: { lang: Language; children: React.ReactNode }) {
  const [location] = useLocation();
  const resetKey = location.split("?")[0] ?? location;
  return (
    <I18nProvider initialLanguage={lang}>
      <RouteSEO />
      <LocaleReadyGate>
        <Layout>
          <RouteErrorBoundary scope="auth" resetKey={resetKey}>
            <Suspense fallback={<PageLoader />}>{children}</Suspense>
          </RouteErrorBoundary>
        </Layout>
      </LocaleReadyGate>
    </I18nProvider>
  );
}

const HomeLang         = withLang(Home, "home");
const PricingLang      = withLang(Pricing as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "pricing");
const CheckoutLang     = withLang(Checkout as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "checkout");
const CreditsCheckoutLang = withLang(CreditsCheckout as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "credits-checkout");
const DashboardLang    = withLang(Dashboard as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "dashboard");
const VinProcessingLang = withLang(VinProcessing as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "vin-processing");
const TermsLang           = withLang(Terms as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);
const PrivacyLang         = withLang(Privacy as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);
const FreeVinDecoderLang  = withLang(FreeVinDecoder as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "free-decoder");
const PurchasesLang       = withLang(Purchases as React.ComponentType<{ params: { lang: string; [key: string]: string } }>, "purchases");
const HowItWorksLang      = withLang(HowItWorks as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);
const FAQLang             = withLang(FAQ as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);
const BlogIndexLang       = withLang(BlogIndex as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);
const BlogArticleLang     = withLang(BlogArticle as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);
const MeaningHintsDevLang = MeaningHintsDev
  ? withLang(MeaningHintsDev as React.ComponentType<{ params: { lang: string; [key: string]: string } }>)
  : null;
const MaintenanceLang     = withLang(Maintenance as React.ComponentType<{ params: { lang: string; [key: string]: string } }>);

function CountryLang(props: { params: { lang: string; country: string } }) {
  const [location] = useLocation();
  const resetKey = location.split("?")[0] ?? location;
  const validLangs = SUPPORTED_LANGS as readonly string[];
  if (!validLangs.includes(props.params.lang)) return <Redirect to="/en" />;
  return (
    <I18nProvider initialLanguage={props.params.lang as Language}>
      <RouteSEO />
      <LocaleReadyGate>
        <Layout>
          <RouteErrorBoundary scope="country" resetKey={resetKey}>
            <Suspense fallback={<PageLoader />}>
              <CountryPage params={props.params} />
            </Suspense>
          </RouteErrorBoundary>
        </Layout>
      </LocaleReadyGate>
    </I18nProvider>
  );
}

/** Signed-in report route by numeric lookup ID (legacy; VinResult redirects to /vin/:VIN). */
function VinLookupRoute(props: { params: { lang: string; id: string } }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLocation(pathFor(props.params.lang as Language, "sign_in"), { replace: true });
    }
  }, [isLoaded, isSignedIn, setLocation, props.params.lang]);

  if (!isLoaded) return null;
  if (!isSignedIn) return null;

  return (
    <Suspense fallback={<PageLoader />}>
      <VinResult params={props.params} />
    </Suspense>
  );
}

function stripLegacyShareParam(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("s")) return;
  url.searchParams.delete("s");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function VinRouteByAuth(props: { params: { lang: string; id: string } }) {
  const { isSignedIn, isLoaded } = useAuth();
  const vin = props.params.id.toUpperCase();

  useEffect(() => {
    stripLegacyShareParam();
  }, [vin]);

  if (!isLoaded) return null;

  // Guests: public locked preview. Signed-in: ownership gate (purchase required per account).
  if (!isSignedIn) {
    return (
      <Suspense fallback={<PageLoader />}>
        <VinPublic params={{ lang: props.params.lang, id: vin }} />
      </Suspense>
    );
  }

  // Signed-in: full report only when API confirms ownership (purchase, pending, or admin).
  return <VinAccessGate params={props.params} vin={vin} />;
}

function VinResultLang(props: { params: { lang: string; id: string } }) {
  const [location] = useLocation();
  const resetKey = location.split("?")[0] ?? location;
  const validLangs = SUPPORTED_LANGS as readonly string[];
  if (!validLangs.includes(props.params.lang)) return <Redirect to="/en" />;
  const isVin = isVin17(props.params.id);
  return (
    <I18nProvider initialLanguage={props.params.lang as Language}>
      <RouteSEO />
      <Layout>
        <RouteErrorBoundary scope="vin" resetKey={resetKey}>
          <Suspense fallback={<PageLoader />}>
            {isVin
              ? <VinRouteByAuth params={props.params} />
              : <VinLookupRoute params={props.params} />
            }
          </Suspense>
        </RouteErrorBoundary>
      </Layout>
    </I18nProvider>
  );
}

function AdminPage({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const resetKey = location.split("?")[0] ?? location;
  const adminLang = getStoredLangPreference() ?? "en";
  return (
    <I18nProvider initialLanguage={adminLang}>
      <RouteErrorBoundary scope="admin" resetKey={resetKey}>
        <Suspense fallback={<PageLoader />}>
          <AdminLayout>{children}</AdminLayout>
        </Suspense>
      </RouteErrorBoundary>
    </I18nProvider>
  );
}


function NotFoundLang() {
  const [location] = useLocation();
  const { pathname } = splitRouterLocation(location);
  const validLangs = SUPPORTED_LANGS;
  const match = location.match(new RegExp(`^/(${LANG_PATH_ALT})(?:/|$)`));
  const lang = validLangs.includes((match?.[1] ?? "en") as typeof validLangs[number])
    ? (match?.[1] ?? "en") as typeof validLangs[number]
    : "en";

  // Safety net: unprefixed paths (e.g. /pricing) should redirect, not 404.
  const unprefixedRest = pathNeedingLangPrefix(pathname);
  if (unprefixedRest !== null) {
    return <UnprefixedPathLangRedirect pathname={pathname} />;
  }

  // Safety net: admin paths are handled by AdminSwitch — never public 404.
  if (isAdminAppPath(pathname)) {
    return <AdminSwitch />;
  }

  return (
    <I18nProvider initialLanguage={lang}>
      <RouteSEO />
      <Layout>
        <NotFound />
      </Layout>
    </I18nProvider>
  );
}

/**
 * Shared first-visit geo for `/` and unprefixed paths (`/cars/usa`, `/faq`).
 * Prefixed URLs (`/en/…`) never use this — Google/deep links keep their language.
 * Preference + geo-evaluated flag make homepage and deep unprefixed entry stick together.
 */
function redirectWithEntryLanguage(
  setLocation: ReturnType<typeof useLocation>[1],
  buildTarget: (lang: Language) => string,
) {
  let cancelled = false;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";

  const go = async (lang: Language) => {
    if (cancelled) return;
    void ensureDict(lang).catch(() => {});
    setStoredLangPreference(lang);
    markGeoLanguageEvaluated();
    setLocation(`${buildTarget(lang)}${search}${hash}`, { replace: true });
  };

  const immediate = resolveEntryLanguageSync();
  if (immediate != null) {
    void go(immediate);
    return () => {
      cancelled = true;
    };
  }

  void resolveEntryLanguage().then(go);
  return () => {
    cancelled = true;
  };
}

function RootLangRedirect() {
  const [, setLocation] = useLocation();

  useEffect(
    () => redirectWithEntryLanguage(setLocation, (lang) => `/${lang}`),
    [setLocation],
  );

  return <RouteShellFallback />;
}

function UnprefixedPathLangRedirect({ pathname }: { pathname: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const rest = pathNeedingLangPrefix(pathname);
    if (rest === null) return undefined;
    return redirectWithEntryLanguage(setLocation, (lang) => buildLocalizedPath(lang, rest));
  }, [pathname, setLocation]);

  return <RouteShellFallback />;
}

function parseRouteLang(lang: string): Language {
  return isSupportedLang(lang) ? lang : "en";
}

function createLegacyCountryRedirect(to: string) {
  function LegacyCountryRedirect() {
    return <Redirect to={to} />;
  }
  return LegacyCountryRedirect;
}

const RedirectUsaCars = createLegacyCountryRedirect("/en/cars-from-usa");
const RedirectKoreaCars = createLegacyCountryRedirect("/en/cars-from-korea");
const RedirectCanadaCars = createLegacyCountryRedirect("/en/cars-from-canada");

function LegacyNestedCountryRedirect(props: {
  params: { lang: string; country: string };
}) {
  const lang = parseRouteLang(props.params.lang);
  const id = props.params.country.toLowerCase() as CountryId;
  return <Redirect to={pathForCountry(lang, id)} />;
}

function SignInRoute(props: { params: { lang: string } }) {
  return <AuthPage params={props.params} mode="sign-in" />;
}

function SignUpRoute(props: { params: { lang: string } }) {
  return <AuthPage params={props.params} mode="sign-up" />;
}

function ForgotPasswordRoute(props: { params: { lang: string } }) {
  return (
    <AuthSubPage lang={parseRouteLang(props.params.lang)}>
      <ForgotPassword />
    </AuthSubPage>
  );
}

function ResetPasswordRoute(props: { params: { lang: string } }) {
  return (
    <AuthSubPage lang={parseRouteLang(props.params.lang)}>
      <ResetPassword />
    </AuthSubPage>
  );
}

function SetPasswordRoute(props: { params: { lang: string } }) {
  return (
    <AuthSubPage lang={parseRouteLang(props.params.lang)}>
      <SetPassword />
    </AuthSubPage>
  );
}

function AdminRouteShell({ children, lazy = false }: { children: ReactNode; lazy?: boolean }) {
  return (
    <AdminPage>
      {lazy ? (
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      ) : children}
    </AdminPage>
  );
}

function AdminRouteOutlet() {
  const [location] = useLocation();
  const { pathname } = splitRouterLocation(location);
  const match = matchAdminRoute(pathname);

  switch (match.id) {
    case "overview":
      return (
        <AdminRouteShell lazy>
          <AdminOverview />
        </AdminRouteShell>
      );
    case "not-found":
      return (
        <AdminRouteShell>
          <AdminNotFound />
        </AdminRouteShell>
      );
    case "analytics":
      return (
        <AdminRouteShell lazy>
          <AdminAnalytics />
        </AdminRouteShell>
      );
    case "users":
      return (
        <AdminRouteShell lazy>
          <AdminUsers />
        </AdminRouteShell>
      );
    case "user-detail":
      return (
        <AdminRouteShell lazy>
          <AdminUserDetail params={{ userId: match.userId }} />
        </AdminRouteShell>
      );
    case "lookups":
      return (
        <AdminRouteShell lazy>
          <AdminLookups />
        </AdminRouteShell>
      );
    case "providers":
      return (
        <AdminRouteShell lazy>
          <AdminProviders />
        </AdminRouteShell>
      );
    case "pricing":
      return (
        <AdminRouteShell lazy>
          <AdminPricing />
        </AdminRouteShell>
      );
    case "settings":
      return (
        <AdminRouteShell lazy>
          <AdminSettings />
        </AdminRouteShell>
      );
    case "plugins":
      return (
        <AdminRouteShell lazy>
          <AdminPlugins />
        </AdminRouteShell>
      );
    case "logs":
      return (
        <AdminRouteShell lazy>
          <AdminLogs />
        </AdminRouteShell>
      );
    case "coupons":
      return (
        <AdminRouteShell lazy>
          <AdminCoupons />
        </AdminRouteShell>
      );
    case "emails":
      return (
        <AdminRouteShell lazy>
          <AdminEmails />
        </AdminRouteShell>
      );
    case "security":
      return (
        <AdminRouteShell lazy>
          <AdminSecurity />
        </AdminRouteShell>
      );
    case "vin-catalog":
      return (
        <AdminRouteShell lazy>
          <AdminVinCatalog />
        </AdminRouteShell>
      );
    case "pending-vin-checks":
      return (
        <AdminRouteShell lazy>
          <AdminPendingVinChecks />
        </AdminRouteShell>
      );
    case "pending-vin-detail":
      return (
        <AdminRouteShell lazy>
          <AdminPendingVinDetail params={{ id: match.checkId }} />
        </AdminRouteShell>
      );
    case "vin-detail":
      return (
        <AdminRouteShell lazy>
          <AdminVinDetail params={{ vin: match.vin }} />
        </AdminRouteShell>
      );
    case "transactions":
      return (
        <AdminRouteShell lazy>
          <AdminTransactions />
        </AdminRouteShell>
      );
    case "announcements":
      return (
        <AdminRouteShell lazy>
          <AdminAnnouncements />
        </AdminRouteShell>
      );
    default:
      return (
        <AdminRouteShell lazy>
          <AdminOverview />
        </AdminRouteShell>
      );
  }
}

/** Isolated admin router — never competes with /:lang in the public Switch. */
function AdminSwitch() {
  return (
    <>
      <ScrollToTop />
      <MaintenanceGuard>
        <AdminRouteOutlet />
      </MaintenanceGuard>
    </>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const { pathname, suffix } = splitRouterLocation(location);
  const normalized = normalizeAppPath(pathname);

  if (normalized !== pathname) {
    // Server often 301s to a trailing slash; wouter location has no ?query — keep it.
    const search =
      typeof window !== "undefined" && window.location.search
        ? window.location.search
        : suffix.startsWith("?")
          ? suffix.split("#")[0] ?? ""
          : "";
    const hash =
      typeof window !== "undefined" && window.location.hash
        ? window.location.hash
        : suffix.includes("#")
          ? `#${suffix.split("#").slice(1).join("#")}`
          : "";
    return <Redirect to={pathNormalizeRedirectTarget(normalized, search, hash)} />;
  }

  const unprefixedRest = pathNeedingLangPrefix(pathname);

  if (unprefixedRest !== null) {
    return <UnprefixedPathLangRedirect pathname={pathname} />;
  }

  if (isAdminAppPath(pathname)) {
    return <AdminSwitch />;
  }

  return (
    <>
      <ScrollToTop />
      <MaintenanceGuard>
        <Switch>
        <Route path="/" component={RootLangRedirect} />

        <Route path="/usa-cars" component={RedirectUsaCars} />
        <Route path="/usa-cars/" component={RedirectUsaCars} />
        <Route path="/korea-cars" component={RedirectKoreaCars} />
        <Route path="/korea-cars/" component={RedirectKoreaCars} />
        <Route path="/canada-cars" component={RedirectCanadaCars} />
        <Route path="/canada-cars/" component={RedirectCanadaCars} />

        {/* Auth routes — localized slugs + English aliases */}
        {allSlugsFor("sign_in").map((s) => (
          <Route key={`si-${s}`} path={`/:lang/${s}/*?`} component={SignInRoute} />
        ))}
        {allSlugsFor("sign_up").map((s) => (
          <Route key={`su-${s}`} path={`/:lang/${s}/*?`} component={SignUpRoute} />
        ))}
        {allSlugsFor("forgot_password").map((s) => (
          <Route key={`fp-${s}`} path={`/:lang/${s}`} component={ForgotPasswordRoute} />
        ))}
        {allSlugsFor("reset_password").map((s) => (
          <Route key={`rp-${s}`} path={`/:lang/${s}`} component={ResetPasswordRoute} />
        ))}
        {allSlugsFor("set_password").map((s) => (
          <Route key={`sp-${s}`} path={`/:lang/${s}`} component={SetPasswordRoute} />
        ))}

        {/* VIN routes */}
        <Route path="/:lang/vin/processing" component={VinProcessingLang} />
        <Route path="/:lang/vin/:id" component={VinResultLang} />

        {/* Country SEO pages — single-segment slugs (/sq/makina-nga-usa) */}
        {allCountrySlugs().map((slug) => (
          <Route
            key={`country-${slug}`}
            path={`/:lang/${slug}`}
            component={(p: { params: { lang: string } }) => {
              const country = countryIdFromSlug(slug);
              if (!country) return <Redirect to={`/${p.params.lang}`} />;
              return <CountryLang params={{ lang: p.params.lang, country }} />;
            }}
          />
        ))}
        {/* Legacy nested country URLs → new single-segment slugs */}
        {allCarsSegments().map((seg) => (
          <Route
            key={`legacy-cars-${seg}`}
            path={`/:lang/${seg}/:country`}
            component={LegacyNestedCountryRedirect}
          />
        ))}

        {/* Legal */}
        {allSlugsFor("terms").map((s) => (
          <Route key={`tm-${s}`} path={`/:lang/${s}`} component={TermsLang} />
        ))}
        {allSlugsFor("privacy").map((s) => (
          <Route key={`pr-${s}`} path={`/:lang/${s}`} component={PrivacyLang} />
        ))}

        {/* Main pages */}
        {allSlugsFor("pricing").map((s) => (
          <Route key={`pc-${s}`} path={`/:lang/${s}`} component={PricingLang} />
        ))}
        {allSlugsFor("checkout").map((s) => (
          <Route key={`co-${s}`} path={`/:lang/${s}`} component={CheckoutLang} />
        ))}
        {allSlugsFor("checkout").map((s) => (
          <Route key={`cc-${s}`} path={`/:lang/credits/${s}`} component={CreditsCheckoutLang} />
        ))}
        {allSlugsFor("dashboard").map((s) => (
          <Route key={`da-${s}`} path={`/:lang/${s}/account`} component={DashboardLang} />
        ))}
        {allSlugsFor("dashboard").map((s) => (
          <Route key={`dh-${s}`} path={`/:lang/${s}/help`} component={DashboardLang} />
        ))}
        {allSlugsFor("dashboard").map((s) => (
          <Route key={`db-${s}`} path={`/:lang/${s}`} component={DashboardLang} />
        ))}
        {allSlugsFor("purchases").map((s) => (
          <Route key={`pu-${s}`} path={`/:lang/${s}`} component={PurchasesLang} />
        ))}
        {allSlugsFor("free_vin_decoder").map((s) => (
          <Route key={`fd-${s}`} path={`/:lang/${s}`} component={FreeVinDecoderLang} />
        ))}
        {allSlugsFor("how_it_works").map((s) => (
          <Route key={`hw-${s}`} path={`/:lang/${s}`} component={HowItWorksLang} />
        ))}
        {allSlugsFor("faq").map((s) => (
          <Route key={`fq-${s}`} path={`/:lang/${s}`} component={FAQLang} />
        ))}
        {allSlugsFor("blog").map((s) => (
          <Route key={`bp-${s}`} path={`/:lang/${s}/:article`} component={BlogArticleLang} />
        ))}
        {allSlugsFor("blog").map((s) => (
          <Route key={`bi-${s}`} path={`/:lang/${s}`} component={BlogIndexLang} />
        ))}
        <Route path="/:lang/maintenance" component={MaintenanceLang} />
        {MeaningHintsDevLang ? (
          <Route path="/:lang/dev/meaning-hints" component={MeaningHintsDevLang} />
        ) : null}
        {/* Legacy api-b2b URLs → home (service not offered on VerifyKM) */}
        <Route path="/:lang/api-b2b/:region">
          {(params) => <Redirect to={params.lang ? `/${params.lang}` : "/en"} />}
        </Route>
        <Route path="/:lang/api-b2b">
          {(params) => <Redirect to={params.lang ? `/${params.lang}` : "/en"} />}
        </Route>

<Route path="/:lang" component={HomeLang} />

        <Route component={NotFoundLang} />
      </Switch>
      </MaintenanceGuard>
    </>
  );
}

function AppShell() {
  const [location] = useLocation();
  const resetKey = location.split("?")[0] ?? location;

  return (
    <RouteErrorBoundary scope="app" resetKey={resetKey}>
      <AuthProvider>
        <PresenceHeartbeat />
        <SiteAnalytics />
        <WarmCache />
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="verifykm-theme">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={basePath}>
          <AppShell />
        </WouterRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
