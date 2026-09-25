import {
  Gauge, AlertTriangle, ShieldCheck, Lock, type LucideIcon,
} from "lucide-react";

export type WhatWeCheckMarket = "usa" | "korea" | "canada" | "china" | "japan" | "uae";

type FeatureId = "mileage" | "accidents" | "salvage" | "theft";

export type WhatWeCheckFeature = {
  id: FeatureId;
  icon: LucideIcon;
  title: string;
  desc: string;
  seo: string;
  includes: string[];
  iconColor: string;
  bgColor: string;
  borderColor: string;
  calloutClass: string;
  accentBg: string;
  example: string;
  stat: string;
  statLabel: string;
};

const FEATURE_IDS: FeatureId[] = ["mileage", "accidents", "salvage", "theft"];

const COUNTRY_INCLUDE_INDICES: Record<WhatWeCheckMarket, Record<FeatureId, number[]>> = {
  usa: {
    mileage: [4, 0, 2, 3],
    accidents: [1, 2, 0, 5],
    salvage: [3, 1, 0, 2],
    theft: [5, 4, 0, 1],
  },
  korea: {
    mileage: [2, 0, 1, 3],
    accidents: [1, 5, 0, 2],
    salvage: [5, 3, 0, 1],
    theft: [4, 1, 0, 2],
  },
  canada: {
    mileage: [4, 0, 1, 2],
    accidents: [1, 2, 0, 3],
    salvage: [3, 2, 0, 1],
    theft: [5, 4, 0, 3],
  },
  china: {
    mileage: [4, 2, 0, 1],
    accidents: [1, 0, 2, 3],
    salvage: [3, 1, 0, 2],
    theft: [5, 4, 0, 1],
  },
  japan: {
    mileage: [4, 0, 2, 1],
    accidents: [1, 0, 2, 3],
    salvage: [3, 2, 0, 1],
    theft: [5, 4, 0, 1],
  },
  uae: {
    mileage: [4, 0, 2, 1],
    accidents: [1, 2, 0, 3],
    salvage: [3, 2, 0, 1],
    theft: [5, 4, 0, 3],
  },
};

const COUNTRY_EXAMPLE_INDICES: Record<WhatWeCheckMarket, Record<FeatureId, number>> = {
  usa: { mileage: 2, accidents: 1, salvage: 0, theft: 5 },
  korea: { mileage: 1, accidents: 0, salvage: 3, theft: 4 },
  canada: { mileage: 2, accidents: 1, salvage: 0, theft: 3 },
  china: { mileage: 2, accidents: 0, salvage: 1, theft: 4 },
  japan: { mileage: 2, accidents: 0, salvage: 1, theft: 4 },
  uae: { mileage: 2, accidents: 1, salvage: 0, theft: 3 },
};

function countryIncluded(t: (k: string) => string, market: WhatWeCheckMarket, index: number) {
  return t(`country_${market}_included_${index}`);
}

function countryIssue(t: (k: string) => string, market: WhatWeCheckMarket, index: number) {
  return t(`country_${market}_issue_${index}`);
}

function globalIncludes(t: (k: string) => string, id: FeatureId) {
  return [0, 1, 2, 3].map((i) => t(`feature_${id}_include_${i}`));
}

function buildFeature(
  t: (k: string) => string,
  id: FeatureId,
  market?: WhatWeCheckMarket,
): WhatWeCheckFeature {
  const base = {
    mileage: {
      icon: Gauge,
      title: t("report_mileage"),
      desc: t("feature_mileage_desc"),
      seo: t("feature_mileage_seo"),
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-l-orange-500",
      calloutClass: "bg-orange-50 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-900/50",
      accentBg: "bg-orange-500",
      stat: t("feature_mileage_stat_value"),
      statLabel: t("feature_mileage_stat_label"),
      example: t("feature_mileage_example"),
    },
    accidents: {
      icon: AlertTriangle,
      title: t("report_accidents"),
      desc: t("feature_accidents_desc"),
      seo: t("feature_accidents_seo"),
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-l-red-500",
      calloutClass: "bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-900/50",
      accentBg: "bg-red-500",
      stat: t("feature_accidents_stat_value"),
      statLabel: t("feature_accidents_stat_label"),
      example: t("feature_accidents_example"),
    },
    salvage: {
      icon: ShieldCheck,
      title: t("report_salvage"),
      desc: t("feature_salvage_desc"),
      seo: t("feature_salvage_seo"),
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-l-amber-500",
      calloutClass: "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50",
      accentBg: "bg-amber-500",
      stat: t("feature_salvage_stat_value"),
      statLabel: t("feature_salvage_stat_label"),
      example: t("feature_salvage_example"),
    },
    theft: {
      icon: Lock,
      title: t("report_theft"),
      desc: t("feature_theft_desc"),
      seo: t("feature_theft_seo"),
      iconColor: "text-[#0088d4] dark:text-[#00a5fd]",
      bgColor: "bg-[#00a5fd]/10",
      borderColor: "border-l-[#00a5fd]",
      calloutClass: "bg-[#e6f6ff] dark:bg-sky-950/30 border border-[#b3e3fe]/70 dark:border-[#004d7a]/50",
      accentBg: "bg-[#00a5fd]",
      stat: t("feature_theft_stat_value"),
      statLabel: t("feature_theft_stat_label"),
      example: t("feature_theft_example"),
    },
  }[id];

  if (!market) {
    return { id, ...base, includes: globalIncludes(t, id) };
  }

  const includes = COUNTRY_INCLUDE_INDICES[market][id].map((i) => countryIncluded(t, market, i));
  const exampleIndex = COUNTRY_EXAMPLE_INDICES[market][id];
  const example = id === "theft"
    ? countryIncluded(t, market, exampleIndex)
    : countryIssue(t, market, exampleIndex);

  const countrySeo = t(`country_${market}_wwc_${id}_seo`);
  const seo = countrySeo !== `country_${market}_wwc_${id}_seo` ? countrySeo : base.seo;

  const countryStatLabel = t(`country_${market}_wwc_${id}_stat_label`);
  const statLabel = countryStatLabel !== `country_${market}_wwc_${id}_stat_label`
    ? countryStatLabel
    : base.statLabel;

  return { id, ...base, seo, includes, example, statLabel };
}

export function useWhatWeCheckFeatures(
  t: (k: string) => string,
  market?: WhatWeCheckMarket,
): WhatWeCheckFeature[] {
  return FEATURE_IDS.map((id) => buildFeature(t, id, market));
}

export function whatWeCheckSubtitle(
  t: (k: string) => string,
  market?: WhatWeCheckMarket,
  subtitle?: string,
) {
  if (subtitle) return subtitle;
  if (market) return t(`country_${market}_issues_sub`);
  return t("what_we_check_sub");
}
