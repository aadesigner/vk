import type { PrintSummaryHighlight } from "@/components/vin-print-summary";
import { formatAccidentDescription, formatAccidentType, localizeAccidentDate, ACCIDENT_SEVERITY_I18N_KEYS } from "@/lib/accident-display";
import { translateInsuranceClaimType, formatInsuranceAmount } from "@/lib/insurance-claims";
import { localizeProviderDate } from "@/lib/korean-provider-text";
import { localizeRegistrySubtitle, translateRegistryEventType } from "@/lib/registry-history";
import { translateDamageLabel } from "@/lib/translate-damage-label";
import { translateTitleStatus } from "@/lib/translate-title-status";
import { translateLotStatus } from "@/lib/translate-lot-status";
import { cleanDisplayStr } from "@/lib/report-display";
import { formatCountryName, formatLocationLabel, type CountryLabelOverrides } from "@/lib/format-country-name";
import type { Language } from "@/i18n/context";

const PRINT_ACCIDENT_LIMIT = 10;
const PRINT_INSURANCE_LIMIT = 10;
const PRINT_MILEAGE_LIMIT = 12;
const PRINT_OWNER_LIMIT = 10;
const PRINT_REGISTRY_LIMIT = 8;
const PRINT_AUCTION_LIMIT = 6;
/** Print/PDF gallery grid: 4 columns × 3 rows max (hero photo is separate). */
export const PRINT_GALLERY_COLUMNS = 4;
export const PRINT_GALLERY_MAX_ROWS = 3;
export const PRINT_GALLERY_PHOTO_LIMIT = PRINT_GALLERY_COLUMNS * PRINT_GALLERY_MAX_ROWS;
/** Hero + gallery — used when prefetching print images. */
export const PRINT_PHOTO_LIMIT = 1 + PRINT_GALLERY_PHOTO_LIMIT;

export type PrintMileageRow = {
  date: string | null;
  odometer: string;
  detail: string | null;
};

export type PrintOwnerRow = {
  date: string | null;
  location: string | null;
  mileage: string | null;
};

export type PrintRegistryRow = {
  date: string | null;
  title: string;
  detail: string | null;
};

export type PrintAuctionRow = {
  date: string | null;
  title: string;
  detail: string | null;
};

type AuctionLike = {
  date?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  condition?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  damage?: string | null;
  titleStatus?: string | null;
  lotStatus?: string | null;
  openingBid?: number | null;
  buyNowPrice?: number | null;
  finalPrice?: number | null;
};

type AccidentLike = {
  date?: string | null;
  severity?: string | null;
  description?: string | null;
  primaryDamage?: string | null;
  secondaryDamage?: string | null;
  type?: string | null;
  country?: string | null;
  location?: string | null;
  lossAmount?: number | null;
  currency?: string | null;
};

type ClaimLike = {
  date?: string | null;
  type?: string | null;
  lossAmount?: number | null;
  currency?: string | null;
};

type MileageLike = {
  date?: string | null;
  odometer?: number | null;
  primaryDamage?: string | null;
  damage?: string | null;
  titleStatus?: string | null;
  lotStatus?: string | null;
  location?: string | null;
  description?: string | null;
};

type OwnerLike = {
  date?: string | null;
  location?: string | null;
  mileage?: number | null;
};

type RegistryLike = {
  date?: string | null;
  type?: string | null;
  title?: string | null;
  subtitle?: string | null;
  mileage?: number | null;
};

const SEVERITY_KEYS = ACCIDENT_SEVERITY_I18N_KEYS;

function trSeverity(t: (key: string) => string, severity?: string | null): string | null {
  if (!severity) return null;
  const key = SEVERITY_KEYS[severity.toLowerCase().trim()];
  if (key) {
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return severity.replace(/_/g, " ");
}

export function buildAccidentPrintHighlights(
  accidents: AccidentLike[],
  t: (key: string) => string,
  language: Language,
  country?: string | null,
  krwPerUsd?: number | null,
  vehicleYear?: number | null,
  hasKoreanInsuranceClaims = false,
  countryLabels?: CountryLabelOverrides,
): PrintSummaryHighlight[] {
  return accidents.slice(0, PRINT_ACCIDENT_LIMIT).map((acc) => {
    const damage = translateDamageLabel(t, acc.primaryDamage)
      ?? translateDamageLabel(t, acc.secondaryDamage)
      ?? formatAccidentDescription(t, language, acc.description)
      ?? acc.description;
    const severity = trSeverity(t, acc.severity);
    const typeLabel = formatAccidentType(t, acc.type);
    const parts = [severity, typeLabel, damage].filter(Boolean);
    if (acc.location) {
      parts.push(formatLocationLabel(acc.location, language, countryLabels));
    } else if (acc.country) {
      parts.push(formatCountryName(acc.country, language, countryLabels));
    }
    if (acc.lossAmount != null) {
      parts.push(formatInsuranceAmount(acc.lossAmount, country ?? acc.country, krwPerUsd, {
        currency: acc.currency,
        accidentType: acc.type,
        accidentCountry: acc.country,
        hasKoreanInsuranceClaims,
      }));
    }
    return {
      date: acc.date ? localizeAccidentDate(acc.date, language, vehicleYear, country) : null,
      label: parts.join(" · ") || t("vin_public_accidents_section"),
    };
  });
}

export function buildInsurancePrintHighlights(
  claims: ClaimLike[],
  t: (key: string) => string,
  language: Language,
  country?: string | null,
  krwPerUsd?: number | null,
  vehicleYear?: number | null,
): PrintSummaryHighlight[] {
  return claims.slice(0, PRINT_INSURANCE_LIMIT).map((claim) => {
    const typeLabel = translateInsuranceClaimType(t, claim.type) ?? t("report_insurance_claims");
    const amount = claim.lossAmount != null
      ? ` · ${formatInsuranceAmount(claim.lossAmount, country, krwPerUsd, {
        currency: claim.currency,
        hasKoreanInsuranceClaims: claims.length > 0,
      })}`
      : "";
    return {
      date: claim.date ? localizeProviderDate(claim.date, language, vehicleYear, country) : null,
      label: `${typeLabel}${amount}`,
    };
  });
}

export function buildMileagePrintRows(
  entries: MileageLike[],
  t: (key: string) => string,
  language: Language,
  vehicleYear?: number | null,
  vehicleCountry?: string | null,
  countryLabels?: CountryLabelOverrides,
): PrintMileageRow[] {
  return entries.slice(0, PRINT_MILEAGE_LIMIT).map((entry) => {
    const damage = translateDamageLabel(t, entry.primaryDamage)
      ?? translateDamageLabel(t, entry.damage);
    const location = entry.location
      ? formatLocationLabel(entry.location, language, countryLabels)
      : null;
    const detail = [damage, entry.titleStatus, entry.lotStatus, location, entry.description]
      .filter(Boolean)
      .join(" · ") || null;
    return {
      date: entry.date ? localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry) : null,
      odometer: entry.odometer != null ? `${entry.odometer.toLocaleString()} km` : "—",
      detail,
    };
  });
}

export function buildOwnerPrintRows(
  entries: OwnerLike[],
  language: Language,
  vehicleYear?: number | null,
  countryLabels?: CountryLabelOverrides,
  vehicleCountry?: string | null,
): PrintOwnerRow[] {
  return entries.slice(0, PRINT_OWNER_LIMIT).map((entry) => ({
    date: entry.date ? localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry) : null,
    location: entry.location
      ? formatLocationLabel(entry.location, language, countryLabels)
      : null,
    mileage: entry.mileage != null ? `${entry.mileage.toLocaleString()} km` : null,
  }));
}

export function buildRegistryPrintRows(
  entries: RegistryLike[],
  t: (key: string) => string,
  language: Language,
  country?: string | null,
  krwPerUsd?: number | null,
  vehicleYear?: number | null,
): PrintRegistryRow[] {
  return entries.slice(0, PRINT_REGISTRY_LIMIT).map((entry) => {
    const title = translateRegistryEventType(t, entry.type, entry.title, language)
      ?? entry.title
      ?? t("report_registry_history");
    const detailParts = [
      localizeRegistrySubtitle(t, language, entry.subtitle, country, krwPerUsd),
      entry.mileage != null ? `${entry.mileage.toLocaleString()} km` : null,
    ].filter(Boolean);
    return {
      date: entry.date ? localizeProviderDate(entry.date, language, vehicleYear, country) : null,
      title,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    };
  });
}

export function buildAuctionPrintRows(
  entries: AuctionLike[],
  t: (key: string) => string,
  language: Language,
  vehicleYear?: number | null,
  countryLabels?: CountryLabelOverrides,
  vehicleCountry?: string | null,
): PrintAuctionRow[] {
  return entries.slice(0, PRINT_AUCTION_LIMIT).map((entry, index) => {
    const locationRaw = [entry.city, entry.state, entry.country].filter(Boolean).join(", ") || null;
    const location = locationRaw
      ? formatLocationLabel(locationRaw, language, countryLabels)
      : null;
    const damage = translateDamageLabel(t, cleanDisplayStr(entry.primaryDamage))
      ?? translateDamageLabel(t, cleanDisplayStr(entry.secondaryDamage))
      ?? translateDamageLabel(t, cleanDisplayStr(entry.damage));
    const status = translateLotStatus(t, cleanDisplayStr(entry.lotStatus));
    const titleStatus = translateTitleStatus(t, cleanDisplayStr(entry.titleStatus));
    const price = entry.finalPrice ?? entry.buyNowPrice ?? entry.openingBid;
    const priceLabel = price != null ? `$${price.toLocaleString()}` : null;
    const detailParts = [location, damage, status, titleStatus, priceLabel].filter(Boolean);
    return {
      date: entry.date ? localizeProviderDate(entry.date, language, vehicleYear, vehicleCountry) : null,
      title: `${t("auction_record_n")} #${index + 1}`,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    };
  });
}
