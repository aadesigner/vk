import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Original lockup (black canvas) — not modified. */
const LOGO_ORIGINAL = `${basePath}/brand/logo.png`;
/** Full-res display file: same art, black keyed to transparent. */
const LOGO_FULL = `${basePath}/brand/logo-clear.png`;
/** Navbar/footer wordmark — generated from logo-clear (do not edit by hand). */
const LOGO_NAV = `${basePath}/brand/logo-nav.png`;
const LOGO_NAV_WEBP = `${basePath}/brand/logo-nav.webp`;

export const BRAND_ASSETS = {
  logo: LOGO_NAV_WEBP,
  logoPng: LOGO_NAV,
  logoWhite: LOGO_NAV_WEBP,
  logoDark: LOGO_NAV_WEBP,
  logoFull: LOGO_FULL,
  logoOriginal: LOGO_ORIGINAL,
  favicon: `${basePath}/favicon.png`,
} as const;

const prefetchedBrand = new Set<string>();

/** Warm navbar wordmarks so the mobile sidebar logo does not flash on open. */
export function prefetchBrandAssets(): void {
  if (typeof window === "undefined") return;
  if (prefetchedBrand.has(LOGO_NAV_WEBP)) return;
  prefetchedBrand.add(LOGO_NAV_WEBP);
  const img = new Image();
  img.decoding = "async";
  img.src = LOGO_NAV_WEBP;
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
    <picture>
      <source type="image/webp" srcSet={LOGO_NAV_WEBP} />
      <img
        src={LOGO_NAV}
        alt="verifykm.com"
        width={640}
        height={213}
        fetchPriority="high"
        className={cn("block bg-transparent", className)}
        decoding={syncDecode ? "sync" : "async"}
      />
    </picture>
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
      src={LOGO_FULL}
      alt="verifykm.com"
      width={1024}
      height={341}
      className={cn("block bg-transparent", className)}
      decoding="async"
    />
  );
}
