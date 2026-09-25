export type HomeStatItem = {
  id: string;
  value: string;
  label: string;
  nameKey:
    | "country_usa_name"
    | "country_korea_name"
    | "country_canada_name"
    | "country_china_name"
    | "country_japan_name"
    | "country_uae_name";
  flag: "us" | "kr" | "ca" | "cn" | "jp" | "ae";
};

export function useHomeStats(t: (k: string) => string): HomeStatItem[] {
  return [
    { id: "usa", value: "280M+", label: t("home_stat_usa"), nameKey: "country_usa_name", flag: "us" },
    { id: "korea", value: "25M+", label: t("home_stat_korea"), nameKey: "country_korea_name", flag: "kr" },
    { id: "canada", value: "30M+", label: t("home_stat_canada"), nameKey: "country_canada_name", flag: "ca" },
    { id: "china", value: "350M+", label: t("home_stat_china"), nameKey: "country_china_name", flag: "cn" },
    { id: "japan", value: "78M+", label: t("home_stat_japan"), nameKey: "country_japan_name", flag: "jp" },
    { id: "uae", value: "3M+", label: t("home_stat_uae"), nameKey: "country_uae_name", flag: "ae" },
  ];
}
