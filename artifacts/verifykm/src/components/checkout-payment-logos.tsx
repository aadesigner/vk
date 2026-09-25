import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const POK_SITE_URL = "https://pokpay.io/en";

export const CHECKOUT_PAYPAL_LOGO_SRC = `${basePath}/payments/paypal6.png`;
export const CHECKOUT_POK_LOGO_SRC = `${basePath}/payments/pok-business.png`;

const PRELOAD_SRCS = [CHECKOUT_PAYPAL_LOGO_SRC, CHECKOUT_POK_LOGO_SRC] as const;

/** Warm browser cache for both logos so tab switches do not flash a reload. */
export function preloadCheckoutPaymentLogos(): void {
  if (typeof window === "undefined") return;
  for (const src of PRELOAD_SRCS) {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

/** Call once on checkout pages so logos are ready before the user picks a method. */
export function usePreloadCheckoutPaymentLogos(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    preloadCheckoutPaymentLogos();
  }, [enabled]);
}

export type CheckoutPaymentProvider = "paypal" | "pok";

type Props = {
  provider: CheckoutPaymentProvider;
  className?: string;
};

export function CheckoutPaymentLogos({ provider, className }: Props) {
  const { t } = useTranslation();

  if (provider === "paypal") {
    return (
      <div className={cn("flex flex-col items-center gap-0 py-0 pb-0", className)}>
        <p className="text-center text-[11px] sm:text-xs text-muted-foreground leading-snug max-w-sm px-1 mb-0">
          {t("checkout_processed_by_paypal")}
        </p>
        <span className="inline-flex h-12 w-28 sm:h-14 sm:w-32 -mt-1 mb-0 items-center justify-center rounded-md px-1 pt-0 pb-0">
          <img
            src={CHECKOUT_PAYPAL_LOGO_SRC}
            alt="PayPal"
            className="checkout-payment-logo-img max-h-full max-w-full object-contain object-top"
            loading="eager"
            decoding="async"
            fetchPriority="low"
          />
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-2.5 py-1", className)}>
      <p className="text-center text-[11px] sm:text-xs text-muted-foreground leading-snug max-w-sm px-1">
        {t("checkout_processed_by_pok")}
      </p>
      <a
        href={POK_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="POK"
      >
        <img
          src={CHECKOUT_POK_LOGO_SRC}
          alt="POK"
          className="h-7 sm:h-8 w-auto max-w-[9rem] object-contain object-center"
          loading="eager"
          decoding="async"
          fetchPriority="low"
        />
      </a>
    </div>
  );
}
