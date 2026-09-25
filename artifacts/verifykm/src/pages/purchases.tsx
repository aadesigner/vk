import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocation, Link } from "wouter";
import { useEffect } from "react";
import { useTranslation } from "@/i18n/context";
import { LANG_META, type Language } from "@/lib/languages";
import { useGetUserPayments, useGetUserStats } from "@workspace/api-client-react";
import { CLIENT_AREA_QUERY_OPTIONS, orvalQuery } from "@/lib/query-options";
import type { PaymentHistoryPage, UserStats } from "@workspace/api-client-react";
import { ClientAreaLayout } from "@/components/client-area-layout";
import { ClientQueryFallback } from "@/components/client-query-fallback";
import { getErrorStatus } from "@/lib/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, ShoppingBag,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { SEOHead } from "@/components/seo";
import { cn } from "@/lib/utils";
import { formatDisplayPrice } from "@/lib/format-display-price";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion-variants";
import { pathFor } from "@/lib/localized-routes";

type Payment = {
  id: number;
  vin?: string | null;
  amount: number;
  currency: string;
  status: string;
  couponCode?: string | null;
  discountAmount?: number | null;
  vinLookupId?: number | null;
  paypalOrderId?: string | null;
  pokOrderId?: string | null;
  kind?: string | null;
  createdAt: string;
};

type PaymentStats = {
  completedPayments?: number;
  paymentCurrency?: string;
};

const LOCALE_MAP: Record<string, string> = Object.fromEntries(
  Object.values(LANG_META).map((m) => [m.code, m.intl]),
);

const STATUS_STYLE: Record<string, {
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  icon: React.ReactNode;
}> = {
  completed: {
    variant: "default",
    className: "bg-[#00a5fd] hover:bg-[#008fd9] text-white border-0",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  pending: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  refunded: { variant: "outline", icon: <AlertTriangle className="h-3 w-3" /> },
  revoked: {
    variant: "outline",
    className: "border-orange-400 text-orange-600 dark:text-orange-400",
    icon: <XCircle className="h-3 w-3" />,
  },
};

function PaymentStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = STATUS_STYLE[status] ?? { variant: "outline" as const, icon: null };
  const label = STATUS_STYLE[status] ? t(status) : status;
  return (
    <Badge variant={cfg.variant} className={cn("inline-flex items-center gap-1 w-fit text-xs px-2 py-0.5", cfg.className)}>
      {cfg.icon}
      {label}
    </Badge>
  );
}

function formatMoney(currency: string, amount: number) {
  if (currency === "EUR") return formatDisplayPrice(amount, "€");
  if (currency === "USD") return formatDisplayPrice(amount, "$");
  return `${currency} ${amount.toFixed(2)}`;
}

function paymentMethodLabel(payment: Payment, t: (key: string) => string): string {
  if (payment.pokOrderId) return "POK";
  if (payment.paypalOrderId) return t("checkout_pay_method_paypal");
  if (payment.kind === "credit_redemption") return t("checkout_pay_with_credits");
  if (payment.amount === 0 && payment.couponCode) return t("purchase_pay_method_coupon");
  if (payment.amount === 0) return t("purchase_pay_method_free");
  return t("checkout_pay_method_paypal");
}

function listPrice(payment: Payment): number {
  const discount = payment.discountAmount ?? 0;
  return discount > 0 ? payment.amount + discount : payment.amount;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] gap-x-3 gap-y-0.5 items-baseline text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function PaymentHistoryCard({ payment, locale, index }: { payment: Payment; locale: string; index: number }) {
  const { t } = useTranslation();
  const created = new Date(payment.createdAt);
  const dateStr = created.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = created.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const showListPrice = (payment.discountAmount ?? 0) > 0;
  const accordionValue = `payment-${payment.id}`;

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      custom={index}
      className="rounded-xl border bg-background shadow-sm overflow-hidden"
    >
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={accordionValue} className="border-b-0">
          <AccordionTrigger className="px-4 sm:px-5 py-4 sm:py-5 hover:no-underline">
            <div className="flex items-start gap-3 sm:gap-4 w-full text-left">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold tabular-nums text-lg sm:text-xl">
                      {formatMoney(payment.currency, payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dateStr} · {timeStr}
                    </p>
                    <p className="text-xs sm:text-sm text-foreground/80 mt-1 truncate">
                      {payment.vin ? (
                        <span className="font-mono font-semibold tracking-wide">{payment.vin}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("unknown_vin")}</span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <PaymentStatusBadge status={payment.status} />
                  </div>
                </div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-border/60">
            <div className="space-y-2.5 pt-4">
              <DetailRow label={t("purchase_detail_date")}>{dateStr}</DetailRow>
              <DetailRow label={t("purchase_detail_time")}>{timeStr}</DetailRow>
              <DetailRow label={t("purchase_detail_vin")}>
                {payment.vin ? (
                  <span className="font-mono font-semibold tracking-wide">{payment.vin}</span>
                ) : (
                  <span className="text-muted-foreground">{t("unknown_vin")}</span>
                )}
              </DetailRow>
              <DetailRow label={t("purchase_detail_status")}>
                <PaymentStatusBadge status={payment.status} />
              </DetailRow>
              <DetailRow label={t("purchase_detail_list_price")}>
                <span className="tabular-nums font-medium">
                  {formatMoney(payment.currency, listPrice(payment))}
                </span>
                {showListPrice && (
                  <span className="text-muted-foreground text-xs ml-2">
                    (−{formatMoney(payment.currency, payment.discountAmount!)})
                  </span>
                )}
              </DetailRow>
              <DetailRow label={t("purchase_detail_amount_paid")}>
                <span className="tabular-nums font-semibold text-foreground">
                  {formatMoney(payment.currency, payment.amount)}
                </span>
              </DetailRow>
              <DetailRow label={t("purchase_detail_payment_method")}>
                {paymentMethodLabel(payment, t)}
              </DetailRow>
              {payment.couponCode && (
                <DetailRow label={t("coupon")}>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{payment.couponCode}</span>
                </DetailRow>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  );
}

export default function Purchases({ params }: { params: { lang: string; [key: string]: string } }) {
  const { language, t } = useTranslation();
  const { isSignedIn, isLoaded, user } = useAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const locale = LOCALE_MAP[language] ?? "en-US";

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation(pathFor(language, "sign_in"));
  }, [isLoaded, isSignedIn, language, setLocation]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (user.hasPassword === false) {
      setLocation(`/${language}/set-password`);
    }
  }, [isLoaded, isSignedIn, user, language, setLocation]);

  const authReady = isSignedIn;
  const { data, isLoading, isError, error, refetch, isFetching } = useGetUserPayments(
    { page, limit: 20 },
    { query: { enabled: authReady, ...orvalQuery<PaymentHistoryPage>(CLIENT_AREA_QUERY_OPTIONS) } },
  );
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
    isFetching: statsFetching,
  } = useGetUserStats({
    query: { enabled: authReady, ...orvalQuery<UserStats>(CLIENT_AREA_QUERY_OPTIONS) },
  });

  const paymentStats = stats as (typeof stats & PaymentStats) | undefined;

  useEffect(() => {
    const err = error ?? statsErr;
    if (err && getErrorStatus(err) === 401) {
      setLocation(pathFor(language, "sign_in"));
    }
  }, [error, statsErr, language, setLocation]);

  const lang = params.lang;
  const items = (data?.items ?? [] as Payment[]).filter(
    (p: Payment) => p.status !== "failed" && p.status !== "pending",
  );
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.ceil(total / limit);
  const completedCount = paymentStats?.completedPayments ?? 0;
  const totalSpent = paymentStats?.totalSpent ?? 0;
  const summaryCurrency = paymentStats?.paymentCurrency ?? items[0]?.currency ?? "";
  const hasPaymentsData = data != null;
  const summaryLoading = (isLoading && !hasPaymentsData) || (statsLoading && stats == null);
  const paymentsLoadError = isError ? error : statsError ? statsErr : null;

  const retryQueries = () => {
    if (isError) void refetch();
    if (statsError) void refetchStats();
  };

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={`${t("purchases_title")} — verifykm.com`}
        description={t("purchases_subtitle")}
        lang={lang as Language}
        noIndex
      />
      <ClientAreaLayout
        heading={(
          <div className="flex items-start justify-between gap-4 text-left">
            <div className="min-w-0 text-left">
              <h1 className="text-left text-2xl font-extrabold tracking-tight sm:text-3xl">{t("purchases_title")}</h1>
              <p className="mt-1 text-left text-sm text-muted-foreground sm:text-base">{t("purchases_subtitle")}</p>
            </div>
            <Button variant="outline" size="sm" className="md:hidden" asChild>
              <Link href={`/${lang}/dashboard`}>
                {t("back_to_dashboard")}
              </Link>
            </Button>
          </div>
        )}
      >
        <div className="w-full space-y-6 px-4 pb-2 md:space-y-7 md:px-0 md:pb-0">

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={1}
        className="grid grid-cols-3 gap-2 sm:gap-4"
      >
        {[
          { label: t("payments"), value: summaryLoading ? "—" : String(total), cls: "text-primary" },
          { label: t("completed"), value: summaryLoading ? "—" : String(completedCount), cls: "text-[#0088d4]" },
          {
            label: t("total"),
            value: summaryLoading ? "—" : formatMoney(summaryCurrency, totalSpent),
            cls: "text-foreground",
          },
        ].map(({ label, value, cls }) => (
          <div key={label} className="min-w-0 rounded-xl border bg-background p-3 sm:p-5 shadow-sm">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium leading-tight break-words">
              {label}
            </p>
            <p className={cn("text-base sm:text-[1.75rem] font-black mt-1.5 tabular-nums truncate", cls)}>{value}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={2}
      >
      <Card className="shadow-sm">
        <CardHeader className="pb-4 px-5 sm:px-6 pt-5 sm:pt-6">
          <CardTitle className="text-lg">{t("payment_history")}</CardTitle>
          <CardDescription className="text-sm">{isLoading ? t("purchases_loading") : `${total} ${total !== 1 ? t("payments") : t("payment_singular")}`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3.5 px-5 sm:px-6 pb-5 sm:pb-6">
          <ClientQueryFallback
            isLoading={isLoading}
            isError={isError || statsError}
            isFetching={isFetching || statsFetching}
            hasData={hasPaymentsData}
            error={paymentsLoadError}
            refetch={retryQueries}
            skeleton={Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          >
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border-2 border-dashed border-border bg-muted/20 py-14 px-6 text-center space-y-4"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <ShoppingBag className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-base">{t("no_purchases")}</h3>
                <p className="text-muted-foreground text-sm mt-1">{t("no_purchases_desc")}</p>
              </div>
              <Button asChild>
                <Link href={`/${lang}`}>{t("check_a_vin")}</Link>
              </Button>
            </motion.div>
          ) : (
            items.map((payment, i) => (
              <PaymentHistoryCard key={payment.id} payment={payment} locale={locale} index={i} />
            ))
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">{t("page")} {page} {t("of")} {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          </ClientQueryFallback>
        </CardContent>
      </Card>
      </motion.div>
        </div>
      </ClientAreaLayout>
    </>
  );
}
