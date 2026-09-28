import { useEffect, useMemo, useRef } from "react";
import { GuestCheckoutForm } from "@nebula-ltd/pok-payments-js/react";
import type { PaymentErrorResponse } from "@nebula-ltd/pok-payments-js";
import "@nebula-ltd/pok-payments-js/lib/index.css";
import { useTranslation } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { pokCardErrorI18nKey } from "@/lib/pok-card-error";
import {
  buildPokPaymentInitialState,
  pokPrefillCountryCode,
  syncPokGuestVisibleFields,
  type PokGuestFieldSyncState,
} from "@/lib/pok-guest-fields";

export type PokEnv = "staging" | "production";

type Props = {
  orderId: string;
  pokEnv: PokEnv;
  onSuccess: () => void;
  onError: (message: string) => void;
  className?: string;
};

/** Map app UI language to POK form locales (en | it | al). */
export function pokLocaleFromLanguage(language: string): "en" | "it" | "al" {
  const lang = language.toLowerCase().split("-")[0] ?? "en";
  if (lang === "al" || lang === "sq") return "al";
  if (lang === "it") return "it";
  return "en";
}

/**
 * Inline POK card checkout. Card number / expiry / CVC / name / email / country stay visible.
 * Country uses POK's required dropdown, prefilled from the verifykm profile when set.
 * US/CA open POK's extra billing fields; other countries hide them again.
 * PAN/CVV stay inside the POK SDK — never posted to verifykm.
 */
export function PokGuestCheckout({ orderId, pokEnv, onSuccess, onError, className }: Props) {
  const { language, t } = useTranslation();
  const { user } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const fieldSyncRef = useRef<PokGuestFieldSyncState>({ billingClickAttempted: false });
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const locale = useMemo(() => pokLocaleFromLanguage(language), [language]);
  const countryCode = useMemo(
    () => pokPrefillCountryCode(user?.countryCode),
    [user?.countryCode],
  );

  const initialState = useMemo(
    () => buildPokPaymentInitialState({
      email: user?.email,
      name: user?.name,
      countryCode: user?.countryCode,
    }),
    [user?.email, user?.name, user?.countryCode],
  );

  const options = useMemo(
    () => ({
      env: pokEnv,
      locale,
      countrySelect: "dropdown" as const,
      initialState,
    }),
    [pokEnv, locale, initialState],
  );

  // Stable callbacks — unstable onSuccess/onError can re-bind POK 3DS socket handlers mid-payment.
  const stableOnSuccess = useMemo(() => () => {
    onSuccessRef.current();
  }, []);
  const stableOnError = useMemo(
    () => (error: PaymentErrorResponse) => {
      // Safe canned copy only — never surface raw POK/partner messages.
      onErrorRef.current(t(pokCardErrorI18nKey(error)));
    },
    [t],
  );

  useEffect(() => {
    fieldSyncRef.current = { billingClickAttempted: false };
    const host = hostRef.current;
    if (!host) return;

    let raf = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        fieldSyncRef.current = syncPokGuestVisibleFields(
          host,
          countryCode,
          fieldSyncRef.current,
        );
      });
    };
    run();

    const onCountryInteract = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".pok-payment-option, .pok-payment-options, .pok-payment-modal")) {
        run();
      }
    };
    host.addEventListener("click", onCountryInteract);
    host.addEventListener("change", onCountryInteract);

    // New or removed nodes: US/CA extras mount/unmount. Ignore style-only tweaks (3DS).
    const obs = new MutationObserver((mutations) => {
      const listChanged = mutations.some((m) => m.addedNodes.length > 0 || m.removedNodes.length > 0);
      if (listChanged) run();
    });
    obs.observe(host, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("click", onCountryInteract);
      host.removeEventListener("change", onCountryInteract);
      obs.disconnect();
    };
  }, [orderId, countryCode]);

  return (
    <div
      ref={hostRef}
      className={cn("pok-guest-checkout verifykm-pok-checkout [color-scheme:none]", className)}
      id="pok-payment-container-host"
    >
      <GuestCheckoutForm
        key={orderId}
        orderId={orderId}
        onSuccess={stableOnSuccess}
        onError={stableOnError}
        options={options}
      />
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        <Lock className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" aria-hidden />
        <span>{t("checkout_pok_secure_note")}</span>
      </p>
    </div>
  );
}
