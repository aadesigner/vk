import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Original lockup (black canvas) — not modified. */
const LOGO_ORIGINAL = `${basePath}/brand/logo.png`;
/** Display file: same art, black keyed to transparent. */
const LOGO_SRC = `${basePath}/brand/logo-clear.png`;

export const BRAND_ASSETS = {
  logo: LOGO_SRC,
  logoWhite: LOGO_SRC,
  logoDark: LOGO_SRC,
  logoOriginal: LOGO_ORIGINAL,
  favicon: `${basePath}/favicon.png`,
} as const;

const prefetchedBrand = new Set<string>();

/** Warm navbar wordmarks so the mobile sidebar logo does not flash on open. */
export function prefetchBrandAssets(): void {
  if (typeof window === "undefined") return;
  if (prefetchedBrand.has(LOGO_SRC)) return;
  prefetchedBrand.add(LOGO_SRC);
  const img = new Image();
  img.decoding = "async";
  img.src = LOGO_SRC;
}

export type VerifyKMLogoVariant = "light" | "dark";

/** Full horizontal verifykm.com lockup. */
export function VerifyKMLogo({
  variant: _variant,
  className,
  syncDecode = false,
}: {
  variant?: VerifyKMLogoVariant;
  className?: string;
  syncDecode?: boolean;
}) {
  return (
    <img
      src={LOGO_SRC}
      alt="verifykm.com"
      width={1024}
      height={341}
      fetchPriority="high"
      className={cn("block bg-transparent", className)}
      decoding={syncDecode ? "sync" : "async"}
    />
  );
}

/** Compact shield symbol (favicon asset). */
export function VerifyKMMark({ className }: { className?: string }) {
  return (
    <img
      src={BRAND_ASSETS.favicon}
      alt=""
      width={24}
      height={24}
      className={cn("object-contain", className)}
      aria-hidden="true"
      decoding="async"
    />
  );
}

/** Same lockup for print/PDF. */
export function VerifyKMPrintLogo({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="verifykm.com"
      width={1024}
      height={341}
      className={cn("block bg-transparent", className)}
      decoding="async"
    />
  );
}
