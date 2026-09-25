import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { getCreditPack, isCreditPackId, readRememberedCreditPack } from "@/lib/creditPacks";
import { DEFAULT_PRICING } from "@/lib/pricing-defaults";
import { useDisplayPrice } from "@/hooks/use-display-price";
import {
  AUTH_RETURN_PATH_KEY,
  clearPaypalCreditPackSession,
  markPaypalCreditPackAwaitingApproval,
  markPaypalCreditPackCapturePending,
  readPaypalCreditPackSession,
  shouldResumePaypalCreditPackCapture,
} from "@/lib/checkout-vin-flow";
import { CHECKOUT_QUERY_OPTIONS, spreadQueryExtras } from "@/lib/query-options";
import { isPublicPaymentSettingsHydrated } from "@/lib/public-settings";
import { useQueryRecovery } from "@/hooks/use-query-recovery";
import { translateClientError } from "@/lib/translate-client-error";
import {
  clearPokCheckoutSession,
  confirmPokOrderWithRetry,
  markPokCheckoutAwaitingConfirm,
  readPokCheckoutSession,
  writePokCheckoutSession,
} from "@/lib/pok-checkout-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEOHead } from "@/components/seo";
import { CheckoutPaymentLogos, usePreloadCheckoutPaymentLogos } from "@/components/checkout-payment-logos";
import { PokGuestCheckout } from "@/components/pok-guest-checkout";
import {
  ArrowLeft, CheckCircle2, CreditCard, FileText, Loader2, Lock,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { pathFor } from "@/lib/localized-routes";

type PublicSettings = {
  paypalClientId: string | null;
  pokEnabled?: boolean;
  pokEnv?: "staging" | "production";
};

type Props = { params: { lang: string } };

const PACK_FEATURES = [
  "full_vehicle_history",
  "pricing_feature_accidents",
  "mileage_verification",
  "credits_checkout_theft",
  "photos_available",
  "auction_history",
] as const;

export default function CreditsCheckout({ params }: Props) {
  const { t, language } = useTranslation();
  const { isSignedIn, isLoaded, refreshUser } = useAuth();
  const { displayPrice: rawDisplayPrice, currencySymbol } = useDisplayPrice();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { resolvedTheme } = useTheme();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const singleUnit = rawDisplayPrice && rawDisplayPrice > 0
    ? rawDisplayPrice
    : DEFAULT_PRICING.discountPrice;

  const packId = useMemo(() => {
    const fromBar = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const fromRouter = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const raw = fromBar.get("pack") || fromRouter.get("pack") || readRememberedCreditPack();
    return isCreditPackId(raw) ? raw : null;
  }, [search]);

  const pack = packId ? getCreditPack(packId) : null;

  const {
    data: pubSettings,
    isLoading: pubSettingsLoading,
    isError: pubSettingsError,
    isFetching: pubSettingsFetching,
    dataUpdatedAt: pubSettingsUpdatedAt,
    refetch: refetchPubSettings,
  } = useQuery<PublicSettings>({
    queryKey: ["/api/payments/public-settings"],
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/payments/public-settings`);
      if (!r.ok) throw new Error("settings");
      return r.json() as Promise<PublicSettings>;
    },
    ...spreadQueryExtras<PublicSettings>(CHECKOUT_QUERY_OPTIONS),
  });
  useQueryRecovery(pubSettingsError, pubSettingsFetching, refetchPubSettings);
  usePreloadCheckoutPaymentLogos(true);
  const paymentSettingsHydrated = isPublicPaymentSettingsHydrated(pubSettings, {
    isLoading: pubSettingsLoading,
    dataUpdatedAt: pubSettingsUpdatedAt,
  });
  const paypalReady = !!pubSettings?.paypalClientId;
  const pokEnabled = !!pubSettings?.pokEnabled;
  const anyPaymentReady = paypalReady || pokEnabled;
  const [payMethod, setPayMethod] = useState<"paypal" | "card">("paypal");
  const [status, setStatus] = useState<"idle" | "creating" | "paying" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [pokOrderId, setPokOrderId] = useState<string | null>(null);
  const pokConfirmingRef = useRef(false);
  const pokResumeAttemptedRef = useRef(false);
  const paypalReturnHandledRef = useRef(false);
  const paypalResumeAttemptedRef = useRef(false);

  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const paypalInstanceRef = useRef<{ close: () => void } | null>(null);
  const pendingOrderRef = useRef<string | null>(null);
  const activeRef = useRef(true);
  const finalizeRef = useRef<(orderId: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (pokEnabled && !paypalReady) setPayMethod("card");
  }, [pokEnabled, paypalReady]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      paypalInstanceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      if (packId) {
        sessionStorage.setItem(AUTH_RETURN_PATH_KEY, pathFor(language, "credits_checkout", { query: `pack=${packId}` }));
      }
      setLocation(pathFor(language, "sign_up"));
    }
  }, [isLoaded, isSignedIn, language, packId, setLocation]);

  useEffect(() => {
    if (!pubSettings?.paypalClientId) return;
    // Reuse the normal checkout SDK when already loaded (same client id / EUR).
    if (window.paypal || document.getElementById("paypal-sdk") || document.getElementById("paypal-sdk-credits")) {
      return;
    }
    const script = document.createElement("script");
    script.id = "paypal-sdk-credits";
    script.src = `https://www.paypal.com/sdk/js?client-id=${pubSettings.paypalClientId}&currency=EUR&intent=capture&components=buttons`;
    script.async = true;
    document.body.appendChild(script);
  }, [pubSettings?.paypalClientId]);

  const finalizeCapture = useCallback(async (orderId: string) => {
    setStatus("paying");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/payments/capture-credit-pack-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId }),
      });
      const data = await resp.json() as {
        success?: boolean;
        error?: string;
        code?: string;
        creditBalance?: number;
      };
      if (!resp.ok || !data.success) {
        setErrorMsg(translateClientError(t, data.code, data.error) || t("checkout_error_capture"));
        setStatus("error");
        return;
      }
      clearPaypalCreditPackSession();
      setStatus("success");
      await refreshUser();
    } catch {
      setErrorMsg(t("checkout_error_capture"));
      setStatus("error");
    }
  }, [basePath, refreshUser, t]);

  const finalizePokCapture = useCallback(async (orderId: string) => {
    if (pokConfirmingRef.current) return;
    pokConfirmingRef.current = true;
    setStatus("paying");
    setErrorMsg("");
    try {
      const outcome = await confirmPokOrderWithRetry(
        () => fetch(`${basePath}/api/payments/confirm-pok-credit-pack-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ orderId }),
        }),
        { shouldContinue: () => activeRef.current },
      );
      if (!activeRef.current) return;
      if (!outcome.ok) {
        setErrorMsg(translateClientError(t, outcome.data.code, outcome.data.error) || t("checkout_error_capture"));
        setStatus("error");
        return;
      }
      clearPokCheckoutSession();
      setStatus("success");
      await refreshUser();
    } catch {
      setErrorMsg(t("checkout_error_capture"));
      setStatus("error");
    } finally {
      pokConfirmingRef.current = false;
    }
  }, [basePath, refreshUser, t]);

  useLayoutEffect(() => {
    finalizeRef.current = finalizeCapture;
  }, [finalizeCapture]);

  // PayPal full-page return (?token=ORDER_ID) after mobile/redirect checkout.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !packId) return;
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

    markPaypalCreditPackCapturePending(token, packId);
    setPaymentStarted(true);
    void finalizeCapture(token);
  }, [isLoaded, isSignedIn, packId, finalizeCapture]);

  // Resume capture after refresh if user approved PayPal but capture did not finish.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !packId || payMethod !== "paypal") return;
    if (paypalResumeAttemptedRef.current || paypalReturnHandledRef.current) return;
    const session = readPaypalCreditPackSession();
    if (!session || session.packId !== packId || !shouldResumePaypalCreditPackCapture(session)) return;

    paypalResumeAttemptedRef.current = true;
    setPaymentStarted(true);
    void finalizeCapture(session.orderId);
  }, [isLoaded, isSignedIn, packId, payMethod, finalizeCapture]);

  const mountPaypal = useCallback(async (orderId: string) => {
    // Settings can still be loading after create-order succeeds (server uses env secrets).
    let clientId = pubSettings?.paypalClientId ?? null;
    if (!clientId) {
      try {
        const r = await refetchPubSettings();
        clientId = r.data?.paypalClientId ?? null;
      } catch {
        clientId = null;
      }
    }
    if (!clientId) {
      setErrorMsg(t("checkout_payment_not_configured"));
      setStatus("error");
      return;
    }
    if (!document.getElementById("paypal-sdk") && !document.getElementById("paypal-sdk-credits") && !window.paypal) {
      const script = document.createElement("script");
      script.id = "paypal-sdk-credits";
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&intent=capture&components=buttons`;
      script.async = true;
      document.body.appendChild(script);
    }
    let attempts = 0;
    while (!window.paypal && attempts < 40) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    if (!window.paypal || !paypalContainerRef.current) {
      setErrorMsg(t("checkout_error_paypal_load"));
      setStatus("error");
      return;
    }

    paypalInstanceRef.current?.close();
    pendingOrderRef.current = orderId;
    setPaymentStarted(true);
    setStatus("idle");
    if (packId) {
      markPaypalCreditPackAwaitingApproval(orderId, packId);
    }

    const buttons = window.paypal!.Buttons({
      style: {
        layout: "vertical",
        color: resolvedTheme === "dark" ? "white" : "blue",
        shape: "rect",
        label: "pay",
        height: 48,
      },
      createOrder: () => {
        const id = pendingOrderRef.current;
        if (!id) throw new Error("Order not ready");
        return id;
      },
      onApprove: async (data: { orderID: string }) => {
        pendingOrderRef.current = null;
        if (packId) {
          markPaypalCreditPackCapturePending(data.orderID, packId);
        }
        await finalizeRef.current(data.orderID);
      },
      onError: () => {
        if (!activeRef.current) return;
        setErrorMsg(t("checkout_error_payment_failed"));
        setStatus("error");
      },
      onCancel: () => {
        setPaymentStarted(false);
        setStatus("idle");
        paypalInstanceRef.current?.close();
        if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
      },
    });
    paypalInstanceRef.current = buttons;
    paypalContainerRef.current.innerHTML = "";
    await buttons.render(paypalContainerRef.current);
  }, [pubSettings?.paypalClientId, refetchPubSettings, resolvedTheme, t, packId]);

  useEffect(() => {
    if (!pokEnabled || pokResumeAttemptedRef.current || pokConfirmingRef.current) return;
    const session = readPokCheckoutSession();
    if (!session || session.kind !== "credit_pack") return;
    if (session.phase !== "confirm") return;
    if (pokOrderId) return;

    pokResumeAttemptedRef.current = true;
    setPokOrderId(session.orderId);
    setPayMethod("card");
    setPaymentStarted(true);
    void finalizePokCapture(session.orderId);
  }, [pokEnabled, pokOrderId, finalizePokCapture]);

  const handleStartPayment = async () => {
    if (!pack) return;
    if (!paymentSettingsHydrated) return;

    if (payMethod === "card" && pokEnabled) {
      setStatus("creating");
      setErrorMsg("");
      setPaymentStarted(true);
      try {
        const resp = await fetch(`${basePath}/api/payments/create-pok-credit-pack-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ packId: pack.id }),
        });
        const data = await resp.json() as { orderId?: string; error?: string; code?: string };
        if (!resp.ok || !data.orderId) {
          setErrorMsg(translateClientError(t, data.code, data.error) || t("checkout_error_payment_create"));
          setStatus("error");
          setPaymentStarted(false);
          return;
        }
        setPokOrderId(data.orderId);
        writePokCheckoutSession({ orderId: data.orderId, kind: "credit_pack", phase: "created" });
        setStatus("idle");
      } catch {
        setErrorMsg(t("checkout_error_payment_create"));
        setStatus("error");
        setPaymentStarted(false);
      }
      return;
    }

    if (!paypalReady) {
      if (!paymentSettingsHydrated) return;
      setErrorMsg(t("checkout_payment_not_configured"));
      setStatus("error");
      return;
    }
    setStatus("creating");
    setErrorMsg("");
    try {
      const resp = await fetch(`${basePath}/api/payments/create-credit-pack-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await resp.json() as { orderId?: string; error?: string; code?: string };
      if (!resp.ok || !data.orderId) {
        setErrorMsg(translateClientError(t, data.code, data.error) || t("checkout_error_payment_create"));
        setStatus("error");
        return;
      }
      await mountPaypal(data.orderId);
    } catch {
      setErrorMsg(t("checkout_error_payment_create"));
      setStatus("error");
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="font-semibold">{t("credits_checkout_invalid_pack")}</p>
        <Button onClick={() => setLocation(pathFor(language, "pricing"))}>{t("pricing")}</Button>
      </div>
    );
  }

  const separateTotal = singleUnit * pack.credits;
  const discountAmount = Math.max(0, separateTotal - pack.totalPrice);
  const showComparePrice = discountAmount > 0.01;
  const unitLabel = `${currencySymbol}${pack.unitPrice.toFixed(2)}`;
  const [unitWhole, unitFraction] = pack.unitPrice.toFixed(2).split(".");

  return (
    <div className="relative bg-background overflow-hidden">
      <SEOHead
        title={t("credits_checkout_title")}
        description={t("credits_checkout_desc")}
        lang={language}
        canonicalPath={pathFor(language, "credits_checkout")}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-50/70 via-background to-background dark:from-[#040814] dark:via-background" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#00a5fd_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.05] dark:opacity-[0.12]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(0,165,253,0.14),transparent)]" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-16 sm:pb-20">
        <button
          type="button"
          onClick={() => setLocation(pathFor(language, "pricing"))}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("credits_checkout_back_pricing")}
        </button>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* Pack summary — second on mobile, left on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="order-2 lg:order-1 relative rounded-lg border border-[#00a5fd]/25 border-l-[3px] border-l-[#00a5fd] bg-[#f8fafc] dark:bg-[#060a14] overflow-hidden"
          >
            <div className="relative border-b border-[#00a5fd]/25 bg-[#030712] px-5 py-5 text-left sm:px-7">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_-30%,rgba(255,255,255,0.18),transparent)] pointer-events-none" />
              {pack.id === "pack3" && (
                <Badge className="absolute top-4 right-4 rounded-sm bg-orange-500 text-white border-0 text-[10px] font-bold">
                  {t("pricing_best_value")}
                </Badge>
              )}
              <div className="relative space-y-3">
                <h1 className="text-xl sm:text-xl lg:text-2xl font-black text-white tracking-tight">
                  {t(`pricing_plan_${pack.id}_title`)}
                </h1>
                {/* Unit price shown on desktop only — order summary covers pricing on mobile */}
                <div className="hidden lg:flex flex-col items-start gap-1">
                  <div className="inline-flex items-end justify-start gap-2 tabular-nums leading-none text-white">
                    {singleUnit > pack.unitPrice && (
                      <span className="text-base sm:text-lg font-medium text-white/40 line-through pb-1">
                        {currencySymbol}{singleUnit.toFixed(2)}
                      </span>
                    )}
                    <div className="inline-flex items-end leading-none">
                      <span className="text-lg sm:text-xl font-semibold text-white/90 pb-1 pe-0.5">
                        {currencySymbol}
                      </span>
                      <span className="text-[2.75rem] sm:text-[3.1rem] font-black tracking-tighter">
                        {unitWhole}
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-white/80 pb-1 ps-1">
                        .{unitFraction}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-white/70">{t("per_report")}</p>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-7 py-4 lg:py-6 space-y-4 lg:space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 lg:mb-3">
                  {t("credits_checkout_what_you_get")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 lg:gap-y-2.5">
                  {PACK_FEATURES.map((key) => (
                    <div key={key} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm font-medium leading-snug">{t(key)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3.5 py-3 lg:px-4 lg:py-3.5">
                <div className="flex items-start gap-2.5">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">{t("pricing_credits_never_expire")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {t("credits_checkout_desc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Order / payment — first on mobile, right on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="order-1 lg:order-2 space-y-4 lg:sticky lg:top-24"
          >
            <div className="rounded-lg border border-[#00a5fd]/20 border-l-[3px] border-l-[#00a5fd] bg-background overflow-hidden">
              <div className="px-5 sm:px-6 py-3.5 border-b border-[#00a5fd]/15 bg-[#00a5fd]/[0.05]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  {t("order_summary")}
                </p>
                <p className="font-bold text-base">
                  {t("credits_checkout_pack_title").replace("{n}", String(pack.credits))}
                </p>
              </div>

              <div className="px-5 sm:px-6 py-4 space-y-4">
                <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
                  <div className="px-4 py-3 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-muted-foreground">{t("credits_checkout_credits")}</span>
                      <span className="font-semibold text-foreground tabular-nums">{pack.credits}</span>
                    </div>
                    {showComparePrice && (
                      <>
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-muted-foreground">{t("checkout_standard_price")}</span>
                          <span className="font-medium text-muted-foreground line-through tabular-nums">
                            {currencySymbol}{separateTotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-3">
                          <span className="text-muted-foreground">{t("discount")}</span>
                          <span className="font-semibold text-orange-700 dark:text-orange-300 tabular-nums">
                            −{currencySymbol}{discountAmount.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="px-4 py-3.5 border-t border-border/50 bg-primary/[0.06] flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-base">{t("credits_checkout_offer_price")}</p>
                      {showComparePrice && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {unitLabel} {t("per_report").toLowerCase()}
                        </p>
                      )}
                    </div>
                    <span className="text-2xl font-black text-primary tabular-nums shrink-0">
                      {currencySymbol}{pack.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {status === "success" ? (
                  <div className="space-y-4 text-center py-2">
                    <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/10">
                      <CheckCircle2 className="h-7 w-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-lg">{t("credits_checkout_success")}</p>
                    </div>
                    <Button className="w-full h-12 font-bold rounded-xl" onClick={() => setLocation(pathFor(language, "dashboard"))}>
                      {t("go_to_dashboard")}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-xl"
                      onClick={() => setLocation(pathFor(language, "checkout"))}
                    >
                      {t("check_vin_short")}
                    </Button>
                  </div>
                ) : (
                  <>
                    {status === "error" && errorMsg && (
                      <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium">
                        {errorMsg}
                      </div>
                    )}

                    {pokEnabled && paypalReady && (
                      <div className="flex rounded-xl border border-border/80 overflow-hidden text-sm font-semibold bg-muted/30 p-1 gap-1 mb-1">
                        <button
                          type="button"
                          className={cn(
                            "flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200",
                            payMethod === "paypal"
                              ? paymentStarted
                                ? "bg-primary/75 text-primary-foreground shadow-sm shadow-primary/15 border border-primary/40"
                                : "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => {
                            if (payMethod === "paypal") return;
                            paypalInstanceRef.current?.close();
                            if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
                            setPaymentStarted(false);
                            setPokOrderId(null);
                            setPayMethod("paypal");
                            setErrorMsg("");
                            setStatus("idle");
                          }}
                        >
                          {t("checkout_pay_method_paypal")}
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex-1 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200",
                            payMethod === "card"
                              ? paymentStarted
                                ? "bg-primary/75 text-primary-foreground shadow-sm shadow-primary/15 border border-primary/40"
                                : "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => {
                            if (payMethod === "card") return;
                            paypalInstanceRef.current?.close();
                            if (paypalContainerRef.current) paypalContainerRef.current.innerHTML = "";
                            setPaymentStarted(false);
                            setPokOrderId(null);
                            setPayMethod("card");
                            setErrorMsg("");
                            setStatus("idle");
                          }}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          {t("checkout_pay_method_card")}
                        </button>
                      </div>
                    )}

                    <div
                      ref={paypalContainerRef}
                      className={cn(
                        "[color-scheme:none] min-h-0",
                        (!paymentStarted || payMethod === "card") && "hidden",
                      )}
                    />

                    {payMethod === "card" && pokOrderId && (
                      <PokGuestCheckout
                        orderId={pokOrderId}
                        pokEnv={pubSettings?.pokEnv === "staging" ? "staging" : "production"}
                        onSuccess={() => {
                          if (pokOrderId) {
                            markPokCheckoutAwaitingConfirm({ orderId: pokOrderId, kind: "credit_pack" });
                          }
                          void finalizePokCapture(pokOrderId);
                        }}
                        onError={(message) => {
                          setErrorMsg(message);
                          setStatus("error");
                        }}
                      />
                    )}

                    {!paymentStarted && (
                      <Button
                        className="w-full h-12 sm:h-[52px] text-base font-bold rounded-xl gap-2 shadow-md shadow-primary/15"
                        onClick={() => void handleStartPayment()}
                        disabled={
                          status === "creating"
                          || status === "paying"
                          || !paymentSettingsHydrated
                          || (!anyPaymentReady && !pubSettingsError)
                        }
                      >
                        {status === "creating" || status === "paying" || !paymentSettingsHydrated ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />{t("processing")}…</>
                        ) : payMethod === "card" && pokEnabled ? (
                          <><CreditCard className="h-4 w-4" />{t("checkout_pay_by_card")}</>
                        ) : (
                          <><Lock className="h-4 w-4" />{t("checkout_pay_with_paypal")}</>
                        )}
                      </Button>
                    )}

                    {paymentSettingsHydrated && !anyPaymentReady && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 text-center">
                        {t("checkout_payment_not_configured")}
                      </div>
                    )}

                    {status === "paying" && (
                      <div className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("processing_payment")}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {status !== "success"
              && (
                (payMethod === "card" && pokEnabled)
                || (payMethod === "paypal" && paypalReady && !paymentStarted)
              )
              && (
              <div className={cn(
                "rounded-lg border border-[#00a5fd]/15 bg-[#f8fafc] px-4 dark:bg-[#060a14]",
                payMethod === "paypal" ? "pt-3 pb-1.5" : "py-3",
              )}>
                <CheckoutPaymentLogos
                  provider={payMethod === "card" && pokEnabled ? "pok" : "paypal"}
                />
              </div>
            )}
          </motion.div>
        </div>

        <p className="mt-8 sm:mt-10 max-w-xl mx-auto text-center text-xs sm:text-sm text-muted-foreground/70 leading-relaxed">
          {t("credits_checkout_credit_notice").replace("{n}", String(pack.credits))}
        </p>
      </div>
    </div>
  );
}
