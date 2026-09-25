import {
  Gauge, AlertTriangle, ShieldCheck, Lock, type LucideIcon,
} from "lucide-react";

export type ReportFeature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  calloutClass: string;
  accentBg: string;
  example: string;
  stat: string;
  statLabel: string;
};

export function useReportFeatures(t: (k: string) => string): ReportFeature[] {
  return [
    {
      icon: Gauge, title: t("report_mileage"), desc: t("feature_mileage_desc"),
      iconColor: "text-orange-500", bgColor: "bg-orange-500/10",
      borderColor: "border-l-orange-500",
      calloutClass: "bg-orange-50 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-900/50",
      accentBg: "bg-orange-500",
      example: t("feature_mileage_example"),
      stat: t("feature_mileage_stat_value"), statLabel: t("feature_mileage_stat_label"),
    },
    {
      icon: AlertTriangle, title: t("report_accidents"), desc: t("feature_accidents_desc"),
      iconColor: "text-red-500", bgColor: "bg-red-500/10",
      borderColor: "border-l-red-500",
      calloutClass: "bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/50",
      accentBg: "bg-red-500",
      example: t("feature_accidents_example"),
      stat: t("feature_accidents_stat_value"), statLabel: t("feature_accidents_stat_label"),
    },
    {
      icon: ShieldCheck, title: t("report_salvage"), desc: t("feature_salvage_desc"),
      iconColor: "text-amber-500", bgColor: "bg-amber-500/10",
      borderColor: "border-l-amber-500",
      calloutClass: "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50",
      accentBg: "bg-amber-500",
      example: t("feature_salvage_example"),
      stat: t("feature_salvage_stat_value"), statLabel: t("feature_salvage_stat_label"),
    },
    {
      icon: Lock, title: t("report_theft"), desc: t("feature_theft_desc"),
      iconColor: "text-purple-500", bgColor: "bg-purple-500/10",
      borderColor: "border-l-purple-500",
      calloutClass: "bg-purple-50 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50",
      accentBg: "bg-purple-500",
      example: t("feature_theft_example"),
      stat: t("feature_theft_stat_value"), statLabel: t("feature_theft_stat_label"),
    },
  ];
}
