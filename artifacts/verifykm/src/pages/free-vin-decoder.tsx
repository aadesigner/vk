import { useState, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { decodeVinLocalFree, isNorthAmericanMarketVin } from "@workspace/vin-decode";
import { useTranslation } from "@/i18n/context";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { useRecaptcha, resolveRecaptchaToken, executeRecaptchaToken } from "@/hooks/use-recaptcha";
import { useAuth } from "@/lib/auth-context";
import { buildUnlockCheckoutTarget } from "@/lib/checkout-vin-flow";
import { getCachedFreeDecode, setCachedFreeDecode } from "@/lib/free-decode-cache";
import { getVinValidationErrorKey } from "@/lib/vin-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEOHead, usePageSeo } from "@/components/seo";
import {
  Search, CheckCircle2, Lock, Zap, ShieldCheck,
  AlertTriangle, Car, Globe, Factory, Gauge,
  ChevronRight, Info, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { translateClientError } from "@/lib/translate-client-error";
import { formatVinOriginCountry, countryLabelsFromT } from "@/lib/format-country-name";
import { STATIC_QUERY_OPTIONS, spreadQueryExtras } from "@/lib/query-options";
import { isTrustworthyVinDecode } from "@/lib/vin-decode-preview";
import { VinDecodeRecheckHint } from "@/components/vin-decode-recheck-hint";
import { FreeDecoderSeoSection } from "@/components/free-decoder-seo-section";
import { FREE_DECODER_BRAND_CARDS } from "@/lib/free-decoder-brands";
import { pathFor } from "@/lib/localized-routes";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DecodeResult {
  vin: string;
  year: number | null;
  modelYearRange?: string | null;
  make: string | null;
  model: string | null;
  series?: string | null;
  trim: string | null;
  manufacturer: string | null;
  vehicleType: string | null;
  bodyStyle: string | null;
  doors?: string | null;
  engineCylinders: string | null;
  engineDisplacementL: string | null;
  engineHp?: string | null;
  engineDecoded: string | null;
  engineCode: string | null;
  fuelType: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  turbo?: string | null;
  electrificationLevel?: string | null;
  gvwr?: string | null;
  abs?: string | null;
  esc?: string | null;
  airbagLocations?: string | null;
  plantCountry: string | null;
  plantCity: string | null;
  plantCode: string | null;
  countryOfOrigin: string | null;
  wmi: string;
  checkDigitValid: boolean;
  source: "nhtsa" | "local" | "hybrid";
}

type Field = { label: string; value: string | null | undefined; icon: React.ElementType; color: string };

function refreshDecodeFromLocal(result: DecodeResult): DecodeResult {
  const local = decodeVinLocalFree(result.vin);
  if (!local) return result;
  return {
    ...result,
    model: local.model ?? result.model,
    series: local.series ?? result.series,
    modelYearRange: result.year == null ? (local.modelYearRange ?? result.modelYearRange) : null,
    bodyStyle: local.bodyStyle ?? result.bodyStyle,
    plantCountry: local.plantCountry ?? result.plantCountry,
    plantCity: local.plantCity ?? result.plantCity,
  };
}

export default function FreeVinDecoder() {
  const { t, language } = useTranslation();
  const { displayPrice, fmtPrice } = useDisplayPrice();
  const { getToken, enabled: rcEnabled, ready: rcReady, siteKey: rcSiteKey } = useRecaptcha();
  const recaptchaPrimeRef = useRef<Promise<string | null> | null>(null);
  const recaptchaPrimeAtRef = useRef(0);
  const { isSignedIn, isLoaded, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);

  const normalizedVin = vin.trim().toUpperCase();
  const livePreview = useMemo(
    () => (normalizedVin.length === 17 ? decodeVinLocalFree(normalizedVin) : null),
    [normalizedVin],
  );

  const displayResult = useMemo(
    () => (result ? refreshDecodeFromLocal(result) : null),
    [result],
  );

  const { data: publicSettings, isLoading: settingsLoading } = useQuery<{
    freeVinDecoderRequireSignIn?: boolean;
  }>({
    queryKey: ["/api/payments/public-settings"],
    queryFn: () => fetch(`${basePath}/api/payments/public-settings`).then((r) => r.json()),
    ...spreadQueryExtras<{ freeVinDecoderRequireSignIn?: boolean }>(STATIC_QUERY_OPTIONS),
  });

  const registerRequired = !settingsLoading
    && isLoaded
    && !!publicSettings?.freeVinDecoderRequireSignIn
    && !isSignedIn;

  const handleUnlockFullReport = () => {
    const targetVin = result?.vin ?? vin.trim().toUpperCase();
    const target = buildUnlockCheckoutTarget(targetVin, language, !!isSignedIn);
    if (target) setLocation(target.href);
  };

  const seo = usePageSeo("free_decoder");

  const primeDecoderRecaptcha = () => {
    if (!rcEnabled || !rcSiteKey || loading) return;
    const now = Date.now();
    if (recaptchaPrimeRef.current && now - recaptchaPrimeAtRef.current < 800) return;
    recaptchaPrimeAtRef.current = now;
    recaptchaPrimeRef.current = rcReady
      ? executeRecaptchaToken(rcSiteKey, "free_decoder")
      : getToken("free_decoder");
  };

  const handleDecode = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = normalizedVin;
    const validationKey = getVinValidationErrorKey(v);
    if (validationKey) { setError(t(validationKey)); return; }

    if (registerRequired) {
      setError(t("free_decoder_register_required"));
      return;
    }

    if (rcEnabled && !rcReady) {
      setError(t("error_recaptcha_loading"));
      return;
    }

    setError("");

    const cached = getCachedFreeDecode(v);
    const local = decodeVinLocalFree(v);
    if (local) setResult(local);
    else if (cached) setResult(refreshDecodeFromLocal(cached));

    if (cached) {
      return;
    }

    setLoading(true);
    setEnriching(!!local);
    try {
      const primed = recaptchaPrimeRef.current;
      recaptchaPrimeRef.current = null;
      const rc = await resolveRecaptchaToken({
        enabled: rcEnabled,
        siteKey: rcSiteKey,
        action: "free_decoder",
        primed,
        getToken,
      });
      if (rcEnabled && !rc) {
        setError(t("error_recaptcha_failed"));
        if (!local) setResult(null);
        return;
      }
      const rcParam = rc ? `&rc=${encodeURIComponent(rc)}` : "";

      const runDecode = () => fetch(`${basePath}/api/vin/decode-free?vin=${v}${rcParam}`, {
        credentials: "include",
      });

      let resp = await runDecode();
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string; code?: string };
        const needsSignIn = resp.status === 401
          && (body.code === "SIGN_IN_REQUIRED" || /sign in required/i.test(body.error ?? ""));

        if (needsSignIn) {
          await refreshUser();
          const meRes = await fetch(`${basePath}/api/auth/me`, { credentials: "include" });
          const me = meRes.ok
            ? await meRes.json() as { user?: { id: string } | null }
            : { user: null };

          if (me.user) {
            resp = await runDecode();
            if (resp.ok) {
              const data = refreshDecodeFromLocal(await resp.json() as DecodeResult);
              setResult(data);
              setCachedFreeDecode(data);
              return;
            }
            const retryBody = await resp.json().catch(() => ({})) as { error?: string; code?: string };
            setError(translateClientError(t, retryBody.code, retryBody.error));
            return;
          }

          setError(t("free_decoder_register_required"));
          if (!local) setResult(null);
          return;
        }

        if (!local) {
          setError(translateClientError(t, body.code, body.error));
        }
        return;
      }
      const data = refreshDecodeFromLocal(await resp.json() as DecodeResult);
      setResult(data);
      setCachedFreeDecode(data);
    } catch {
      if (!local) {
        setError(t("error_network"));
        setResult(null);
      }
    } finally {
      setLoading(false);
      setEnriching(false);
    }
  };

  const priceLabel = displayPrice != null
    ? fmtPrice(displayPrice)
    : "...";

  const countryLabels = countryLabelsFromT(t);
  const fmtOriginCountry = (value: string | null | undefined) =>
    value ? formatVinOriginCountry(value, language, countryLabels) : null;

  const allFields: (Field & { group: string })[] = displayResult ? [
    { group: "identity", label: t("free_decoder_field_make"),         value: displayResult.make,  icon: Car,     color: "text-blue-500" },
    { group: "identity", label: t("free_decoder_field_model"),        value: displayResult.model, icon: Car,     color: "text-blue-500" },
    { group: "identity", label: t("free_decoder_field_year"),         value: displayResult.year ? String(displayResult.year) : (displayResult.modelYearRange ?? null), icon: Car, color: "text-primary" },
    { group: "identity", label: t("free_decoder_field_vehicle_type"), value: displayResult.vehicleType, icon: Car, color: "text-indigo-500" },
    { group: "identity", label: t("free_decoder_field_body"),         value: displayResult.bodyStyle,   icon: Car, color: "text-orange-500" },
    { group: "plant",    label: t("free_decoder_field_plant_country"), value: fmtOriginCountry(displayResult.plantCountry), icon: Globe,   color: "text-[#0088d4]" },
    { group: "plant",    label: t("free_decoder_field_plant_city"),    value: displayResult.plantCity ?? null, icon: Factory, color: "text-[#00a5fd]" },
  ].filter(f => f.value !== null) : [];

  const groups: { key: string; label: string; icon: React.ElementType; color: string; bg: string }[] = [
    { key: "identity", label: t("free_decoder_group_identity"), icon: Car,     color: "text-blue-500",  bg: "bg-blue-500/10" },
    { key: "plant",    label: t("free_decoder_group_origin"),   icon: Factory, color: "text-[#00a5fd]", bg: "bg-[#00a5fd]/10" },
  ];

  /** Redaction widths stand in for withheld values — never render the sample text. */
  const lockedRows = [
    {
      icon: Gauge,
      label: t("free_decoder_teaser_mileage"),
      bars: ["w-[58%]", "w-[31%]"],
    },
    {
      icon: AlertTriangle,
      label: t("free_decoder_teaser_accidents"),
      bars: ["w-[42%]", "w-[66%]"],
    },
    {
      icon: ShieldCheck,
      label: t("free_decoder_teaser_salvage"),
      bars: ["w-[71%]", "w-[24%]"],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={seo.title} description={seo.description} lang={seo.lang} canonicalPath={seo.canonicalPath} />

      {/* ── HERO ── */}
      <section className="relative py-16 md:py-24 px-4 overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(var(--primary)/0.1),transparent)]" />
        <div className="absolute inset-0 -z-10 hidden dark:block bg-[radial-gradient(#1e2d40_1px,transparent_1px)] [background-size:28px_28px] opacity-25" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {t("free_decoder_badge")}
          </motion.div>

          <h1 className="text-4xl md:text-[3.25rem] font-black tracking-tight leading-[1.08]">
            {t("free_decoder_title_lead") ? (
              <span>{t("free_decoder_title_lead")}{" "}</span>
            ) : null}
            <span className="text-primary">{t("free_decoder_title_highlight")}</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto leading-relaxed">
            {t("free_decoder_subtitle")}
          </p>

          <form onSubmit={handleDecode} className="max-w-xl mx-auto space-y-3 pt-2">
            <div className="relative p-[2px] rounded-2xl sm:shadow-xl sm:shadow-black/8" dir="ltr">
            <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-background transition-colors focus-within:border-[#00a5fd]">
              <Search className="pointer-events-none absolute left-5 top-7 h-5 w-5 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                dir="ltr"
                className="vin-input-ltr h-14 pl-12 pr-36 text-base text-left border-0 focus-visible:ring-0 rounded-2xl shadow-none bg-transparent font-mono tracking-widest placeholder:text-left"
                placeholder={t("vin_placeholder")}
                value={vin}
                onChange={(e) => { setVin(e.target.value.toUpperCase()); setError(""); }}
                maxLength={17}
                autoCapitalize="characters"
                spellCheck={false}
              />
              <Button
                type="submit"
                size="lg"
                onPointerDown={primeDecoderRecaptcha}
                onTouchStart={primeDecoderRecaptcha}
                disabled={loading || registerRequired || (rcEnabled && !rcReady) || normalizedVin.length !== 17}
                className="absolute right-2 top-2 h-10 rounded-xl px-6 font-semibold shadow-md shadow-primary/20"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    {enriching ? t("free_decoder_enriching_btn") : t("free_decoder_decode_btn")}
                  </span>
                ) : t("free_decoder_decode_btn")}
              </Button>
              <div className="flex items-end gap-[3px] px-3 pb-2.5" aria-hidden>
                {Array.from({ length: 17 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      i < normalizedVin.length ? "bg-[#00a5fd]" : "bg-[#00a5fd]/15",
                    )}
                  />
                ))}
              </div>
            </div>
            </div>
            {registerRequired && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left"
              >
                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {t("free_decoder_register_required")}{" "}
                  <Link href={pathFor(language, "sign_up")} className="font-semibold text-primary hover:underline">
                    {t("sign_up")}
                  </Link>
                  {" · "}
                  <Link href={pathFor(language, "sign_in")} className="font-semibold text-primary hover:underline">
                    {t("sign_in")}
                  </Link>
                </p>
              </motion.div>
            )}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive"
              >
                {error}
              </motion.p>
            )}
            {livePreview && !result && (livePreview.make || livePreview.year) && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-muted-foreground"
              >
                {t("free_decoder_instant_preview")}:{" "}
                <span className="font-semibold text-foreground">
                  {[livePreview.year, livePreview.make, livePreview.model].filter(Boolean).join(" ")}
                </span>
              </motion.p>
            )}
          </form>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
            {[
              { icon: Zap, text: t("trust_instant_report") },
              ...(!registerRequired
                ? [{ icon: ShieldCheck, text: t("free_decoder_trust_no_reg") }]
                : []),
              { icon: Globe, text: t("stats_countries_badge") },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {text}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── RESULTS ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="px-4 pb-24 max-w-4xl mx-auto space-y-8"
          >
            {/* VIN banner */}
            <div className="rounded-2xl border-2 border-border bg-background shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b bg-muted/20">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("free_decoder_decoded_vin")}</p>
                  <p className="font-mono font-bold text-xl tracking-widest text-foreground">{result.vin}</p>
                  {(displayResult?.make || displayResult?.year) && (
                    <p className="text-sm text-muted-foreground font-medium">
                      {[displayResult?.year, displayResult?.make, displayResult?.model].filter(Boolean).join(" ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isNorthAmericanMarketVin(result.vin) && result.checkDigitValid && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-[#0088d4] dark:text-[#00a5fd] bg-[#e6f6ff] dark:bg-[#003a5c]/40/40 border border-[#b3e3fe] dark:border-[#006aa8] rounded-full px-3 py-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("free_decoder_check_valid")}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground bg-muted/60 border rounded-full px-2.5 py-1">
                    {result.source === "local"
                      ? t("free_decoder_source_local")
                      : result.source === "hybrid"
                        ? t("free_decoder_source_hybrid")
                        : t("free_decoder_source_nhtsa")}
                    {enriching && ` · ${t("free_decoder_enriching")}`}
                  </span>
                </div>
              </div>

              {/* Unidentified vehicle — soft recheck hint, not a VIN error */}
              {displayResult && !isTrustworthyVinDecode({
                vin: displayResult.vin,
                make: displayResult.make,
                model: displayResult.model,
                year: displayResult.year,
              }) && (
                <div className="border-b px-5 py-3.5">
                  <VinDecodeRecheckHint className="border-0 bg-transparent p-0" />
                </div>
              )}
            </div>

            {/* Grouped spec fields — make / model / year / plant / type+body only */}
            {allFields.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold">{t("free_decoder_results_title")}</h2>
                {groups.map(group => {
                  const fields = allFields.filter(f => f.group === group.key);
                  if (fields.length === 0) return null;
                  return (
                    <motion.div
                      key={group.key}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 rounded-lg ${group.bg} flex items-center justify-center`}>
                          <group.icon className={`h-3.5 w-3.5 ${group.color}`} />
                        </div>
                        <span className="text-sm font-semibold text-muted-foreground">{group.label}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                        {fields.map(({ label, value, icon: Icon, color }) => (
                          <motion.div
                            key={label}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-xl border bg-card p-3.5 space-y-1.5 hover:border-border/80 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-3 w-3 shrink-0 ${color}`} />
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
                            </div>
                            <p className="font-semibold text-sm text-foreground leading-snug">{value}</p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Locked teaser — redacted case file */}
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-lg border border-[#00a5fd]/25 bg-card/85 dark:bg-[#060a14]/80">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[#00a5fd]" />

                <div className="flex items-center gap-2.5 border-b border-border/60 bg-muted/30 px-3 py-2 pl-4 dark:bg-white/[0.03]">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#0088d4] dark:text-[#33bbfd]" />
                  <p className="min-w-0 flex-1 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#0088d4] dark:text-[#33bbfd]">
                    {t("free_decoder_locked_section")}
                  </p>
                  <span className="shrink-0 rounded-sm border border-dashed border-[#00a5fd]/40 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#0088d4]/80 dark:text-[#33bbfd]/80">
                    {t("free_decoder_locked")}
                  </span>
                </div>

                <dl className="divide-y divide-dashed divide-border/60">
                  {lockedRows.map(({ icon: Icon, label, bars }) => (
                    <div
                      key={label}
                      className="grid gap-x-5 gap-y-2 px-3 py-3 pl-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-center"
                    >
                      <dt className="flex min-w-0 items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          {label}
                        </span>
                      </dt>
                      <dd className="space-y-1.5" aria-label={t("free_decoder_locked")}>
                        {bars.map((width, i) => (
                          <span
                            key={i}
                            aria-hidden
                            className={`block h-3 rounded-[2px] bg-foreground/85 dark:bg-white/75 ${width}`}
                          />
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-col gap-2.5 border-t border-dashed border-border/60 bg-muted/20 px-3 py-3 pl-4 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t("free_decoder_what_locked_desc")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 rounded-md px-4 text-xs font-bold"
                    onClick={handleUnlockFullReport}
                  >
                    {t("free_decoder_unlock_btn")} — {priceLabel}
                  </Button>
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="rounded-2xl bg-gradient-to-br from-[hsl(217,80%,28%)] via-primary to-[hsl(199,76%,32%)] p-7 md:p-9 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_30%,rgba(255,255,255,0.1),transparent)]" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <h3 className="text-xl md:text-2xl font-bold text-white">
                      {t("free_decoder_cta_title")}
                    </h3>
                    <p className="text-white/65 text-sm max-w-sm">
                      {t("free_decoder_cta_desc")}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-3 shrink-0">
                    <Button
                      type="button"
                      size="lg"
                      className="bg-white text-primary hover:bg-white/90 font-bold h-12 px-8 rounded-xl shadow-xl shadow-black/20 whitespace-nowrap"
                      onClick={handleUnlockFullReport}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {t("free_decoder_unlock_btn")} — {priceLabel}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <span className="flex items-center gap-1.5 text-white/55 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5 text-white/70" />
                      {t("trust_secure_payment")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEO CONTENT (always visible for crawlers & users) ── */}
      <section className="px-4 pb-24 max-w-5xl mx-auto">
        {!result && !loading && (
          <>
          {/* What you get grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
            {[
              {
                icon: Car,
                color: "text-primary",
                bg: "bg-primary/10",
                border: "border-primary/20",
                badge: t("free"),
                badgeCls: "bg-primary/10 text-primary",
                title: t("free_decoder_what_decode"),
                desc: t("free_decoder_what_decode_desc"),
              },
              {
                icon: Lock,
                color: "text-orange-500",
                bg: "bg-orange-500/10",
                border: "border-orange-200 dark:border-orange-900/30",
                badge: t("free_decoder_locked"),
                badgeCls: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400",
                title: t("free_decoder_what_locked"),
                desc: t("free_decoder_what_locked_desc"),
              },
              {
                icon: ShieldCheck,
                color: "text-[#00a5fd]",
                bg: "bg-[#00a5fd]/10",
                border: "border-[#b3e3fe] dark:border-[#0c4a6e]/30",
                badge: t("free_decoder_what_full"),
                badgeCls: "bg-[#ccebfe] dark:bg-[#003a5c]/40 text-[#0088d4] dark:text-[#00a5fd]",
                title: t("free_decoder_what_full"),
                desc: t("free_decoder_what_full_desc"),
              },
            ].map(({ icon: Icon, color, bg, border, badge, badgeCls, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl border ${border} bg-card p-6 space-y-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeCls}`}>{badge}</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-sm leading-snug">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Example VIN hint */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center space-y-4 mb-16"
          >
            <p className="text-sm text-muted-foreground font-medium">{t("free_decoder_example_try")}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {FREE_DECODER_BRAND_CARDS.slice(0, 3).map((brand) => (
                <button
                  key={brand.sampleVin}
                  type="button"
                  onClick={() => { setVin(brand.sampleVin); setError(""); }}
                  className="flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-xs font-medium hover:border-primary hover:text-primary hover:shadow-[0_0_12px_rgba(0,165,253,0.15)] transition-all"
                >
                  <Car className="h-3.5 w-3.5" />
                  {t(`free_decoder_brand_${brand.id}_title`)}
                  <span className="font-mono text-muted-foreground">{brand.sampleVin.slice(0, 8)}…</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
          </>
        )}

        <FreeDecoderSeoSection
          onTryVin={(v) => { setVin(v); setError(""); }}
          onUnlock={result ? handleUnlockFullReport : undefined}
        />
      </section>
    </div>
  );
}
