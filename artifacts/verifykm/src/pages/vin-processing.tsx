import { useTranslation } from "@/i18n/context";
import type { Language } from "@/lib/languages";
import { useLocation, Link } from "wouter";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLookupVin } from "@workspace/api-client-react";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { SEOHead } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { pathFor } from "@/lib/localized-routes";

interface Props {
  params: { lang: string };
}

export default function VinProcessing({ params }: Props) {
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const lookupVin = useLookupVin();
  const hasStarted = useRef(false);

  const [vin, setVin] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | undefined>(undefined);

  const runLookup = useCallback(() => {
    if (!vin) return;
    if (lookupVin.isError) lookupVin.reset();
    lookupVin.mutate(
      {
        data: {
          vin,
          paymentIntentId: paymentIntentId ?? null,
        },
      },
      {
        onSuccess: (result) => {
          sessionStorage.removeItem("pending_vin");
          setLocation(`/${language}/vin/${result.vin}`);
        },
      },
    );
  }, [vin, paymentIntentId, lookupVin, language, setLocation]);

  useEffect(() => {
    if (hasStarted.current) return;

    const searchParams = new URLSearchParams(window.location.search);
    const intentId = searchParams.get("payment_intent") || undefined;
    const pendingVin = sessionStorage.getItem("pending_vin") || searchParams.get("vin");

    if (!pendingVin) {
      setLocation(pathFor(language, "dashboard"));
      return;
    }

    hasStarted.current = true;
    setVin(pendingVin);
    setPaymentIntentId(intentId);
  }, [language, setLocation]);

  useEffect(() => {
    if (!vin || lookupVin.isPending || lookupVin.isSuccess || lookupVin.isError) return;
    runLookup();
  }, [vin, lookupVin.isPending, lookupVin.isSuccess, lookupVin.isError, runLookup]);

  const isError = lookupVin.isError;

  return (
    <>
      <SEOHead
        title={`${t("processing_payment")} — verifykm.com`}
        description={t("processing_desc")}
        lang={language as Language}
        noIndex
      />
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-6">
        {isError ? (
          <>
            <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{t("processing_failed")}</h2>
              <p className="text-muted-foreground max-w-sm">{t("processing_failed_desc")}</p>
              {vin && (
                <p className="text-sm font-mono text-foreground/80 pt-1">
                  {t("processing_vin_label")}: {vin}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={() => runLookup()}
                disabled={lookupVin.isPending || !vin}
              >
                {lookupVin.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("processing_retrying")}</>
                ) : (
                  <><RotateCcw className="h-4 w-4 mr-2" />{t("processing_retry")}</>
                )}
              </Button>
              <Button asChild variant="outline">
                <Link href={pathFor(language, "dashboard")}>{t("back_to_dashboard")}</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              {lookupVin.isSuccess ? (
                <CheckCircle2 className="h-10 w-10 text-primary" />
              ) : (
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{t("processing_payment")}</h2>
              <p className="text-muted-foreground max-w-sm">{t("processing_desc")}</p>
              {vin && (
                <p className="text-sm font-mono text-muted-foreground pt-1">{vin}</p>
              )}
            </div>
            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("processing_retrieving_data")}</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
