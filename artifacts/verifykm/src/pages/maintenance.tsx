import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Wrench, Sparkles, ArrowLeft, Clock } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { useMaintenanceStatus } from "@/hooks/use-maintenance-status";
import { VerifyKMLogo } from "@/components/logo";

type FeatureKey = "full_site" | "free_decoder" | "checkout" | "vin_reports";

function featureMessageKey(feature: FeatureKey): string {
  if (feature === "free_decoder") return "maintenance_feature_free_decoder";
  if (feature === "checkout") return "maintenance_feature_checkout";
  if (feature === "vin_reports") return "maintenance_feature_vin_reports";
  return "maintenance_body";
}

export default function MaintenancePage() {
  const { t, language } = useTranslation();
  const search = useSearch();
  const { data: status } = useMaintenanceStatus();

  const feature = useMemo((): FeatureKey => {
    const params = new URLSearchParams(search);
    const raw = params.get("feature");
    if (raw === "free_decoder" || raw === "checkout" || raw === "vin_reports") return raw;
    return "full_site";
  }, [search]);

  const customMessage = status?.maintenanceMessage;
  const featureLine = t(featureMessageKey(feature));

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-amber-500/10" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="rounded-3xl border bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/5 p-8 sm:p-10 text-center">
          <div className="flex justify-center mb-6">
            <VerifyKMLogo className="h-8 opacity-90" />
          </div>

          <motion.div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20"
            animate={{ rotate: [0, -8, 8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Wrench className="h-9 w-9 text-primary" />
          </motion.div>

          <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-4">
            <Clock className="h-3.5 w-3.5" />
            {t("maintenance_badge")}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
            {t("maintenance_title")}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-2">
            {t("maintenance_subtitle")}
          </p>
          <p className="text-muted-foreground/90 text-sm leading-relaxed mb-6">
            {feature !== "full_site" ? featureLine : t("maintenance_body")}
          </p>

          {customMessage && (
            <div className="mb-6 rounded-xl border border-amber-200/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 text-left">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{customMessage}</span>
              </div>
            </div>
          )}

          <Button asChild variant="outline" className="gap-2">
            <Link href={`/${language}`}>
              <ArrowLeft className="h-4 w-4" />
              {t("maintenance_back_home")}
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
