import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Gauge, BarChart3, Lock,
  FileText, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { useDisplayPrice } from "@/hooks/use-display-price";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { pathFor } from "@/lib/localized-routes";

function useReportItems(t: (k: string) => string) {
  return [
    { icon: Gauge, label: t("report_mileage"), color: "text-orange-500", bg: "bg-orange-500/10", ring: "ring-orange-500/15" },
    { icon: AlertTriangle, label: t("report_accidents"), color: "text-red-500", bg: "bg-red-500/10", ring: "ring-red-500/15" },
    { icon: ShieldCheck, label: t("report_salvage"), color: "text-amber-500", bg: "bg-amber-500/10", ring: "ring-amber-500/15" },
    { icon: Lock, label: t("report_theft"), color: "text-purple-500", bg: "bg-purple-500/10", ring: "ring-purple-500/15" },
    { icon: FileText, label: t("report_ownership"), color: "text-blue-500", bg: "bg-blue-500/10", ring: "ring-blue-500/15" },
    { icon: BarChart3, label: t("report_specs"), color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/15" },
  ] satisfies Array<{ icon: LucideIcon; label: string; color: string; bg: string; ring: string }>;
}

type PreviewRow = {
  key: string;
  labelKey: string;
  value?: string;
  valueKey?: string;
  valuePrefix?: string;
  warn: boolean;
  highlight?: boolean;
  ownersCount?: number;
};

const PREVIEW_ROWS: readonly PreviewRow[] = [
  { key: "mileage", labelKey: "mock_label_mileage", value: "138,600 km", warn: true, highlight: true },
  { key: "accidents", labelKey: "mock_label_accidents", valueKey: "demo_found", valuePrefix: "2 ", warn: true },
  { key: "salvage", labelKey: "mock_label_salvage", valueKey: "mock_value_salvage", warn: false },
  { key: "stolen", labelKey: "mock_label_stolen", valueKey: "mock_value_stolen", warn: false },
  { key: "owners", labelKey: "mock_label_owners", warn: true },
];

type Props = {
  className?: string;
  demoVin?: string;
  demoVehicle?: string;
  demoOriginKey?: string;
  demoScore?: number;
  demoBadgeKey?: string;
  demoBadgeClassName?: string;
  demoScoreClassName?: string;
  previewRows?: readonly PreviewRow[];
};

export function VinCheckIncludesSection({
  className,
  demoVin = "KNDPM3AC9K7583241",
  demoVehicle = "2019 Kia Sportage",
  demoOriginKey = "country_korea_name",
  demoScore = 6.4,
  demoBadgeKey = "report_caution",
  demoBadgeClassName = "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  demoScoreClassName = "text-amber-600 dark:text-amber-400",
  previewRows = PREVIEW_ROWS,
}: Props) {
  const { t, language } = useTranslation();
  const { displayPrice, basePrice: pricingBase, isDiscount, loading: priceLoading, fmtPrice } = useDisplayPrice();
  const reportItems = useReportItems(t);

  return (
    <section className={cn(
      "relative overflow-hidden border-y py-16 md:py-24 px-4",
      "bg-gradient-to-b from-muted/40 via-background to-background dark:from-white/[0.03] dark:via-background dark:to-background",
      className,
    )}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_40%,hsl(var(--primary)/0.07),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(hsl(var(--foreground)/0.035)_1px,transparent_1px)] [background-size:24px_24px] opacity-60 dark:opacity-30" />

      <div className="max-w-6xl mx-auto relative">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-10 lg:gap-14 xl:gap-16 items-center">

          {/* ── Copy + checklist ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-7 order-2 lg:order-1"
          >
            <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden divide-y divide-border/50">
              {reportItems.map(({ icon: Icon, label, color, bg, ring }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                  className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-muted/25 transition-colors"
                >
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1",
                    bg, ring,
                  )}>
                    <Icon className={cn("h-[18px] w-[18px]", color)} />
                  </div>
                  <span className="text-sm sm:text-[15px] font-medium flex-1 leading-snug">{label}</span>
                  <CheckCircle2 className="h-4 w-4 text-[#00a5fd]/90 shrink-0" aria-hidden />
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
              <Button asChild size="lg" className="h-12 px-7 rounded-xl font-semibold shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-[#0077c2] hover:opacity-[0.97]">
                <Link href={pathFor(language, "pricing")}>{t("get_started")}</Link>
              </Button>
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-primary/15 bg-primary/[0.04]">
                {priceLoading ? (
                  <Skeleton className="h-8 w-20 rounded-full" />
                ) : (
                  <span className="text-2xl font-black tabular-nums text-primary leading-none">
                    {displayPrice != null ? fmtPrice(displayPrice) : "—"}
                  </span>
                )}
                {!priceLoading && isDiscount && pricingBase != null && (
                  <>
                    <span className="text-sm line-through text-muted-foreground tabular-nums">
                      {fmtPrice(pricingBase)}
                    </span>
                    <Badge className="bg-orange-500 text-white border-0 text-[10px] px-2 py-0">
                      {t("limited_time")}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Report preview ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative order-1 lg:order-2"
          >
            <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-4 lg:hidden">
              {t("sample_report_preview_label")}
            </p>

            <div className="absolute -inset-6 bg-gradient-to-br from-primary/12 via-primary/4 to-transparent rounded-[2rem] blur-2xl -z-10 opacity-80" />

            <div className="rounded-2xl border border-border/80 bg-card shadow-[0_20px_60px_-24px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_64px_-28px_rgba(0,0,0,0.55)] overflow-hidden ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
              <div className="h-[3px] bg-gradient-to-r from-primary via-cyan-400 to-primary/60" />

              <div className="px-5 py-4 border-b border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-background flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-mono tracking-wider text-muted-foreground truncate">
                    {demoVin}
                  </p>
                  <p className="font-bold text-base sm:text-lg tracking-tight mt-0.5">{demoVehicle}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t(demoOriginKey)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 rounded-lg text-[10px] font-bold px-2.5 py-1", demoBadgeClassName)}
                >
                  {t(demoBadgeKey)}
                </Badge>
              </div>

              <div className="px-5 py-3.5 border-b border-border/50 bg-muted/25 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("mock_label_score")}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-2xl font-black tabular-nums", demoScoreClassName)}>{demoScore}</span>
                  <span className="text-sm font-medium text-muted-foreground">/10</span>
                </div>
              </div>

              <div className="p-5 space-y-0">
                {previewRows.map((row) => {
                  const label = t(row.labelKey);
                  let value: string;
                  if (row.key === "owners") {
                    value = `${"ownersCount" in row ? row.ownersCount : 3} ${t("mock_label_owners")}`;
                  } else if ("valueKey" in row && row.valueKey) {
                    value = row.valueKey === "demo_found"
                      ? `${"valuePrefix" in row ? row.valuePrefix ?? "" : ""}${t(row.valueKey)}`
                      : t(row.valueKey);
                  } else {
                    value = row.value ?? "";
                  }
                  const isMileage = row.key === "mileage";

                  return (
                    <div
                      key={row.key}
                      className={cn(
                        "py-3 border-b border-border/40 last:border-0",
                        row.highlight && "bg-amber-500/[0.04] -mx-5 px-5 rounded-lg border-amber-500/10",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {row.warn ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#00a5fd]" />
                          )}
                          <span className={cn(
                            "text-sm font-semibold tabular-nums",
                            row.warn ? "text-amber-700 dark:text-amber-400" : "text-foreground",
                          )}>
                            {value}
                          </span>
                        </div>
                      </div>
                      {isMileage && (
                        <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                            initial={{ width: "0%" }}
                            whileInView={{ width: "43%" }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full mt-4 h-10 rounded-xl gap-1.5 border-border/70 hover:border-primary/35 hover:bg-primary/[0.04]"
                >
                  <Link href={pathFor(language, "pricing")}>
                    {t("see_whats_included")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
