import { flagUrl, prefetchFlags } from "@/components/flag-img";
import { BRAND_ASSETS, prefetchBrandAssets } from "@/components/logo";
import { LANG_PICKER_OPTIONS } from "@/lib/languages";

/** Country + language flags shown in the mobile navbar and its sidebar. */
export const NAV_MENU_FLAG_CODES = [
  ...new Set([
    ...LANG_PICKER_OPTIONS.map((l) => l.flag),
    "us",
    "kr",
    "ca",
    "cn",
    "jp",
    "ae",
  ]),
] as const;

/** Warm HTTP cache for navbar icons (flags + wordmarks). */
export function prefetchNavMenuAssets(): void {
  prefetchFlags([...NAV_MENU_FLAG_CODES]);
  prefetchBrandAssets();
}

/** Hidden <img> URLs decoded once and kept ready for sidebar remounts. */
export const NAV_MENU_WARMUP_SOURCES = [
  BRAND_ASSETS.logo,
  ...NAV_MENU_FLAG_CODES.map((code) => flagUrl(code)),
] as const;
