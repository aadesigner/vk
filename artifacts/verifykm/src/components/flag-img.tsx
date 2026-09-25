import { cn } from "@/lib/utils";

const FLAG_ICONS_VERSION = "7.5.0";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const prefetched = new Set<string>();

/**
 * Flags we ship under public/flags/4x3/ (see scripts/fetch-flag-icons.mjs).
 * Unknown codes fall back to jsDelivr so admin/geo never breaks.
 */
const LOCAL_FLAG_CODES = new Set([
  "gb", "de", "es", "fr", "al", "pl", "ro", "bg", "ge", "sa", "ua", "ru", "cn",
  "us", "kr", "ca", "jp", "ae", "xk",
  "it", "nl", "au", "mx", "se", "no", "dk", "fi",
  "mk", "me", "by", "kz", "kg", "tw", "hk", "mo", "sg",
  "at", "ch", "li", "be", "lu", "mc",
  "ar", "co", "pe", "cl", "ve", "ec", "gt", "bo", "do", "hn", "py", "sv", "ni", "cr", "pa", "uy",
  "tr", "rs", "ba",
  "eg", "iq", "jo", "lb", "kw", "qa", "bh", "om", "ma", "dz", "tn", "ly", "ye", "ps", "il", "sy",
  "sd", "mr", "dj", "so", "km",
]);

export type FlagVariant = "default" | "nav" | "list";

/** Display size (px) — width; height = width × 3/4 (standard 4:3 flag) */
const FLAG_WIDTH: Record<FlagVariant, number> = {
  nav: 14,
  list: 16,
  default: 18,
};

function normalizeFlagCode(code: string): string {
  return code.trim().toLowerCase();
}

/**
 * Prefer same-origin SVGs (instant on mobile sidebar remounts).
 * lipis/flag-icons 4:3 — @see https://github.com/lipis/flag-icons
 */
export function flagUrl(code: string): string {
  const normalized = normalizeFlagCode(code);
  if (LOCAL_FLAG_CODES.has(normalized)) {
    return `${basePath}/flags/4x3/${normalized}.svg`;
  }
  return `https://cdn.jsdelivr.net/npm/flag-icons@${FLAG_ICONS_VERSION}/flags/4x3/${normalized}.svg`;
}

export function prefetchFlags(codes: string[]): void {
  if (typeof window === "undefined") return;
  for (const code of codes) {
    const normalized = normalizeFlagCode(code);
    if (prefetched.has(normalized)) continue;
    prefetched.add(normalized);
    const img = new Image();
    img.src = flagUrl(normalized);
  }
}

export function FlagImg({
  code,
  size,
  variant = "default",
  className,
  priority = false,
  alt,
}: {
  code: string;
  /** Width in px (height follows 4:3). */
  size?: number;
  variant?: FlagVariant;
  className?: string;
  priority?: boolean;
  /** Localized alt text (required on indexable pages for SEO). */
  alt?: string;
}) {
  const width = size ?? FLAG_WIDTH[variant];
  const height = Math.round((width * 3) / 4);
  const resolvedAlt = alt?.trim() ?? "";

  return (
    <img
      src={flagUrl(code)}
      width={width}
      height={height}
      alt={resolvedAlt}
      aria-hidden={resolvedAlt ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
      className={cn(
        "shrink-0 rounded-[2px] object-contain",
        "shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]",
        className,
      )}
    />
  );
}
