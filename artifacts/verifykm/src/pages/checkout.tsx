import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SEOHead } from "@/components/seo";
import { PriceAmount } from "@/components/marketing-price";
import { parseLangFromPath } from "@/lib/seo-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check, CheckCircle2, Tag, X, Loader2, ShieldCheck,
  Lock, Gauge, AlertTriangle, Users, Car, Zap, TrendingUp, ChevronDown, CreditCard, Coins,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLightMotion } from "@/hooks/use-light-motion";
import { translateClientError, translateCouponError } from "@/lib/translate-client-error";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { CHECKOUT_QUERY_OPTIONS, spreadQueryExtras } from "@/lib/query-options";
import { isPublicPaymentSettingsHydrated } from "@/lib/public-settings";
import { refreshClientAreaAfterUnlock } from "@/lib/client-area-queries";
import { invalidateVinReportCaches } from "@/lib/vin-report-cache";
import {
  formatVehicleTitle,
  isTrustworthyVinDecode,
  peekMatchesVin,
  shouldShowPendingVinDoubleCheck,
} from "@/lib/vin-decode-preview";
import { isVehicleTooOldForLookup } from "@workspace/vin-decode";
import {
  CHECKOUT_VIN_KEY,
  PENDING_VIN_KEY,
  clearCheckoutPaymentResumeState,
  consumeCheckoutPrefillOnly,
  markPaypalCheckoutAwaitingApproval,
  markPaypalCheckoutCapturePending,
  normalizeCheckoutVin,
  assignGuestVinAuth,
  persistVinForCheckout,
  resolveCheckoutPrefillVin,
  readPaypalCheckoutSession,
  shouldResumePaypalCapture,
} from "@/lib/checkout-vin-flow";
import {
  clearPokCheckoutSession,
  confirmPokOrderWithRetry,
  markPokCheckoutAwaitingConfirm,
  readPokCheckoutSession,
  writePokCheckoutSession,
} from "@/lib/pok-checkout-confirm";
import { cn } from "@/lib/utils";
import { VinLookupDisabledBanner } from "@/components/vin-lookup-disabled-banner";
import { CheckoutPaymentLogos, usePreloadCheckoutPaymentLogos } from "@/components/checkout-payment-logos";
import { PokGuestCheckout } from "@/components/pok-guest-checkout";
import { VinDecodeRecheckHint } from "@/components/vin-decode-recheck-hint";
import { VinPendingDoubleCheckHint } from "@/components/vin-pending-double-check-hint";
import { useVinLookupDisabledForUser } from "@/hooks/use-site-public-flags";
import { useTheme } from "@/components/theme-provider";

function isPaypalUserAbort(err: unknown): boolean {
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof (err as { message?: string }).message === "string"
          ? (err as { message: string }).message
          : String(err);
  return /popup close|window closed|can not open popup|cancel|detected pop-?up|popup closed|component closed|global_close|zoid_closed|destroyed|user closed/i.test(msg);
}

function paypalHostedFieldStyles(): Record<string, Record<string, string>> {
  const root = getComputedStyle(document.documentElement);
  const fg = root.getPropertyValue("--foreground").trim();
  const font = root.getPropertyValue("font-family").trim() || "inherit";
  return {
    input: {
      "font-size": "14px",
      "font-family": font,
      color: fg ? `hsl(${fg})` : "inherit",
    },
    ".invalid": { color: "hsl(0 84% 60%)" },
  };
}

const CHECKOUT_PANEL =
  "overflow-hidden rounded-[1.6rem] border border-slate-200/90 bg-white text-slate-950 shadow-[0_22px_50px_-36px_rgba(15,23,42,0.35)]";
const PREVIEW_ROW =
  "flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-3";
const PREVIEW_LBL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500";
const PREVIEW_ICO = "h-3.5 w-3.5 shrink-0 text-[#0088d4]";
const PREVIEW_BLUR = "text-[12px] font-semibold tabular-nums text-slate-800 select-none blur-[3.5px]";

type PaypalHostedFieldsInstance = {
  submit: (opts?: { contingencies?: string[] }) => Promise<{ orderId: string; liabilityShifted?: boolean }>;
  on: (event: string, handler: (evt: unknown) => void) => void;
  teardown?: () => Promise<void> | void;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => { render: (el: string | HTMLElement) => Promise<void>; close: () => void };
      HostedFields?: {
        isEligible: () => boolean;
        render: (opts: {
          createOrder: () => Promise<string>;
          fields: {
            number?: { selector: string; placeholder?: string };
            cvv?: { selector: string; placeholder?: string };
            expirationDate?: { selector: string; placeholder?: string };
          };
          styles?: Record<string, Record<string, string>>;
        }) => Promise<PaypalHostedFieldsInstance>;
      };
    };
  }
}

interface PublicSettings {
  paypalClientId: string | null;
  paypalSandbox: boolean;
  paypalEnableCards: boolean;
  pokEnabled?: boolean;
  pokEnv?: "staging" | "production";
}

interface CouponResult {
  valid: boolean;
  code: string;
  type: "percent" | "flat";
  value: number;
  discountAmount: number;
  finalPrice: number;
  isFree: boolean;
}

interface VinPeek {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  engine: string | null;
  country: string | null;
  wmi: string;
  decodeSource?: "cache" | "nhtsa" | "local" | "hybrid";
  fromCache: boolean;
  localDecode: boolean;
  dataAvailable?: boolean;
  manualPending?: boolean;
  vinNoAccess?: boolean;
  checkUnavailable?: boolean;
  checkUnavailableCode?: string;
  vehicleTooOld?: boolean;
  alreadyUnlocked?: boolean;
  lookupId?: number | null;
  deliveryInProgress?: boolean;
  pendingFreeCouponPaymentId?: number | null;
}

interface Props {
  params: { lang: string };
}


export default function Checkout({ params }: Props) {
  const { t, language } = useTranslation();
  const { isSignedIn, isLoaded, user, refreshUser } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const lightMotion = useLightMotion();
  usePreloadCheckoutPaymentLogos(true);

  // Fresh credit balance (admin edits / pack purchases) before showing Pay with credit.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void refreshUser();
  }, [isLoaded, isSignedIn, refreshUser]);

  const LOCKED_ROWS = [
    { icon: Gauge,         labelKey: "mileage_verification", blur: "47,832 km" },
    { icon: AlertTriangle, labelKey: "accident_history",     blur: "2 records" },
    { icon: Users,         labelKey: "previous_owners",      blur: "3 owners" },
    { icon: Car,           labelKey: "report_salvage",       blurKey: "checkout_mock_not_flagged" },
    { icon: ShieldCheck,   labelKey: "theft_records",        blurKey: "checkout_mock_not_reported" },
    { icon: TrendingUp,    labelKey: "market_value",         blur: "€8,400" },
  ];

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [vin, setVin] = useState(() => resolveCheckoutPrefillVin() ?? "");
  const [vinError, setVinError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [status, setStatus] = useState<"idle" | "creating" | "paying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  /** While status===paying: confirm payment vs unlock report (clearer than one spinner). */
  const [payingPhase, setPayingPhase] = useState<"payment" | "report">("payment");
  const [payMethod, setPayMethod] = useState<"paypal" | "card">("paypal");
  const [hostedFieldsReady, setHostedFieldsReady] = useState(false);
  // "unknown" = SDK not yet checked, "yes" = eligible, "no" = confirmed ineligible
  const [cardEligible, setCardEligible] = useState<"unknown" | "yes" | "no">("unknown");
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [pokOrderId, setPokOrderId] = useState<string | null>(null);
  const [pokPaymentId, setPokPaymentId] = useState<number | null>(null);
  const pokConfirmingRef = useRef(false);
  const pokResumeAttemptedRef = useRef(false);
  /** Prevents overlapping create-pok-order calls (double-click / Strict Mode). */
  const pokCreatingRef = useRef(false);
  const pokCreateGenRef = useRef(0);
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalInstanceRef = useRef<ReturnType<NonNullable<typeof window.paypal>["Buttons"]> | null>(null);
  /** Order created on "Proceed" so PayPal can open checkout immediately (async createOrder delays popup → blocked). */
  const pendingPaypalOrderRef = useRef<string | null>(null);
  /** Ignore spurious PayPal onError/onCancel while capture + lookup are running. */
  const paypalFlowPhaseRef = useRef<"idle" | "approving" | "fulfilling" | "done">("idle");
  const paidDeliveryRetryRef = useRef(false);
  const paypalResumeAttemptedRef = useRef(false);
  const checkoutRedirectedRef = useRef<string | null>(null);
  const freeCouponPaymentIdRef = useRef<number | null>(null);
  const checkoutActiveRef = useRef(true);
  const hostedFieldsRef = useRef<PaypalHostedFieldsInstance | null>(null);
  const hostedFieldsCreateOrderRef = useRef<(() => Promise<string>) | null>(null);
  const mountPaypalButtonsRef = useRef<(nvin: string, orderId: string) => Promise<boolean>>(async () => false);
  const submitVinLookupRef = useRef<
    (nvin: string, paypalOrderId?: string, paymentId?: number, attempt?: number) => Promise<boolean>
  >(async () => false);
  const finalizePaidCheckoutRef = useRef<(orderId: string, nvin: string) => Promise<void>>(async () => {});
  const paypalReturnHandledRef = useRef(false);
  /** Blocks PayPal resume / delivery retry until user explicitly starts payment (post-auth landing). */
  const postAuthPrefillLandingRef = useRef(false);

  const { data: pubSettings, isLoading: pubSettingsLoading, isError: pubSettingsError, isFetching: pubSettingsFetching, dataUpdatedAt: pubSettingsUpdatedAt, refetch: refetchPubSettings } = useQuery<PublicSettings>({
    queryKey: ["/api/payments/public-settings"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/payments/public-settings`);
      if (!r.ok) throw new Error("public_settings_failed");
      return r.json() as Promise<PublicSettings>;
    },
    ...spreadQueryExtras<PublicSettings>(CHECKOUT_QUERY_OPTIONS),
  });
  useQueryRecovery(pubSettingsError && !!pubSettings, pubSettingsFetching, refetchPubSettings);
  const paymentSettingsHydrated = isPublicPaymentSettingsHydrated(pubSettings, {
    isLoading: pubSettingsLoading,
    dataUpdatedAt: pubSettingsUpdatedAt,
  });

  // VIN peek — only fires when VIN is exactly 17 chars, has no invalid chars, and user is signed in
  const normalizedVin = vin.trim().toUpperCase();
  const vinHasInvalidChars = /[IOQ]/.test(normalizedVin);
  const vinIsValid = normalizedVin.length === 17 && !vinHasInvalidChars;

  const {
    data: peek,
    isFetching: peekLoading,
    isError: peekError,
  } = useQuery<VinPeek>({
    queryKey: ["/api/vin/peek", normalizedVin],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/vin/peek/${normalizedVin}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("peek_error");
      return r.json() as Promise<VinPeek>;
    },
    enabled: vinIsValid && !!isSignedIn,
    retry: false,
    ...spreadQueryExtras<VinPeek>(CHECKOUT_QUERY_OPTIONS),
  });

  const peekForVin = peekMatchesVin(peek, normalizedVin) ? peek : undefined;
  const peekStale = !!peek && !peekMatchesVin(peek, normalizedVin);
  const peekLoadingUi = peekLoading || (vinIsValid && !!isSignedIn && peekStale);
  const vinLookupDisabled = useVinLookupDisabledForUser(user?.isAdmin);

  const {
    displayPrice: salePrice,
    basePrice: standardPrice,
    isDiscount,
    loading: pricingLoading,
    fmtPrice,
    currency,
    currencySymbol,
  } = useDisplayPrice();
  const promoDiscountAmount =
    isDiscount && standardPrice != null && salePrice != null
      ? Math.max(0, standardPrice - salePrice)
      : 0;
  const subtotalPrice = salePrice ?? 0;
  const finalPrice = couponResult ? couponResult.finalPrice : subtotalPrice;
  const couponDiscountAmount = couponResult?.discountAmount ?? 0;
  /** Prefer server `isFree`; also treat finalPrice 0 so free coupons never take a paid gateway path. */
  const isFreeCoupon = !!(
    couponResult
    && (couponResult.isFree || Number(couponResult.finalPrice) === 0)
  );

  const resetGatewayCheckoutUi = () => {
    clearCheckoutPaymentResumeState();
    setPaymentStarted(false);
    setPokOrderId(null);
    setPokPaymentId(null);
    pendingPaypalOrderRef.current = null;
    paypalFlowPhaseRef.current = "idle";
    paypalInstanceRef.current?.close();
    paypalInstanceRef.current = null;
    if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
  };
  const promoSavePercent =
    isDiscount && standardPrice && salePrice && standardPrice > 0
      ? Math.round((promoDiscountAmount / standardPrice) * 100)
      : 0;

  // Redirect to sign-up if not authenticated (wait until auth has loaded).
  // Full-page assign keeps ?vin= (+ UTMs) in the address bar — more reliable than SPA navigate.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      const stored = vin ? persistVinForCheckout(vin) : resolveCheckoutPrefillVin();
      assignGuestVinAuth(language, stored);
    }
  }, [isLoaded, isSignedIn, language, vin]);

  useEffect(() => {
    checkoutActiveRef.current = true;
    return () => { checkoutActiveRef.current = false; };
  }, []);

  // After sign-up/sign-in with a pending VIN: prefill only — never auto-open payment.
  useLayoutEffect(() => {
    if (!consumeCheckoutPrefillOnly()) return;
    postAuthPrefillLandingRef.current = true;
    clearCheckoutPaymentResumeState();
    setPaymentStarted(false);
    setStatus("idle");
    setErrorMsg("");
    pendingPaypalOrderRef.current = null;
    paypalFlowPhaseRef.current = "idle";
    paidDeliveryRetryRef.current = false;
    paypalResumeAttemptedRef.current = false;
    freeCouponPaymentIdRef.current = null;
    checkoutRedirectedRef.current = null;
    paypalInstanceRef.current?.close();
    paypalInstanceRef.current = null;
    if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
  }, []);

  // Reset payment state when the VIN actually changes (skip initial mount — avoids wiping an in-flight create).
  const prevNormalizedVinRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevNormalizedVinRef.current;
    prevNormalizedVinRef.current = normalizedVin;
    if (prev === null || prev === normalizedVin) return;
    pokCreatingRef.current = false;
    pokCreateGenRef.current += 1;
    setPaymentStarted(false);
    setStatus("idle");
    setErrorMsg("");
    setPokOrderId(null);
    setPokPaymentId(null);
    pendingPaypalOrderRef.current = null;
    paypalFlowPhaseRef.current = "idle";
    paidDeliveryRetryRef.current = false;
    paypalResumeAttemptedRef.current = false;
    paypalReturnHandledRef.current = false;
    checkoutRedirectedRef.current = null;
    freeCouponPaymentIdRef.current = null;
    clearCheckoutPaymentResumeState();
    paypalInstanceRef.current?.close();
    paypalInstanceRef.current = null;
    if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
  }, [normalizedVin]);

  // Surface invalid-character error as soon as the user reaches 17 chars
  useEffect(() => {
    if (normalizedVin.length === 17 && vinHasInvalidChars) {
      setVinError(t("vin_error_invalid_chars"));
    }
  }, [normalizedVin, vinHasInvalidChars]);

  // While paid delivery runs, refresh peek so we can redirect once the VIN unlocks.
  // Do NOT invalidate during "creating" — that races paymentAllowed and can unmount the POK form
  // right after create-pok-order succeeds (looks like "Failed to create payment").
  useEffect(() => {
    if (status !== "paying") return;
    if (!vinIsValid || !isSignedIn) return;
    const refreshPeek = () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/vin/peek", normalizedVin] });
    };
    refreshPeek();
    const timer = setInterval(refreshPeek, 5000);
    return () => clearInterval(timer);
  }, [status, vinIsValid, isSignedIn, normalizedVin, queryClient]);

  // Redirect to existing report if VIN already unlocked
  useEffect(() => {
    if (peekForVin?.alreadyUnlocked && peekForVin.lookupId && normalizedVin.length === 17) {
      goToVinReport(normalizedVin, peekForVin.lookupId, { refreshClientArea: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirect once when peek resolves
  }, [peekForVin?.alreadyUnlocked, peekForVin?.lookupId, normalizedVin]);

  // Inject PayPal SDK once we have the client ID; include hosted-fields component when cards enabled
  useEffect(() => {
    if (!pubSettings?.paypalClientId) return;
    const enableCards = pubSettings.paypalEnableCards ?? false;
    const components = enableCards ? "buttons,hosted-fields" : "buttons";
    const existing = document.getElementById("paypal-sdk");
    if (existing) {
      const needsReload = enableCards && !existing.getAttribute("src")?.includes("hosted-fields");
      if (!needsReload) return;
      existing.remove();
    }
    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src = `https://www.paypal.com/sdk/js?client-id=${pubSettings.paypalClientId}&currency=${currency}&intent=capture&components=${components}`;
    script.async = true;
    document.body.appendChild(script);
    return () => { document.getElementById("paypal-sdk")?.remove(); };
  }, [pubSettings?.paypalClientId, pubSettings?.paypalEnableCards, currency]);

  // Post-SDK probe: check HostedFields eligibility after SDK loads, independently of tab.
  // Only sets "no" for confirmed isEligible() === false; SDK load timeout leaves state "unknown"
  // so a subsequent card-tab activation can retry without a permanent lockout.
  useEffect(() => {
    if (!pubSettings?.paypalEnableCards || !pubSettings?.paypalClientId) return;
    if (cardEligible !== "unknown") return; // already determined, no need to re-probe

    let cancelled = false;
    const probe = async () => {
      let attempts = 0;
      while (!window.paypal?.HostedFields && attempts < 50) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
      if (cancelled) return;
      // SDK timed out loading — transient issue, leave state as "unknown" so user can retry
      if (!window.paypal?.HostedFields) return;
      // Confirmed by SDK
      setCardEligible(window.paypal.HostedFields.isEligible() ? "yes" : "no");
    };
    probe();
    return () => { cancelled = true; };
  }, [pubSettings?.paypalEnableCards, pubSettings?.paypalClientId, cardEligible]);

  // Default payment tab is PayPal (`useState` above). Card remains available when POK/hosted fields are configured.

  // Auto-switch back to PayPal when confirmed ineligible (unless POK cards are available)
  useEffect(() => {
    if (cardEligible === "no" && !pubSettings?.pokEnabled) {
      setPayMethod("paypal");
    }
  }, [cardEligible, pubSettings?.pokEnabled]);

  // Initialize PayPal Hosted Fields when card tab is active (skipped when POK is configured)
  useEffect(() => {
    if (payMethod !== "card") {
      hostedFieldsRef.current = null;
      setHostedFieldsReady(false);
      // Do not touch cardEligible here — eligibility is session-level state managed by the
      // post-SDK probe above. Only "no" is permanent (confirmed by isEligible()); "unknown"
      // allows retry after a transient SDK load failure.
      setCardErrors({});
      return;
    }
    if (pubSettings?.pokEnabled) return;
    if (!pubSettings?.paypalEnableCards || !pubSettings.paypalClientId) return;

    let cancelled = false;
    const init = async () => {
      let attempts = 0;
      while (!window.paypal?.HostedFields && attempts < 50) {
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 200));
        attempts++;
      }
      if (cancelled) return;
      // SDK still not loaded — transient, bail without marking ineligible
      if (!window.paypal?.HostedFields) { setHostedFieldsReady(false); return; }
      // Confirmed ineligible by SDK — mark permanently for this session
      if (!window.paypal.HostedFields.isEligible()) { setCardEligible("no"); return; }
      try {
        const instance = await window.paypal.HostedFields.render({
          createOrder: async () => {
            const fn = hostedFieldsCreateOrderRef.current;
            if (!fn) throw new Error("No order function");
            return fn();
          },
          fields: {
            number: { selector: "#hf-card-number", placeholder: "4111 1111 1111 1111" },
            cvv: { selector: "#hf-cvv", placeholder: "···" },
            expirationDate: { selector: "#hf-expiry", placeholder: "MM/YYYY" },
          },
          styles: paypalHostedFieldStyles(),
        });
        if (cancelled) return;
        hostedFieldsRef.current = instance;
        setHostedFieldsReady(true);
        instance.on("validityChange", (evt) => {
          const e = evt as { emittedBy?: string; fields?: Record<string, { isPotentiallyValid: boolean }> };
          const field = e.emittedBy;
          if (!field || !e.fields) return;
          if (!e.fields[field]?.isPotentiallyValid) {
            setCardErrors(prev => ({ ...prev, [field]: t("checkout_card_invalid_field") }));
          } else {
            setCardErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
          }
        });
      } catch {
        // Render failure is transient (e.g. DOM not ready) — don't mark ineligible
        if (!cancelled) setHostedFieldsReady(false);
      }
    };
    init();
    return () => {
      cancelled = true;
      void hostedFieldsRef.current?.teardown?.();
      hostedFieldsRef.current = null;
    };
  }, [payMethod, pubSettings?.paypalEnableCards, pubSettings?.paypalClientId, pubSettings?.pokEnabled, resolvedTheme, t]);

  const validateVin = () => {
    const v = vin.trim().toUpperCase();
    if (!v) { setVinError(t("vin_error_required")); return null; }
    if (v.length !== 17) { setVinError(t("vin_error_length")); return null; }
    if (/[IOQ]/.test(v)) { setVinError(t("vin_error_invalid_chars")); return null; }
    setVinError("");
    return v;
  };

  const goToVinReport = (reportVin: string, lookupId?: number, opts?: { refreshClientArea?: boolean }) => {
    const target = normalizeCheckoutVin(reportVin);
    if (checkoutRedirectedRef.current === target) return;
    checkoutRedirectedRef.current = target;
    sessionStorage.removeItem(PENDING_VIN_KEY);
    sessionStorage.removeItem(CHECKOUT_VIN_KEY);
    // Clear any stale 404 from a prior visit to this VIN route before delivery finished.
    invalidateVinReportCaches(queryClient, target, lookupId);
    // Only refresh dashboard lists once the report is viewable — refreshing while
    // status is still "fulfilling" caches a stale badge until the next refetch.
    if (opts?.refreshClientArea) {
      refreshClientAreaAfterUnlock(queryClient);
    }
    setLocation(`/${language}/vin/${target}`);
  };

  type VinDeliveryProbe = { status?: string; vin?: string };

  const fetchVinDeliveryStatus = async (
    lookupId: number | undefined,
    reportVin: string,
  ): Promise<VinDeliveryProbe | null> => {
    const urls = [
      lookupId != null ? `${basePath}/api/vin/${lookupId}` : null,
      `${basePath}/api/vin/${encodeURIComponent(reportVin)}`,
    ].filter((url): url is string => Boolean(url));

    for (const url of urls) {
      try {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) continue;
        return await r.json() as VinDeliveryProbe;
      } catch {
        // try next probe URL
      }
    }
    return null;
  };

  const isDeliverableVinStatus = (deliveryStatus?: string) =>
    deliveryStatus === "complete" || deliveryStatus === "pending_manual";

  const isStillRetrievingVinStatus = (deliveryStatus?: string) =>
    deliveryStatus === "fulfilling";

  const completeCheckoutDelivery = (reportVin: string, lookupId?: number) => {
    setStatus("success");
    paypalFlowPhaseRef.current = "done";
    freeCouponPaymentIdRef.current = null;
    clearCheckoutPaymentResumeState();
    clearPokCheckoutSession();
    goToVinReport(reportVin, lookupId, { refreshClientArea: true });
  };

  const redirectToFulfillingReport = (reportVin: string, lookupId?: number) => {
    setStatus("success");
    paypalFlowPhaseRef.current = "fulfilling";
    clearCheckoutPaymentResumeState();
    goToVinReport(reportVin, lookupId, { refreshClientArea: false });
  };

  const deliveryFetchErrorMsg = () =>
    isFreeCoupon
      ? t("checkout_error_free_coupon_fetch")
      : t("checkout_error_payment_fetch");

  const tryResumeVinDelivery = async (
    lookupId: number | undefined,
    reportVin: string,
  ): Promise<boolean> => {
    const probe = await fetchVinDeliveryStatus(lookupId, reportVin);
    if (isDeliverableVinStatus(probe?.status)) {
      completeCheckoutDelivery(probe?.vin ?? reportVin, lookupId);
      return true;
    }
    if (isStillRetrievingVinStatus(probe?.status)) {
      redirectToFulfillingReport(probe?.vin ?? reportVin, lookupId);
      return true;
    }
    return false;
  };

  const recoverVinDelivery = async (
    lookupId: number | undefined,
    reportVin: string,
    paymentId?: number,
  ): Promise<boolean> => {
    if (await tryResumeVinDelivery(lookupId, reportVin)) return true;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 400));
      if (!checkoutActiveRef.current) return false;
      if (await tryResumeVinDelivery(lookupId, reportVin)) return true;
    }
    if (isFreeCoupon && paymentId) {
      try {
        const resp = await fetch(`${basePath}/api/vin/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ vin: reportVin, paymentId }),
        });
        const data = await resp.json() as {
          id?: number;
          vin?: string;
          status?: string;
          fulfilling?: boolean;
        };
        if ((resp.status === 202 || data.status === "fulfilling" || data.fulfilling) && data.id) {
          for (let poll = 0; poll < 30; poll++) {
            if (!checkoutActiveRef.current) return false;
            if (poll > 0) await new Promise((r) => setTimeout(r, 1000));
            if (await tryResumeVinDelivery(data.id, reportVin)) return true;
          }
          if (await tryResumeVinDelivery(data.id, reportVin)) return true;
        } else if (resp.ok && data.id) {
          completeCheckoutDelivery(data.vin ?? reportVin, data.id);
          return true;
        }
      } catch {
        // fall through to failure
      }
    }
    return false;
  };

  const failVinDelivery = async (
    lookupId: number | undefined,
    reportVin: string,
    paymentId: number | undefined,
    message: string,
  ): Promise<boolean> => {
    if (await recoverVinDelivery(lookupId, reportVin, paymentId)) return true;
    setErrorMsg(message);
    setStatus("error");
    return false;
  };

  const handleUnlockVinForEdit = () => {
    setPaymentStarted(false);
    clearCheckoutPaymentResumeState();
    paypalInstanceRef.current?.close();
    paypalInstanceRef.current = null;
    if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
    setStatus("idle");
    setErrorMsg("");
  };

  const handleVinInputChange = (raw: string) => {
    if (paymentStarted && !isFreeCoupon) return;
    const next = raw.replace(/\s/g, "").toUpperCase();
    setVin(next);
    setVinError("");
    if (next) {
      sessionStorage.setItem(CHECKOUT_VIN_KEY, next);
    } else {
      sessionStorage.removeItem(CHECKOUT_VIN_KEY);
      sessionStorage.removeItem(PENDING_VIN_KEY);
    }
    // Drop ?vin= so URL sync does not overwrite manual edits
    const params = new URLSearchParams(window.location.search);
    if (params.has("vin")) {
      params.delete("vin");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  };

  // Apply ?vin= / stored referral VIN whenever the route location changes.
  // Wouter's `location` omits the query string, so always read window.location.search.
  useLayoutEffect(() => {
    const resolved = resolveCheckoutPrefillVin(window.location.search);
    if (!resolved) return;
    setVin((prev) => (prev === resolved ? prev : resolved));
  }, [location]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    setCouponResult(null);
    // Always clear any in-progress PayPal/POK session before applying a new price.
    resetGatewayCheckoutUi();
    setStatus("idle");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/payments/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: couponCode.trim().toUpperCase() }),
      });
      const data = await resp.json() as CouponResult & { error?: string };
      if (!resp.ok || data.error) { setCouponError(translateCouponError(t, data.error)); return; }
      if (data.isFree || data.finalPrice === 0) {
        paypalResumeAttemptedRef.current = true;
      }
      setCouponResult({
        ...data,
        code: String(data.code ?? couponCode).trim().toUpperCase(),
        finalPrice: Number(data.finalPrice),
        discountAmount: Number(data.discountAmount) || 0,
        value: Number(data.value),
        isFree: !!(data.isFree || Number(data.finalPrice) === 0),
      });
    } catch {
      setCouponError(t("checkout_error_coupon_failed"));
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponResult(null);
    setCouponCode("");
    setCouponError("");
    setStatus("idle");
    setErrorMsg("");
    resetGatewayCheckoutUi();
  };

  const createOrder = async (nvin: string): Promise<string | null> => {
    setStatus("creating");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/payments/create-paypal-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vin: nvin,
          couponCode: String(couponResult?.code ?? couponCode ?? "").trim().toUpperCase() || undefined,
        }),
      });
      const data = await resp.json() as {
        orderId?: string; free?: boolean; paymentId?: number; error?: string; code?: string; alreadyUnlocked?: boolean;
        lookupId?: number | null;
      };
      if (resp.status === 409 || data.code === "ALREADY_UNLOCKED") {
        goToVinReport(nvin, data.lookupId ?? undefined, { refreshClientArea: true });
        return null;
      }
      if (data.code === "VIN_NO_DATA") {
        setErrorMsg(t("vin_not_in_db"));
        setStatus("error");
        return null;
      }
      if (data.code === "VIN_CHECK_UNAVAILABLE") {
        setErrorMsg(t("checkout_check_unavailable_desc"));
        setStatus("error");
        return null;
      }
      if (!resp.ok || data.error) {
        setErrorMsg(translateClientError(t, data.code, data.error));
        setStatus("error");
        return null;
      }
      if (data.free && data.paymentId) {
        freeCouponPaymentIdRef.current = data.paymentId;
        await submitVinLookup(nvin, undefined, data.paymentId);
        return null;
      }
      return data.orderId ?? null;
    } catch {
      setErrorMsg(t("checkout_error_payment_create"));
      setStatus("error");
      return null;
    }
  };

  const submitVinLookup = async (
    nvin: string,
    paypalOrderId?: string,
    paymentId?: number,
    attempt = 0,
  ): Promise<boolean> => {
    setStatus("paying");
    setPayingPhase("report");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/vin/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vin: nvin,
          ...(paypalOrderId ? { paypalOrderId } : {}),
          ...(paymentId ? { paymentId } : {}),
        }),
      });
      const data = await resp.json() as {
        id?: number;
        vin?: string;
        status?: string;
        fulfilling?: boolean;
        error?: string;
        code?: string;
      };

      if ((resp.status === 202 || data.status === "fulfilling" || data.fulfilling) && data.id) {
        paypalFlowPhaseRef.current = "fulfilling";
        const maxAttempts = 120;
        for (let poll = 0; poll < maxAttempts; poll++) {
          if (!checkoutActiveRef.current) return false;
          if (poll > 0) await new Promise((r) => setTimeout(r, 1000));
          try {
            const pollResp = await fetch(`${basePath}/api/vin/${data.id}`, { credentials: "include" });
            if (!checkoutActiveRef.current) return false;
            if (!pollResp.ok) continue;
            const pollData = await pollResp.json() as { status?: string; vin?: string; error?: string; code?: string };
            if (pollData.status === "complete" || pollData.status === "pending_manual") {
              completeCheckoutDelivery(pollData.vin ?? nvin, data.id);
              return true;
            }
            if (pollData.status === "fulfilling") {
              // Instant handoff: report page shows retrieving UI (not "not in database").
              redirectToFulfillingReport(pollData.vin ?? nvin, data.id);
              return true;
            }
            if (pollData.status === "error") {
              return failVinDelivery(
                data.id,
                nvin,
                paymentId,
                translateClientError(t, pollData.code, pollData.error),
              );
            }
          } catch {
            // transient poll failure — keep trying
          }
        }
        return failVinDelivery(data.id, nvin, paymentId, deliveryFetchErrorMsg());
      }

      if (resp.ok && data.id) {
        completeCheckoutDelivery(data.vin ?? nvin, data.id);
        return true;
      }

      if (attempt === 0 && paypalOrderId) {
        return submitVinLookup(nvin, undefined, paymentId, 1);
      }
      if (attempt === 1 && paypalOrderId) {
        const capResp = await fetch(`${basePath}/api/payments/capture-paypal-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId: paypalOrderId }),
        });
        const capData = await capResp.json() as { success?: boolean; paymentId?: number };
        if (capResp.ok && capData.success) {
          return submitVinLookup(nvin, paypalOrderId, capData.paymentId, 2);
        }
      }

      setErrorMsg(translateClientError(t, data.code, data.error));
      setStatus("error");
      return false;
    } catch {
      if (attempt === 0) {
        return submitVinLookup(nvin, undefined, paymentId, 1);
      }
      if (await recoverVinDelivery(undefined, nvin, paymentId)) return true;
      return failVinDelivery(undefined, nvin, paymentId, deliveryFetchErrorMsg());
    }
  };

  submitVinLookupRef.current = submitVinLookup;

  const finalizePaidCheckout = useCallback(async (orderId: string, nvin: string) => {
    if (paypalFlowPhaseRef.current === "approving" || paypalFlowPhaseRef.current === "fulfilling" || paypalFlowPhaseRef.current === "done") {
      return;
    }
    if (!checkoutActiveRef.current) return;
    paypalFlowPhaseRef.current = "approving";
    setPaymentStarted(true);
    setStatus("paying");
    setPayingPhase("payment");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/payments/capture-paypal-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      if (!checkoutActiveRef.current) return;
      const result = await resp.json() as { success?: boolean; error?: string; code?: string; vin?: string; paymentId?: number };
      if (!resp.ok || !result.success) {
        if (result.code === "PAYMENT_NOT_COMPLETED") {
          markPaypalCheckoutAwaitingApproval(orderId, nvin);
          paypalFlowPhaseRef.current = "idle";
          setStatus("idle");
          setErrorMsg("");
          await mountPaypalButtonsRef.current(nvin, orderId);
          return;
        }
        if (resp.status === 404 || result.code === "PAYMENT_NOT_FOUND") {
          clearCheckoutPaymentResumeState();
          setPaymentStarted(false);
          setErrorMsg(t("checkout_error_payment_create"));
        } else {
          setErrorMsg(translateClientError(t, result.code, result.error));
        }
        setStatus("error");
        paypalFlowPhaseRef.current = "idle";
        return;
      }
      paypalFlowPhaseRef.current = "fulfilling";
      const delivered = await submitVinLookupRef.current(result.vin ?? nvin, orderId, result.paymentId);
      if (!delivered) {
        paypalFlowPhaseRef.current = "idle";
      }
    } catch {
      if (!checkoutActiveRef.current) return;
      setErrorMsg(t("checkout_error_capture"));
      setStatus("error");
      paypalFlowPhaseRef.current = "idle";
    }
  }, [t]);

  const mountPaypalButtons = useCallback(async (nvin: string, orderId: string): Promise<boolean> => {
    if (!checkoutActiveRef.current) return false;
    if (!pubSettings?.paypalClientId) {
      // Incomplete OAuth seed — resume effect will retry once API settings hydrate.
      if (!isPublicPaymentSettingsHydrated(pubSettings, {
        isLoading: pubSettingsLoading,
        dataUpdatedAt: pubSettingsUpdatedAt,
      })) {
        return false;
      }
      setErrorMsg(t("checkout_payment_not_configured"));
      setStatus("error");
      setPaymentStarted(false);
      return false;
    }
    let attempts = 0;
    while (!window.paypal && attempts < 30) {
      if (!checkoutActiveRef.current) return false;
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    if (!window.paypal) {
      setErrorMsg(t("checkout_error_paypal_load"));
      setStatus("error");
      setPaymentStarted(false);
      return false;
    }
    if (!paypalContainerRef.current) {
      return false;
    }

    setPaymentStarted(true);
    setStatus("idle");
    setErrorMsg("");
    paypalFlowPhaseRef.current = "idle";
    paypalInstanceRef.current?.close();
    paypalInstanceRef.current = null;
    pendingPaypalOrderRef.current = orderId;

    const buttons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        color: resolvedTheme === "dark" ? "white" : "blue",
        shape: "rect",
        label: "pay",
        height: 48,
      },
      createOrder: () => {
        const id = pendingPaypalOrderRef.current;
        if (!id) throw new Error("Order not ready");
        return id;
      },
      onApprove: async (data: { orderID: string }) => {
        markPaypalCheckoutCapturePending(data.orderID, nvin);
        pendingPaypalOrderRef.current = null;
        await finalizePaidCheckoutRef.current(data.orderID, nvin);
      },
      onError: (err: unknown) => {
        pendingPaypalOrderRef.current = null;
        if (paypalFlowPhaseRef.current !== "idle") {
          return;
        }
        if (isPaypalUserAbort(err)) {
          setStatus("idle");
          setPaymentStarted(false);
          clearCheckoutPaymentResumeState();
          paypalInstanceRef.current?.close();
          paypalInstanceRef.current = null;
          if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
          return;
        }
        setErrorMsg(t("checkout_error_payment_failed"));
        setStatus("error");
      },
      onCancel: () => {
        pendingPaypalOrderRef.current = null;
        if (paypalFlowPhaseRef.current !== "idle") {
          return;
        }
        setStatus("idle");
        setPaymentStarted(false);
        clearCheckoutPaymentResumeState();
        paypalInstanceRef.current?.close();
        paypalInstanceRef.current = null;
        if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
      },
    });
    paypalInstanceRef.current = buttons;
    try {
      paypalContainerRef.current.innerHTML = "";
      await buttons.render(paypalContainerRef.current);
      return true;
    } catch {
      pendingPaypalOrderRef.current = null;
      setPaymentStarted(false);
      setErrorMsg(t("checkout_error_paypal_load"));
      setStatus("error");
      return false;
    }
  }, [pubSettings?.paypalClientId, pubSettingsLoading, pubSettingsUpdatedAt, resolvedTheme, t]);

  useLayoutEffect(() => {
    mountPaypalButtonsRef.current = mountPaypalButtons;
    finalizePaidCheckoutRef.current = finalizePaidCheckout;
  }, [mountPaypalButtons, finalizePaidCheckout]);

  // Paid or free-coupon delivery still in flight — retry lookup without charging again.
  useEffect(() => {
    if (postAuthPrefillLandingRef.current) return;
    if (normalizedVin.length !== 17) return;
    const pendingFreePaymentId =
      peekForVin?.pendingFreeCouponPaymentId ?? freeCouponPaymentIdRef.current ?? undefined;
    const paidNeedsDelivery = !!(peekForVin?.alreadyUnlocked && !peekForVin.lookupId);
    const freeNeedsDelivery = !!(
      (peekForVin?.deliveryInProgress || pendingFreePaymentId)
      && pendingFreePaymentId
      && !peekForVin?.lookupId
    );
    if (!paidNeedsDelivery && !freeNeedsDelivery) return;
    if (paidDeliveryRetryRef.current) return;
    if (paypalFlowPhaseRef.current !== "idle" || status === "paying" || status === "creating") return;
    paidDeliveryRetryRef.current = true;
    void submitVinLookup(
      normalizedVin,
      undefined,
      freeNeedsDelivery ? pendingFreePaymentId : undefined,
    ).then((ok) => {
      if (!ok) paidDeliveryRetryRef.current = false;
    });
  }, [
    peekForVin?.alreadyUnlocked,
    peekForVin?.lookupId,
    peekForVin?.deliveryInProgress,
    peekForVin?.pendingFreeCouponPaymentId,
    normalizedVin,
    status,
  ]);

  // Resume PayPal after refresh: re-show buttons if still awaiting approval, or retry capture if approved.
  useEffect(() => {
    if (postAuthPrefillLandingRef.current) return;
    if (!isLoaded || !isSignedIn || !vinIsValid || peekLoadingUi) return;
    if (!pubSettings?.paypalClientId || pubSettingsLoading) return;
    if (paypalResumeAttemptedRef.current) return;
    // Never remount PayPal over a free coupon — that races and shows "Payment failed".
    if (isFreeCoupon) return;
    // Card / POK checkout must not resume a stale PayPal session (overwrites UI with create/capture errors).
    if (payMethod === "card" || !!pokOrderId || status === "creating" || pokCreatingRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("token")) return;

    const session = readPaypalCheckoutSession();
    if (!session) return;
    if (session.vin !== normalizedVin) return;
    if (peekForVin?.alreadyUnlocked && peekForVin.lookupId) return;

    const captureResume = shouldResumePaypalCapture(session);
    const peekPayable =
      !vinLookupDisabled
      && peekForVin?.dataAvailable === true
      && !peekForVin?.checkUnavailable
      && !(peekForVin?.vehicleTooOld === true || isVehicleTooOldForLookup(peekForVin?.year));
    if (!captureResume && !peekPayable) return;

    paypalResumeAttemptedRef.current = true;
    pendingPaypalOrderRef.current = session.orderId;

    if (captureResume) {
      setPaymentStarted(true);
      void finalizePaidCheckout(session.orderId, normalizedVin);
      return;
    }

    void mountPaypalButtons(normalizedVin, session.orderId).then((mounted) => {
      if (!mounted) paypalResumeAttemptedRef.current = false;
    });
  }, [
    isLoaded,
    isSignedIn,
    vinIsValid,
    peekLoadingUi,
    normalizedVin,
    peekForVin?.alreadyUnlocked,
    peekForVin?.lookupId,
    peekForVin?.dataAvailable,
    peekForVin?.checkUnavailable,
    peekForVin?.vehicleTooOld,
    peekForVin?.year,
    pubSettings?.paypalClientId,
    pubSettingsLoading,
    vinLookupDisabled,
    isFreeCoupon,
    payMethod,
    pokOrderId,
    status,
    finalizePaidCheckout,
    mountPaypalButtons,
  ]);

  // PayPal full-page return (?token=ORDER_ID) after mobile/redirect checkout.
  useEffect(() => {
    if (!isSignedIn || !vinIsValid) return;
    if (paypalReturnHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token")?.toUpperCase() ?? "";
    if (!/^[A-Z0-9]{8,20}$/.test(token)) return;

    paypalReturnHandledRef.current = true;
    paypalResumeAttemptedRef.current = true;

    const clean = new URL(window.location.href);
    clean.searchParams.delete("token");
    clean.searchParams.delete("PayerID");
    window.history.replaceState({}, "", clean.pathname + clean.search);

    setPaymentStarted(true);
    markPaypalCheckoutCapturePending(token, normalizedVin);
    void finalizePaidCheckout(token, normalizedVin);
  }, [isSignedIn, vinIsValid, normalizedVin, finalizePaidCheckout]);

  const creditBalance = user?.creditBalance ?? 0;
  const canPayWithCredits = creditBalance >= 1 && !isFreeCoupon;

  const handlePayWithCredits = async () => {
    if (!vinIsValid || !canPayWithCredits) return;
    setStatus("paying");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/payments/redeem-credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vin: normalizedVin }),
      });
      const data = await resp.json() as {
        paymentId?: number;
        creditBalance?: number;
        error?: string;
        code?: string;
        alreadyUnlocked?: boolean;
        lookupId?: number | null;
      };
      if (resp.status === 409 || data.code === "ALREADY_UNLOCKED") {
        goToVinReport(normalizedVin, data.lookupId ?? undefined, { refreshClientArea: true });
        return;
      }
      if (data.code === "VIN_NO_DATA") {
        setErrorMsg(t("vin_not_in_db"));
        setStatus("error");
        return;
      }
      if (data.code === "INSUFFICIENT_CREDITS") {
        setErrorMsg(t("checkout_insufficient_credits"));
        setStatus("error");
        void refreshUser();
        return;
      }
      if (!resp.ok || !data.paymentId) {
        setErrorMsg(translateClientError(t, data.code, data.error) || t("checkout_error_payment_create"));
        setStatus("error");
        return;
      }
      void refreshUser();
      await submitVinLookupRef.current(normalizedVin, undefined, data.paymentId);
    } catch {
      setErrorMsg(t("checkout_error_payment_create"));
      setStatus("error");
    }
  };

  const handleProceedToPayment = async () => {
    postAuthPrefillLandingRef.current = false;
    const nvin = validateVin();
    if (!nvin) return;
    if (isFreeCoupon) { await createOrder(nvin); return; }
    // OAuth-only public-settings seed has no paypalClientId yet — wait, don't alarm.
    if (!pubSettings?.paypalClientId) {
      if (!paymentSettingsHydrated) return;
      setErrorMsg(t("checkout_payment_not_configured"));
      setStatus("error");
      return;
    }

    const orderId = await createOrder(nvin);
    if (!orderId) {
      setPaymentStarted(false);
      return;
    }
    markPaypalCheckoutAwaitingApproval(orderId, nvin);
    await mountPaypalButtons(nvin, orderId);
  };

  const handleCardPayment = async () => {
    postAuthPrefillLandingRef.current = false;
    const nvin = validateVin();
    if (!nvin) return;

    const appliedCouponCode = String(couponResult?.code ?? couponCode ?? "")
      .trim()
      .toUpperCase() || undefined;

    // POK inline card form — create order then show GuestCheckoutForm.
    // Free coupons also go through create-pok-order (server returns { free, paymentId }).
    // Do NOT divert to create-paypal-order here — that races and can show a false create failure.
    if (pubSettings?.pokEnabled) {
      if (pokCreatingRef.current) return;
      pokCreatingRef.current = true;
      const gen = ++pokCreateGenRef.current;
      setStatus("creating");
      setErrorMsg("");
      setPaymentStarted(true);
      // Stale PayPal resume must not race card create and paint "Failed to create payment".
      clearCheckoutPaymentResumeState();
      paypalResumeAttemptedRef.current = true;
      try {
        const resp = await fetch(`${basePath}/api/payments/create-pok-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            vin: nvin,
            couponCode: appliedCouponCode,
          }),
        });
        let data: {
          orderId?: string;
          paymentId?: number | string;
          free?: boolean;
          error?: string;
          code?: string;
          alreadyUnlocked?: boolean;
          lookupId?: number | null;
        };
        const rawText = await resp.text();
        try {
          data = rawText ? JSON.parse(rawText) as typeof data : {};
        } catch {
          if (gen !== pokCreateGenRef.current) return;
          setErrorMsg(t("checkout_error_payment_create"));
          setStatus("error");
          setPaymentStarted(false);
          return;
        }
        if (gen !== pokCreateGenRef.current) return;
        if (resp.status === 409 || data.code === "ALREADY_UNLOCKED") {
          goToVinReport(nvin, data.lookupId ?? undefined, { refreshClientArea: true });
          return;
        }
        const paymentIdRaw = data.paymentId;
        const paymentIdNum =
          typeof paymentIdRaw === "number"
            ? paymentIdRaw
            : typeof paymentIdRaw === "string" && paymentIdRaw.trim() !== ""
              ? Number(paymentIdRaw)
              : NaN;
        // Free coupon: server returns zero-amount payment (no POK charge).
        if (data.free && Number.isFinite(paymentIdNum)) {
          freeCouponPaymentIdRef.current = paymentIdNum;
          setPaymentStarted(false);
          setPokOrderId(null);
          setPokPaymentId(null);
          await submitVinLookup(nvin, undefined, paymentIdNum);
          return;
        }
        if (data.code === "USE_PAYPAL_FREE_PATH" || (resp.status === 400 && /free coupon/i.test(data.error ?? ""))) {
          // Legacy server response — free unlock via PayPal path, then mount buttons.
          setPaymentStarted(false);
          const orderId = await createOrder(nvin);
          if (orderId) {
            markPaypalCheckoutAwaitingApproval(orderId, nvin);
            await mountPaypalButtons(nvin, orderId);
          }
          return;
        }
        if (data.code === "VIN_NO_DATA" || data.code === "VIN_CHECK_UNAVAILABLE") {
          setErrorMsg(translateClientError(t, data.code, data.error));
          setStatus("error");
          setPaymentStarted(false);
          return;
        }
        const orderId = typeof data.orderId === "string" ? data.orderId.trim() : "";
        // Mount card fields whenever POK returned an order id — even if paymentId is missing.
        if (orderId) {
          setPokOrderId(orderId);
          setPokPaymentId(Number.isFinite(paymentIdNum) ? paymentIdNum : null);
          writePokCheckoutSession({ orderId, vin: nvin, kind: "vin_report", phase: "created" });
          setErrorMsg("");
          setStatus("idle");
          return;
        }
        setErrorMsg(translateClientError(t, data.code, data.error) || t("checkout_error_payment_create"));
        setStatus("error");
        setPaymentStarted(false);
        return;
      } catch {
        if (gen !== pokCreateGenRef.current) return;
        setErrorMsg(t("checkout_error_payment_create"));
        setStatus("error");
        setPaymentStarted(false);
      } finally {
        if (gen === pokCreateGenRef.current) pokCreatingRef.current = false;
      }
      return;
    }

    // Free coupon without POK: PayPal zero-amount path.
    if (isFreeCoupon) {
      await createOrder(nvin);
      return;
    }

    if (!hostedFieldsRef.current) { setErrorMsg(t("checkout_error_card_not_ready")); setStatus("error"); return; }
    setPaymentStarted(true);
    hostedFieldsCreateOrderRef.current = async () => {
      const resp = await fetch(`${basePath}/api/payments/create-paypal-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vin: nvin, couponCode: appliedCouponCode }),
      });
      const data = await resp.json() as {
        orderId?: string; free?: boolean; paymentId?: number; error?: string; code?: string; alreadyUnlocked?: boolean;
        lookupId?: number | null;
      };
      if (resp.status === 409 || data.code === "ALREADY_UNLOCKED") {
        goToVinReport(nvin, data.lookupId ?? undefined, { refreshClientArea: true });
        throw new Error("__redirect__");
      }
      if (data.code === "VIN_NO_DATA" || data.code === "VIN_CHECK_UNAVAILABLE") {
        throw new Error(translateClientError(t, data.code, data.error));
      }
      if (!resp.ok || data.error) throw new Error(data.error ?? "Failed to create order");
      if (data.free && data.paymentId) {
        freeCouponPaymentIdRef.current = data.paymentId;
        await submitVinLookup(nvin, undefined, data.paymentId);
        throw new Error("__free__");
      }
      if (!data.orderId) throw new Error("No order ID returned");
      return data.orderId;
    };
    setStatus("creating");
    try {
      const payload = await hostedFieldsRef.current.submit({ contingencies: ["SCA_WHEN_REQUIRED"] });
      setStatus("paying");
      const resp = await fetch(`${basePath}/api/payments/capture-paypal-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId: payload.orderId }),
      });
      const result = await resp.json() as { success?: boolean; error?: string; code?: string; vin?: string; paymentId?: number };
      if (!resp.ok || !result.success) {
        setErrorMsg(translateClientError(t, result.code, result.error));
        setStatus("error");
        return;
      }
      paypalFlowPhaseRef.current = "fulfilling";
      await submitVinLookup(result.vin ?? nvin, payload.orderId, result.paymentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "__free__" || msg === "__redirect__") return;
      if (msg.toLowerCase().includes("declined") || msg.toLowerCase().includes("card") || msg.toLowerCase().includes("field")) {
        setErrorMsg(t("checkout_error_card_declined"));
      } else {
        setErrorMsg(translateClientError(t, undefined, msg));
      }
      setStatus("error");
    }
  };

  const confirmPokAndDeliver = useCallback(async (orderId: string, nvin: string, paymentIdHint?: number | null) => {
    if (pokConfirmingRef.current) return;
    pokConfirmingRef.current = true;
    setPaymentStarted(true);
    setStatus("paying");
    setPayingPhase("payment");
    setErrorMsg("");
    try {
      const outcome = await confirmPokOrderWithRetry(
        () => fetch(`${basePath}/api/payments/confirm-pok-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId }),
        }),
        { shouldContinue: () => checkoutActiveRef.current },
      );
      if (!checkoutActiveRef.current) return;
      if (!outcome.ok) {
        setErrorMsg(translateClientError(t, outcome.data.code, outcome.data.error));
        setStatus("error");
        return;
      }
      clearPokCheckoutSession();
      setPayingPhase("report");
      await submitVinLookupRef.current(
        outcome.data.vin ?? nvin,
        undefined,
        outcome.data.paymentId ?? paymentIdHint ?? pokPaymentId ?? undefined,
      );
    } catch {
      if (!checkoutActiveRef.current) return;
      setErrorMsg(t("checkout_error_capture"));
      setStatus("error");
    } finally {
      pokConfirmingRef.current = false;
    }
  }, [basePath, pokPaymentId, t]);

  const handlePokSuccess = async () => {
    const orderId = pokOrderId;
    const nvin = validateVin() ?? vin.trim().toUpperCase();
    if (!orderId || !nvin) return;
    markPokCheckoutAwaitingConfirm({ orderId, vin: nvin, kind: "vin_report" });
    await confirmPokAndDeliver(orderId, nvin, pokPaymentId);
  };

  // Resume POK confirm after refresh / tab restore (webhook may have completed payment server-side).
  useEffect(() => {
    if (postAuthPrefillLandingRef.current) return;
    if (!isLoaded || !isSignedIn || !vinIsValid || peekLoadingUi) return;
    if (!pubSettings?.pokEnabled || pubSettingsLoading) return;
    if (pokResumeAttemptedRef.current || pokConfirmingRef.current) return;
    if (isFreeCoupon) return;
    if (payMethod === "paypal" && !pokOrderId) return;

    const session = readPokCheckoutSession();
    if (!session || session.kind === "credit_pack") return;
    if (session.phase !== "confirm") return;
    if (session.vin && session.vin !== normalizedVin) return;
    if (peekForVin?.alreadyUnlocked && peekForVin.lookupId) return;

    pokResumeAttemptedRef.current = true;
    setPokOrderId(session.orderId);
    setPayMethod("card");
    void confirmPokAndDeliver(session.orderId, normalizedVin);
  }, [
    isLoaded,
    isSignedIn,
    vinIsValid,
    peekLoadingUi,
    normalizedVin,
    peekForVin?.alreadyUnlocked,
    peekForVin?.lookupId,
    pubSettings?.pokEnabled,
    pubSettingsLoading,
    isFreeCoupon,
    payMethod,
    pokOrderId,
    confirmPokAndDeliver,
  ]);

  const isBusy = status === "creating" || status === "paying";
  const vehicleTitle = peekForVin ? formatVehicleTitle(peekForVin) : null;
  const showDecoderPreview = !!peekForVin && !peekLoadingUi && !!vehicleTitle;
  const showVinQualityWarning =
    vinIsValid
    && !!peekForVin
    && !peekLoadingUi
    && !isTrustworthyVinDecode(peekForVin)
    // Archive confirmed the chassis — don't scare the user when free decode lacks WMI/make.
    && peekForVin.dataAvailable !== true;
  const showVinPendingDoubleCheck = vinIsValid && !!peekForVin && !peekLoadingUi && shouldShowPendingVinDoubleCheck(peekForVin);
  const vehicleTooOld =
    vinIsValid &&
    !!peekForVin &&
    !peekLoadingUi &&
    (peekForVin.vehicleTooOld === true || isVehicleTooOldForLookup(peekForVin.year));
  const paymentAllowed = !vinLookupDisabled && peekForVin?.dataAvailable === true && !peekForVin?.checkUnavailable && !vehicleTooOld;
  const paymentSettingsReady = paymentSettingsHydrated;
  const checkoutDataReady =
    vinIsValid &&
    !peekLoadingUi &&
    !!peekForVin &&
    paymentAllowed &&
    paymentSettingsReady;
  const showCardTab =
    !!pubSettings?.pokEnabled
    || (
      !!pubSettings?.paypalEnableCards
      && !!pubSettings?.paypalClientId
      && cardEligible === "yes"
    );
  const showPaymentMethodTabs =
    checkoutDataReady &&
    showCardTab &&
    !!pubSettings?.paypalClientId &&
    !isFreeCoupon &&
    status !== "success";
  const showProceedButton =
    checkoutDataReady &&
    (status === "idle" || status === "error") &&
    (payMethod === "card" || !paymentStarted) &&
    !(payMethod === "card" && pubSettings?.pokEnabled && !!pokOrderId);
  const showCreditsOption =
    canPayWithCredits && showProceedButton && paymentAllowed && !paymentStarted;
  const vinLocked = paymentStarted && !isFreeCoupon;
  const showVehicleTooOldNotice = vehicleTooOld;
  const showVinNoDataNotice =
    vinIsValid &&
    !!peekForVin &&
    !peekLoadingUi &&
    peekForVin.dataAvailable === false &&
    !peekForVin.checkUnavailable &&
    !peekForVin.manualPending &&
    !showVinQualityWarning &&
    !showVehicleTooOldNotice;
  const showCouponSection = !paymentStarted && status !== "creating" && status !== "paying";
  const showPaymentLogos =
    paymentAllowed &&
    !isFreeCoupon &&
    status !== "success" &&
    (
      // PayPal trust strip only before payment is opened; hide once PayPal buttons are shown
      (payMethod === "paypal" && !!pubSettings?.paypalClientId && !paymentStarted)
      || (payMethod === "card" && !!pubSettings?.pokEnabled)
    );
  const showLockedPreview =
    vinIsValid &&
    !peekLoadingUi &&
    !peekError &&
    !!peekForVin &&
    peekForVin.dataAvailable === true &&
    !peekForVin.checkUnavailable &&
    !showVinQualityWarning;

  const seoLang = parseLangFromPath(window.location.pathname, import.meta.env.BASE_URL.replace(/\/$/, "")) ?? language;

  if (!isLoaded || !isSignedIn) return null;

  return (
    <>
      <SEOHead
        title={`${t("checkout_title")} | verifykm.com`}
        description={t("checkout_subtitle")}
        lang={seoLang}
        noIndex
      />
    <div className="checkout-light relative min-h-[80vh] overflow-hidden bg-[#f4f7fb] px-3 py-5 pb-20 text-slate-950 sm:px-4 sm:py-8 sm:pb-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#00a5fd]" />

      <motion.div
        initial={lightMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: lightMotion ? 0 : 0.32 }}
        className="max-w-5xl xl:max-w-6xl mx-auto"
      >
        <VinLookupDisabledBanner className="mb-4 sm:mb-5" />
        {/* Header */}
        <div className="mb-6 px-1 text-left sm:mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0088d4]">
            {t("checkout_subtitle")}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("checkout_title")}</h1>
        </div>

        {/* Step indicator */}
        {(() => {
          const currentStep =
            status === "success" ? 2 : paymentStarted ? 1 : 0;
          const steps = [
            { labelKey: "checkout_step_vin", icon: Car },
            { labelKey: "checkout_step_pay", icon: CreditCard },
            { labelKey: "checkout_step_done", icon: CheckCircle2 },
          ] as const;
          const isPaying = status === "creating" || status === "paying";

          return (
            <nav
              aria-label={t("checkout_title")}
              className="mb-5 w-full sm:mb-7"
            >
              <ol className="grid grid-cols-3 gap-2">
                {steps.map((step, i) => {
                  const isComplete = i < currentStep;
                  const isCurrent = i === currentStep;
                  const isUpcoming = i > currentStep;
                  const StepIcon = step.icon;
                  const showPaySpinner = i === 1 && isPaying && isCurrent;

                  return (
                    <li
                      key={step.labelKey}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5",
                        isCurrent && "border-[#00a5fd]/40 bg-white text-slate-950 shadow-[0_12px_30px_-22px_rgba(0,136,212,0.7)]",
                        isComplete && "border-[#00a5fd]/25 bg-[#e8f6fe] text-slate-950",
                        isUpcoming && "border-slate-200/70 bg-white/30 text-slate-400 opacity-40",
                      )}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      <span className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        isCurrent
                          ? "bg-[#00a5fd] text-white"
                          : isUpcoming
                            ? "bg-slate-100 text-slate-300"
                            : "bg-[#00a5fd]/10 text-[#0088d4]",
                      )}>
                        {isComplete ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
                        ) : showPaySpinner ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <StepIcon className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className={cn(
                          "block font-mono text-[10px] font-bold tabular-nums",
                          isCurrent ? "text-[#33bbfd]" : isUpcoming ? "text-slate-300" : "text-[#0088d4]",
                        )}>
                          0{i + 1}
                        </span>
                        <span className="block truncate text-xs font-semibold leading-tight">
                          {t(step.labelKey)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </nav>
          );
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_440px] gap-4 sm:gap-5 lg:gap-7 items-start">

          {/* ── LEFT: Vehicle Preview Card ──────────────────────── */}
          <div className={cn(
            CHECKOUT_PANEL,
            "order-2 lg:order-1 isolate [transform:translateZ(0)] mt-1 lg:mt-0",
            showLockedPreview && "border-primary/15 dark:border-primary/20 shadow-[0_6px_28px_rgba(0,165,253,0.06)] dark:shadow-[0_6px_28px_rgba(0,165,253,0.12)]",
          )}>
            {showLockedPreview && (
              <div className="h-0.5 bg-gradient-to-r from-primary via-primary/40 to-transparent" />
            )}

            {/* VIN input row */}
            <div className="border-b border-border/50 px-4 py-4 sm:px-5">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("checkout_vin_label")}</label>
              <div className="relative group" dir="ltr">
                <Input
                  dir="ltr"
                  placeholder={t("vin_placeholder")}
                  value={vin}
                  onChange={(e) => handleVinInputChange(e.target.value)}
                  maxLength={17}
                  readOnly={vinLocked}
                  className={cn(
                    "vin-input-ltr h-12 rounded-xl pl-4 font-mono text-sm tracking-[0.12em] text-left shadow-none placeholder:text-left sm:text-base",
                    vinLocked ? "pr-[7.5rem] bg-muted/50 cursor-default" : "pr-20",
                    !vinLocked && vinIsValid && "border-[#00a5fd]/40 focus-visible:ring-[#00a5fd]/25",
                  )}
                  disabled={isBusy}
                  inputMode="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                />
                <div
                  className={cn(
                    "absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5",
                    vinLocked ? "pointer-events-auto" : "pointer-events-none",
                  )}
                >
                  {vinLocked ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2 sm:px-2.5 text-[10px] sm:text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 shrink-0"
                      onClick={handleUnlockVinForEdit}
                      disabled={isBusy}
                      title={t("checkout_vin_remove_hint")}
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      <span className="hidden sm:inline">{t("checkout_vin_remove")}</span>
                    </Button>
                  ) : (
                    <>
                      <span className={`text-[10px] font-mono tabular-nums ${vinIsValid ? "text-[#0088d4] dark:text-[#00a5fd]" : "text-muted-foreground"}`}>
                        {t("checkout_vin_char_count").replace("{count}", String(normalizedVin.length))}
                      </span>
                      {vinIsValid && (
                        peekLoadingUi
                          ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          : peekForVin
                            ? <CheckCircle2 className="h-4 w-4 text-[#00a5fd]" />
                            : peekError
                              ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                              : null
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-end gap-[3px]" aria-hidden>
                {Array.from({ length: 17 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      i < normalizedVin.length ? "bg-[#00a5fd]" : "bg-[#00a5fd]/20",
                    )}
                  />
                ))}
              </div>
              {vinError && <p className="text-xs text-destructive mt-1.5">{vinError}</p>}
            </div>

            {/* VIN quality warning — bad decode, or valid decode heading to manual pending */}
            <AnimatePresence>
              {(showVinQualityWarning || showVinPendingDoubleCheck) && (
                <motion.div
                  key="vin-warning"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  {showVinQualityWarning ? (
                    <VinDecodeRecheckHint className="border-0 border-b rounded-none px-4 sm:px-5 py-3.5" />
                  ) : (
                    <VinPendingDoubleCheckHint className="border-0 border-b rounded-none px-4 sm:px-5 py-3.5" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Vehicle identity — only when decoder result looks valid */}
            <div className={cn(!showLockedPreview && "border-b")}>
              {!vinIsValid ? (
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f6fe] text-[#0077c8]">
                    <Car className="h-5 w-5" />
                  </span>
                  <p className="max-w-xs text-sm font-medium leading-snug text-muted-foreground">{t("checkout_enter_vin_prompt")}</p>
                </div>
              ) : peekLoadingUi ? (
                <div className="space-y-2.5 px-5 sm:px-6 py-5">
                  <Skeleton className="h-7 w-48 rounded-lg" />
                  <Skeleton className="h-4 w-28 rounded" />
                </div>
              ) : showDecoderPreview && peekForVin ? (
                <motion.div
                  key={peekForVin.vin}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="px-5 sm:px-6 pt-4 pb-3"
                >
                  <h2 className="text-base font-bold leading-tight break-words text-slate-950 sm:text-lg">
                    {vehicleTitle}
                  </h2>
                  <p className="mt-1 break-all font-mono text-[10px] tracking-wide text-slate-600 sm:text-[11px]">
                    {peekForVin.vin}
                  </p>
                </motion.div>
              ) : peekForVin && vinIsValid && !peekLoadingUi ? (
                <div className="flex flex-col items-center text-center gap-2.5 px-5 sm:px-6 py-4 sm:py-3">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 max-w-full">
                    <CheckCircle2 className="h-4 w-4 text-[#0088d4] shrink-0" />
                    <span className="font-mono text-xs sm:text-sm tracking-wider break-all">{peekForVin.vin}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t("checkout_vin_ready_title")}</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">{t("checkout_vin_ready_desc")}</p>
                  </div>
                </div>
              ) : peekError ? (
                <div className="flex items-center gap-3 px-5 sm:px-6 py-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t("checkout_preview_unavailable")}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t("checkout_preview_unavailable_desc")}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Locked data rows — demo-card style */}
            {showLockedPreview && (
            <div className="grid gap-2 border-t border-slate-200 bg-[#f7fafc] p-4 sm:grid-cols-2 sm:p-5">
              {LOCKED_ROWS.map(({ icon: Icon, labelKey, blur, blurKey }, i) => (
                <motion.div
                  key={labelKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.22 }}
                  className={cn(
                    PREVIEW_ROW,
                    labelKey === "mileage_verification" && "flex-col items-stretch gap-2 sm:col-span-2",
                  )}
                >
                  {labelKey === "mileage_verification" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Gauge className={PREVIEW_ICO} />
                          <span className={PREVIEW_LBL}>{t(labelKey)}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(PREVIEW_BLUR, "max-w-[100px] sm:max-w-none truncate")} aria-hidden>
                            {blur}
                          </span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100">
                            <Lock className="h-2.5 w-2.5 text-slate-600" />
                          </div>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full bg-primary/50 blur-[1.5px] w-[58%] select-none"
                          aria-hidden
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={PREVIEW_ICO} />
                        <span className={PREVIEW_LBL}>{t(labelKey)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(PREVIEW_BLUR, "max-w-[100px] sm:max-w-none truncate")} aria-hidden>
                          {blurKey ? t(blurKey) : blur}
                        </span>
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100">
                          <Lock className="h-2.5 w-2.5 text-slate-600" />
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
            )}

            {/* Unlock CTA at bottom of preview */}
            {showLockedPreview && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5 text-xs text-slate-600 sm:text-sm">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e8f6fe]">
                  <Zap className="h-3 w-3 text-[#0077c8]" />
                </div>
                <span className="font-medium leading-snug text-slate-900">{t("checkout_instant_delivery")}</span>
              </div>
              <Badge variant="secondary" className="shrink-0 border-[#b9e6fe] bg-[#e8f6fe] px-2 py-0.5 text-[10px] font-bold text-[#0077c8]">
                {t("checkout_checks_badge").replace("{n}", String(LOCKED_ROWS.length))}
              </Badge>
            </div>
            )}
          </div>

          {/* ── RIGHT: Order Summary + Payment ──────────────────── */}
          <div className="space-y-3.5 sm:space-y-4 order-1 lg:order-2 lg:sticky lg:top-24">

            {/* Unified payment panel */}
            <div className={CHECKOUT_PANEL}>
              <div className="border-b border-slate-200 bg-white px-5 py-4 text-slate-950 sm:px-6">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0088d4]">{t("order_summary")}</p>
                <p className="text-lg font-bold tracking-tight sm:text-xl">{t("checkout_report_title")}</p>

                {/* Mobile — vehicle identity under report line (desktop shows full card below) */}
                <div className="lg:hidden mt-2.5">
                  {vinIsValid && peekLoadingUi ? (
                    <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2.5 space-y-2">
                      <Skeleton className="h-4 w-32 rounded" />
                      <Skeleton className="h-3.5 w-44 rounded" />
                    </div>
                  ) : vinIsValid && peekForVin ? (
                    <div className="rounded-lg border border-slate-200 bg-[#f7fafc] px-3 py-2.5">
                      {vehicleTitle ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-md bg-primary/10 ring-1 ring-primary/10 flex items-center justify-center shrink-0">
                            <Car className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-950">
                            {vehicleTitle}
                          </p>
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "flex items-center gap-2 min-w-0",
                          vehicleTitle && "mt-2 pt-2 border-t border-border/40",
                        )}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                          {t("vin_label")}
                        </span>
                        <span className="truncate font-mono text-[11px] tracking-wide text-slate-700">
                          {peekForVin.vin}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="px-5 sm:px-6 py-4 space-y-3.5">
                {/* Price breakdown */}
                <div className="space-y-2 text-sm">
                  {isDiscount && standardPrice != null && promoDiscountAmount > 0 ? (
                    <>
                      <div className="flex justify-between items-baseline gap-3 text-muted-foreground">
                        <span>{t("checkout_standard_price")}</span>
                        {pricingLoading ? (
                          <Skeleton className="h-4 w-14 rounded" />
                        ) : (
                          <span className="line-through tabular-nums">{fmtPrice(standardPrice)}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-baseline gap-3 text-[#0088d4] dark:text-[#00a5fd] font-medium">
                        <span>{t("pricing_limited_time")}</span>
                        {pricingLoading ? (
                          <Skeleton className="h-4 w-14 rounded" />
                        ) : (
                          <span className="tabular-nums">−{fmtPrice(promoDiscountAmount)}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-baseline gap-3 text-muted-foreground">
                        <span>{t("base_price")}</span>
                        {pricingLoading ? (
                          <Skeleton className="h-4 w-14 rounded" />
                        ) : (
                          <span className="font-medium text-foreground tabular-nums">{fmtPrice(subtotalPrice)}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-baseline gap-3 text-muted-foreground">
                      <span>{t("base_price")}</span>
                      {pricingLoading ? (
                        <Skeleton className="h-4 w-14 rounded" />
                      ) : (
                        <span className="font-medium text-foreground tabular-nums">{fmtPrice(subtotalPrice)}</span>
                      )}
                    </div>
                  )}
                  {couponDiscountAmount > 0 && (
                    <div className="flex justify-between items-baseline gap-3 text-[#0088d4] dark:text-[#00a5fd] font-medium">
                      <span>
                        {t("discount")}
                        {couponResult?.type === "percent" ? ` (${couponResult.value}%)` : ""}
                      </span>
                      <span className="tabular-nums">−{fmtPrice(couponDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-3 rounded-2xl border border-[#cfe6f6] bg-[#f3f9fd] px-4 py-3 text-slate-950">
                    <span className="text-base font-bold">{t("total")}</span>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {!pricingLoading && isDiscount && promoSavePercent > 0 && finalPrice > 0 && (
                        <Badge className="bg-orange-500 text-white border-0 text-[10px] px-2 py-0.5 font-bold">
                          {t("pricing_save").replace("{n}", String(promoSavePercent))}
                        </Badge>
                      )}
                      <span className="text-2xl font-black tabular-nums tracking-tight text-slate-950 sm:text-3xl">
                        {pricingLoading ? (
                          <Skeleton className="h-8 w-24 rounded inline-block" />
                        ) : couponResult && finalPrice === 0 ? (
                          <span className="text-[#0088d4] dark:text-[#00a5fd]">{t("free")}</span>
                        ) : (
                          <PriceAmount
                            amount={finalPrice}
                            currencySymbol={currencySymbol}
                            centsClassName="text-[0.62em] text-slate-500"
                          />
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coupon — hidden once user proceeds to payment */}
                {showCouponSection && (
                <div className="border-t border-border/40 pt-2">
                  {!couponResult && (
                    <button
                      type="button"
                      onClick={() => setCouponOpen(o => !o)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors w-full py-0.5"
                    >
                      <Tag className="h-3 w-3" />
                      <span>{t("coupon_code")}</span>
                      <ChevronDown className={`h-3 w-3 ml-auto transition-transform duration-200 ${couponOpen ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  <AnimatePresence mode="wait">
                    {couponResult ? (
                      <motion.div
                        key="applied"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="flex items-center justify-between rounded-xl border border-[#b9e6fe] bg-[#f3f9fd] p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[#0088d4] shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-[#0369a1] dark:text-[#33bbfd]">{couponResult.code}</p>
                            <p className="text-[10px] text-[#0088d4]/80 dark:text-[#00a5fd]">
                              {couponResult.type === "percent" ? `${couponResult.value}% off` : `${fmtPrice(couponResult.value)} off`}
                              {" "}· {fmtPrice(couponResult.discountAmount)}
                            </p>
                          </div>
                        </div>
                        <button onClick={handleRemoveCoupon} disabled={isBusy} className="text-muted-foreground hover:text-foreground p-0.5">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ) : couponOpen ? (
                      <motion.div key="input" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                        <div className="flex gap-1.5">
                          <Input
                            placeholder={t("coupon_placeholder")}
                            value={couponCode}
                            onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                            className="h-9 font-mono text-xs uppercase"
                            disabled={isBusy || couponLoading}
                            onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0 px-3 text-xs"
                            onClick={handleApplyCoupon}
                            disabled={isBusy || couponLoading || !couponCode.trim()}
                          >
                            {couponLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : t("apply")}
                          </Button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  {couponError && <p className="text-xs text-destructive mt-2">{couponError}</p>}
                </div>
                )}

                {/* Payment section */}
                <div className="border-t border-border/40 pt-2.5 space-y-2">
                  {showVehicleTooOldNotice && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t("checkout_vehicle_too_old_title")}</p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-0.5">{t("checkout_vehicle_too_old_desc")}</p>
                      </div>
                    </div>
                  )}

                  {showVinNoDataNotice && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t("vin_not_in_db")}</p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-0.5">
                          {peekForVin?.vinNoAccess ? t("checkout_vin_no_access_desc") : t("checkout_no_data_desc")}
                        </p>
                      </div>
                    </div>
                  )}

                  {vinIsValid && peekForVin?.checkUnavailable && !peekForVin.manualPending && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{t("checkout_check_unavailable_title")}</p>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-0.5">
                          {peekForVin.checkUnavailableCode
                            ? translateClientError(t, peekForVin.checkUnavailableCode)
                            : t("checkout_check_unavailable_desc")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Credits first when available (hidden once PayPal/Card payment is opened) */}
                  {showCreditsOption && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => void handlePayWithCredits()}
                        disabled={isBusy}
                        className={cn(
                          "w-full rounded-xl border border-primary/20 bg-primary/[0.05]",
                          "px-3 py-2.5 text-left transition-colors",
                          "hover:bg-primary/[0.09] hover:border-primary/35",
                          "disabled:opacity-60 disabled:pointer-events-none",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                            {isBusy
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Coins className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-foreground leading-tight">
                              {isBusy ? `${t("processing")}…` : t("checkout_pay_with_credits")}
                            </span>
                            <span className="block mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                              {t("checkout_credits_left").replace("{n}", String(creditBalance))}
                            </span>
                          </span>
                        </span>
                      </button>
                      <div className="relative flex items-center gap-3 py-0.5" aria-hidden>
                        <div className="h-px flex-1 bg-border/60" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                          {t("or")}
                        </span>
                        <div className="h-px flex-1 bg-border/60" />
                      </div>
                    </div>
                  )}

                  {/* Payment method tabs — stay visible after PayPal/Card is opened */}
                  {showPaymentMethodTabs && (
                    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 text-sm font-semibold text-slate-700">
                      <button
                        type="button"
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 transition-colors",
                          payMethod === "paypal"
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-950",
                        )}
                        onClick={() => {
                          if (payMethod === "paypal") return;
                          // Switching from card → PayPal chooser from start
                          paypalInstanceRef.current?.close();
                          paypalInstanceRef.current = null;
                          pendingPaypalOrderRef.current = null;
                          paypalFlowPhaseRef.current = "idle";
                          clearCheckoutPaymentResumeState();
                          setPaymentStarted(false);
                          setPokOrderId(null);
                          setPokPaymentId(null);
                          if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
                          setPayMethod("paypal");
                          setStatus("idle");
                          setErrorMsg("");
                        }}
                      >
                        {t("checkout_pay_method_paypal")}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 transition-colors",
                          payMethod === "card"
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-500 hover:text-slate-950",
                        )}
                        onClick={() => {
                          if (payMethod === "card") return;
                          // Switching from PayPal → Card chooser from start
                          paypalInstanceRef.current?.close();
                          paypalInstanceRef.current = null;
                          pendingPaypalOrderRef.current = null;
                          paypalFlowPhaseRef.current = "idle";
                          clearCheckoutPaymentResumeState();
                          setPaymentStarted(false);
                          setPokOrderId(null);
                          setPokPaymentId(null);
                          if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
                          setPayMethod("card");
                          setStatus("idle");
                          setErrorMsg("");
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        {t("checkout_pay_method_card")}
                      </button>
                    </div>
                  )}

                  {/* PayPal button container — color-scheme:none stops forced white iframe chrome in dark mode */}
                  {paymentAllowed && !isFreeCoupon && (
                    <div ref={paypalContainerRef} className={cn("[color-scheme:none] min-h-0", payMethod === "card" && "hidden")} />
                  )}

                  {/* Hosted card fields (PayPal) or POK GuestCheckoutForm.
                      Keep POK form mounted once we have an orderId even if peek flickers —
                      unmounting right after a successful create looks like payment failure. */}
                  {payMethod === "card" && !isFreeCoupon && (paymentAllowed || !!pokOrderId) && (
                    <div className="space-y-3 [color-scheme:none]">
                      {pubSettings?.pokEnabled ? (
                        pokOrderId ? (
                          <PokGuestCheckout
                            orderId={pokOrderId}
                            pokEnv={pubSettings.pokEnv === "staging" ? "staging" : "production"}
                            onSuccess={() => { void handlePokSuccess(); }}
                            onError={(message) => {
                              // Keep orderId mounted so card fields stay visible for retry.
                              setErrorMsg(message);
                              setStatus("error");
                            }}
                          />
                        ) : status === "creating" ? (
                          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {t("checkout_card_loading")}
                          </div>
                        ) : null
                      ) : pubSettings?.paypalEnableCards ? (
                        cardEligible === "no" ? (
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 text-center">
                            {t("checkout_card_not_available")}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-muted-foreground">{t("checkout_card_number")}</p>
                              <div
                                id="hf-card-number"
                                className="h-11 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#00a5fd] focus-within:ring-2 focus-within:ring-[#00a5fd]/20"
                              />
                              {cardErrors.number && <p className="text-xs text-destructive">{cardErrors.number}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground">{t("checkout_card_expiry")}</p>
                                <div
                                  id="hf-expiry"
                                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#00a5fd] focus-within:ring-2 focus-within:ring-[#00a5fd]/20"
                                />
                                {cardErrors.expirationDate && <p className="text-xs text-destructive">{cardErrors.expirationDate}</p>}
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-muted-foreground">{t("checkout_card_cvv")}</p>
                                <div
                                  id="hf-cvv"
                                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#00a5fd] focus-within:ring-2 focus-within:ring-[#00a5fd]/20"
                                />
                                {cardErrors.cvv && <p className="text-xs text-destructive">{cardErrors.cvv}</p>}
                              </div>
                            </div>
                            {!hostedFieldsReady && (
                              <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t("checkout_card_loading")}
                              </div>
                            )}
                          </>
                        )
                      ) : null}
                    </div>
                  )}

                  {/* Error */}
                  <AnimatePresence>
                    {status === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium"
                      >
                        {errorMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Processing state */}
                  {status === "paying" && (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isFreeCoupon || payingPhase === "report"
                        ? t("processing_retrieving_data")
                        : t("processing_payment")}
                    </div>
                  )}

                  {/* Proceed / Pay by Card / Free button */}
                  {showProceedButton && (
                    <Button
                      className="mt-1.5 h-12 w-full gap-2 rounded-2xl text-[15px] font-bold"
                      onClick={(!isFreeCoupon && payMethod === "card") ? handleCardPayment : handleProceedToPayment}
                      disabled={isBusy || (!isFreeCoupon && payMethod === "card" && !pubSettings?.pokEnabled && (!hostedFieldsReady || cardEligible === "no"))}
                    >
                      {isBusy
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("processing")}…</>
                        : isFreeCoupon
                          ? <><Zap className="h-4 w-4" />{t("get_free_report")}</>
                          : payMethod === "card"
                            ? <><CreditCard className="h-4 w-4" />{t("checkout_pay_by_card")}</>
                            : <><Lock className="h-4 w-4" />{t("checkout_pay_with_paypal")}</>
                      }
                    </Button>
                  )}

                  {/* PayPal configured — no footer note. Hide until API settings hydrate (OAuth seed has no client id). */}
                  {!paymentSettingsHydrated || pubSettings?.paypalClientId || pubSettingsError
                    ? null
                    : <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 text-center">
                        {t("checkout_payment_not_configured")}
                      </div>
                  }
                </div>
              </div>
            </div>

            {showPaymentLogos && (
              <div className={cn(
                CHECKOUT_PANEL,
                "px-4 border-border/50 shadow-none",
                payMethod === "paypal" ? "pt-2.5 pb-1" : "py-2.5",
              )}>
                <CheckoutPaymentLogos provider={payMethod === "card" ? "pok" : "paypal"} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
}
