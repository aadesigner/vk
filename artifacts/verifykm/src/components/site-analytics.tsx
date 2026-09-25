import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicSettings, PUBLIC_SETTINGS_QUERY_KEY } from "@/lib/public-settings";
import {
  isPublicAnalyticsPath,
  isSiteTrackingPath,
  removeInjectedAnalytics,
  removeInjectedMetaPixel,
  removeInjectedPublicAnalytics,
} from "@/lib/analytics-scope";

const GTM_HEAD_ATTR = "data-verifykm-gtm-head";
const GTM_BODY_ATTR = "data-verifykm-gtm-body";
const GA_LOADER_ATTR = "data-verifykm-ga-loader";
const GA_CONFIG_ATTR = "data-verifykm-ga-config";
const CLARITY_LOADER_ATTR = "data-verifykm-clarity";
const META_PIXEL_ATTR = "data-verifykm-meta-pixel";

type AnalyticsPublicSettings = {
  analyticsGtmEnabled?: boolean;
  analyticsGtmContainerId?: string | null;
  analyticsGaEnabled?: boolean;
  analyticsGaMeasurementId?: string | null;
  analyticsClarityEnabled?: boolean;
  analyticsClarityProjectId?: string | null;
  analyticsMetaPixelEnabled?: boolean;
  analyticsMetaPixelId?: string | null;
};

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: ClarityStub;
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

type ClarityStub = ((...args: unknown[]) => void) & { q?: unknown[][] };

function injectGtm(containerId: string) {
  if (!document.querySelector(`script[${GTM_HEAD_ATTR}]`)) {
    const script = document.createElement("script");
    script.setAttribute(GTM_HEAD_ATTR, containerId);
    script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`;
    document.head.appendChild(script);
  }

  if (!document.querySelector(`noscript[${GTM_BODY_ATTR}]`)) {
    const noscript = document.createElement("noscript");
    noscript.setAttribute(GTM_BODY_ATTR, containerId);
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(noscript, document.body.firstChild);
  }
}

function injectGa(measurementId: string) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }

  if (!document.querySelector(`script[${GA_LOADER_ATTR}]`)) {
    const loader = document.createElement("script");
    loader.async = true;
    loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    loader.setAttribute(GA_LOADER_ATTR, measurementId);
    document.head.appendChild(loader);
  }

  if (!document.querySelector(`script[${GA_CONFIG_ATTR}]`)) {
    const config = document.createElement("script");
    config.setAttribute(GA_CONFIG_ATTR, measurementId);
    config.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}',{send_page_view:false});`;
    document.head.appendChild(config);
  }
}

function injectClarity(projectId: string) {
  if (document.querySelector(`script[${CLARITY_LOADER_ATTR}]`)) return;

  // Clarity's tag script calls window.clarity() immediately — stub must exist first (official snippet).
  if (!window.clarity) {
    const stub: ClarityStub = (...args: unknown[]) => {
      (stub.q = stub.q ?? []).push(args);
    };
    window.clarity = stub;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
  script.setAttribute(CLARITY_LOADER_ATTR, projectId);
  const first = document.getElementsByTagName("script")[0];
  if (first?.parentNode) {
    first.parentNode.insertBefore(script, first);
  } else {
    document.head.appendChild(script);
  }
}

function injectMetaPixel(pixelId: string) {
  if (document.querySelector(`script[${META_PIXEL_ATTR}]`)) return;

  const script = document.createElement("script");
  script.setAttribute(META_PIXEL_ATTR, pixelId);
  script.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');
fbq('track','PageView');`;
  document.head.appendChild(script);

  if (!document.querySelector(`noscript[${META_PIXEL_ATTR}]`)) {
    const noscript = document.createElement("noscript");
    noscript.setAttribute(META_PIXEL_ATTR, pixelId);
    noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1" alt="" />`;
    document.body.insertBefore(noscript, document.body.firstChild);
  }
}

function trackPageView(path: string, gaId: string | null, gtmEnabled: boolean) {
  if (!isPublicAnalyticsPath(path)) return;

  if (gtmEnabled) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "pageview",
      page_path: path,
      page_title: document.title,
    });
  }

  if (gaId && window.gtag) {
    window.gtag("event", "page_view", {
      page_path: path,
      page_title: document.title,
      send_to: gaId,
    });
  }
}

function trackMetaPageView(path: string) {
  if (!isSiteTrackingPath(path)) return;
  if (typeof window.fbq === "function") {
    window.fbq("track", "PageView");
  }
}

async function fetchAnalyticsSettings(): Promise<AnalyticsPublicSettings> {
  const d = await fetchPublicSettings();
  return {
    analyticsGtmEnabled: !!d.analyticsGtmEnabled,
    analyticsGtmContainerId: (d.analyticsGtmContainerId as string | null) ?? null,
    analyticsGaEnabled: !!d.analyticsGaEnabled,
    analyticsGaMeasurementId: (d.analyticsGaMeasurementId as string | null) ?? null,
    analyticsClarityEnabled: !!d.analyticsClarityEnabled,
    analyticsClarityProjectId: (d.analyticsClarityProjectId as string | null) ?? null,
    analyticsMetaPixelEnabled: !!d.analyticsMetaPixelEnabled,
    analyticsMetaPixelId: (d.analyticsMetaPixelId as string | null) ?? null,
  };
}

/**
 * Injects tracking tags based on admin Analytics settings.
 * - GTM / GA / Clarity: public marketing routes only (not admin / dashboard)
 * - Meta Pixel: public + client area when enabled with a Pixel ID (not admin)
 */
export function SiteAnalytics() {
  const [location] = useLocation();
  const injectedRef = useRef(false);
  const metaInjectedRef = useRef(false);
  const metaSkipNextPvRef = useRef(false);
  const configRef = useRef<{ gtm: string | null; ga: string | null; clarity: string | null; meta: string | null }>({
    gtm: null,
    ga: null,
    clarity: null,
    meta: null,
  });
  const publicTrackable = isPublicAnalyticsPath(location);
  const siteTrackable = isSiteTrackingPath(location);

  useEffect(() => {
    void import("@/lib/acquisition").then((m) => {
      m.captureAcquisitionOnce();
    });
  }, []);

  const { data: settings } = useQuery({
    queryKey: PUBLIC_SETTINGS_QUERY_KEY,
    queryFn: fetchAnalyticsSettings,
    staleTime: 5 * 60_000,
  });

  const gtmId = settings?.analyticsGtmEnabled && settings.analyticsGtmContainerId
    ? settings.analyticsGtmContainerId
    : null;
  const gaId = settings?.analyticsGaEnabled && settings.analyticsGaMeasurementId
    ? settings.analyticsGaMeasurementId
    : null;
  const clarityId = settings?.analyticsClarityEnabled && settings.analyticsClarityProjectId
    ? settings.analyticsClarityProjectId
    : null;
  const metaId = settings?.analyticsMetaPixelEnabled && settings.analyticsMetaPixelId
    ? settings.analyticsMetaPixelId
    : null;

  useEffect(() => {
    if (!siteTrackable) {
      removeInjectedAnalytics();
      injectedRef.current = false;
      metaInjectedRef.current = false;
      configRef.current = { gtm: null, ga: null, clarity: null, meta: null };
      return;
    }

    if (!publicTrackable) {
      removeInjectedPublicAnalytics();
      injectedRef.current = false;
      configRef.current = { ...configRef.current, gtm: null, ga: null, clarity: null };
    } else if (gtmId || gaId || clarityId) {
      if (gtmId) injectGtm(gtmId);
      if (gaId) injectGa(gaId);
      if (clarityId) injectClarity(clarityId);
      configRef.current = { ...configRef.current, gtm: gtmId, ga: gaId, clarity: clarityId };
      injectedRef.current = true;
      trackPageView(location, gaId, !!gtmId);
    }

    if (!metaId) {
      removeInjectedMetaPixel();
      metaInjectedRef.current = false;
      configRef.current = { ...configRef.current, meta: null };
      return;
    }

    injectMetaPixel(metaId);
    configRef.current = { ...configRef.current, meta: metaId };
    metaInjectedRef.current = true;
    // Base snippet already fires PageView — skip the next SPA location effect once.
    metaSkipNextPvRef.current = true;
  }, [gtmId, gaId, clarityId, metaId, publicTrackable, siteTrackable]); // eslint-disable-line react-hooks/exhaustive-deps -- inject + first pageview only

  useEffect(() => {
    if (!publicTrackable || !injectedRef.current) return;
    const { gtm, ga } = configRef.current;
    if (!gtm && !ga) return;
    trackPageView(location, ga, !!gtm);
  }, [location, publicTrackable]);

  useEffect(() => {
    if (!siteTrackable || !metaInjectedRef.current || !configRef.current.meta) return;
    if (metaSkipNextPvRef.current) {
      metaSkipNextPvRef.current = false;
      return;
    }
    trackMetaPageView(location);
  }, [location, siteTrackable]);

  return null;
}
