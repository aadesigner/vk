/** Visual-only admin “daily revenue mood” — does not affect payments or APIs. */

export type AdminRevenueMoodId =
  | "eco"
  | "cruise"
  | "charge"
  | "heat"
  | "blaze"
  | "supercar";

export type AdminRevenueMood = {
  id: AdminRevenueMoodId;
  title: string;
  subtitle: string;
  /** HSL channels without hsl() — matches app CSS vars */
  primary: string;
  primaryForeground: string;
  /** Optional sport font stack — only higher tiers set this */
  fontSans?: string;
  fontDisplay?: string;
  tracking?: string;
  googleFonts?: string[];
  /** 0 = calm, 1 = wild (drives animation intensity) */
  intensity: number;
};

/**
 * Thresholds in EUR (today's revenue).
 * <100 eco · 100–180 cruise · 180–240 charge · 240–280 heat · 280–350 blaze · 350+ supercar
 */
export function resolveAdminRevenueMood(revenueTodayEur: number): AdminRevenueMood {
  const n = Number.isFinite(revenueTodayEur) ? Math.max(0, revenueTodayEur) : 0;

  if (n < 100) {
    return {
      id: "eco",
      title: "Warm-up",
      subtitle: "Easy pace",
      primary: "152 28% 42%",
      primaryForeground: "0 0% 100%",
      intensity: 0.12,
    };
  }
  if (n < 180) {
    return {
      id: "cruise",
      title: "In gear",
      subtitle: "Steady flow",
      primary: "142 62% 36%",
      primaryForeground: "0 0% 100%",
      intensity: 0.32,
    };
  }
  if (n < 240) {
    return {
      id: "charge",
      title: "Building",
      subtitle: "Torque up",
      primary: "142 72% 28%",
      primaryForeground: "0 0% 100%",
      intensity: 0.5,
    };
  }
  if (n < 280) {
    return {
      id: "heat",
      title: "On pace",
      subtitle: "Push window",
      primary: "22 90% 48%",
      primaryForeground: "0 0% 100%",
      fontSans: '"Rajdhani", system-ui, sans-serif',
      fontDisplay: '"Rajdhani", system-ui, sans-serif',
      tracking: "0.02em",
      googleFonts: ["Rajdhani:wght@500;600;700"],
      intensity: 0.68,
    };
  }
  if (n < 350) {
    return {
      id: "blaze",
      title: "Hot lap",
      subtitle: "Open road",
      primary: "6 78% 46%",
      primaryForeground: "0 0% 100%",
      fontSans: '"Rajdhani", system-ui, sans-serif',
      fontDisplay: '"Rajdhani", system-ui, sans-serif',
      tracking: "0.04em",
      googleFonts: ["Rajdhani:wght@500;600;700"],
      intensity: 0.84,
    };
  }
  return {
    id: "supercar",
    title: "Full send",
    subtitle: "Pole day",
    primary: "0 72% 38%",
    primaryForeground: "0 0% 100%",
    fontSans: '"Rajdhani", system-ui, sans-serif',
    fontDisplay: '"Rajdhani", system-ui, sans-serif',
    tracking: "0.06em",
    googleFonts: ["Rajdhani:wght@600;700"],
    intensity: 1,
  };
}

/**
 * Map today's EUR revenue to a cluster "speed" (0–340).
 * €350 ≈ 300 — above that still climbs a little into redline.
 */
export function revenueToClusterSpeed(revenueTodayEur: number): number {
  const n = Number.isFinite(revenueTodayEur) ? Math.max(0, revenueTodayEur) : 0;
  if (n <= 0) return 0;
  if (n >= 350) return Math.min(340, Math.round(300 + ((n - 350) / 150) * 40));
  return Math.round((n / 350) * 300);
}

/**
 * Needle angle in degrees for a −135°…+135° (270°) sweep. 0 revenue → left; redline → right.
 */
export function moodNeedleAngle(intensity: number): number {
  const t = Math.min(1, Math.max(0, intensity));
  return -135 + t * 270;
}

const MOOD_FONT_LINK_ID = "verifykm-admin-revenue-mood-fonts";

export function ensureAdminRevenueMoodFonts(mood: AdminRevenueMood): void {
  if (typeof document === "undefined") return;
  const families = mood.googleFonts ?? [];
  const existing = document.getElementById(MOOD_FONT_LINK_ID) as HTMLLinkElement | null;

  if (families.length === 0) {
    existing?.remove();
    return;
  }

  const href =
    `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;

  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }

  if (!document.getElementById(`${MOOD_FONT_LINK_ID}-pc1`)) {
    const pc1 = document.createElement("link");
    pc1.rel = "preconnect";
    pc1.href = "https://fonts.googleapis.com";
    pc1.id = `${MOOD_FONT_LINK_ID}-pc1`;
    document.head.appendChild(pc1);
  }
  if (!document.getElementById(`${MOOD_FONT_LINK_ID}-pc2`)) {
    const pc2 = document.createElement("link");
    pc2.rel = "preconnect";
    pc2.href = "https://fonts.gstatic.com";
    pc2.crossOrigin = "anonymous";
    pc2.id = `${MOOD_FONT_LINK_ID}-pc2`;
    document.head.appendChild(pc2);
  }

  const link = document.createElement("link");
  link.id = MOOD_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const INLINE_PROPS = [
  "--primary",
  "--primary-foreground",
  "--accent",
  "--accent-foreground",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
  "--chart-1",
  "--admin-font-sans",
  "--admin-font-display",
  "--admin-tracking",
] as const;

function clearInlineThemeProps(el: HTMLElement | null | undefined) {
  if (!el) return;
  for (const prop of INLINE_PROPS) el.style.removeProperty(prop);
  el.style.removeProperty("--admin-mood-intensity");
  el.removeAttribute("data-admin-revenue-mood");
}

/** Strip leaked admin/mood tokens from <html> so public pages never inherit them. */
export function clearLeakedAdminDocumentStyles(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("admin-theme-active");
  root.removeAttribute("data-admin-theme");
  clearInlineThemeProps(root);
}

/** Apply mood accents on `.admin-shell` only (never <html>). Visual only. */
export function applyAdminRevenueMoodStyles(mood: AdminRevenueMood | null): () => void {
  if (typeof document === "undefined") return () => undefined;

  // Scrub any older html-level leftovers immediately.
  clearInlineThemeProps(document.documentElement);

  const shell = document.querySelector(".admin-shell") as HTMLElement | null;

  if (!mood || !shell) {
    clearInlineThemeProps(shell);
    return () => {
      clearInlineThemeProps(shell);
      clearInlineThemeProps(document.documentElement);
    };
  }

  ensureAdminRevenueMoodFonts(mood);
  shell.setAttribute("data-admin-revenue-mood", mood.id);
  shell.style.setProperty("--admin-mood-intensity", String(mood.intensity));

  // Low tiers (Warm-up → Building): keep theme colors — don't wash the shell in mood green.
  // Hot tiers still tint accents for the sport vibe.
  const tintShell = mood.intensity >= 0.68;
  if (tintShell) {
    shell.style.setProperty("--primary", mood.primary);
    shell.style.setProperty("--primary-foreground", mood.primaryForeground);
    shell.style.setProperty("--accent", mood.primary);
    shell.style.setProperty("--accent-foreground", mood.primaryForeground);
    shell.style.setProperty("--ring", mood.primary);
    shell.style.setProperty("--sidebar-primary", mood.primary);
    shell.style.setProperty("--sidebar-primary-foreground", mood.primaryForeground);
    shell.style.setProperty("--sidebar-ring", mood.primary);
    shell.style.setProperty("--chart-1", mood.primary);
  } else {
    for (const prop of [
      "--primary",
      "--primary-foreground",
      "--accent",
      "--accent-foreground",
      "--ring",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-ring",
      "--chart-1",
    ] as const) {
      shell.style.removeProperty(prop);
    }
  }

  if (mood.fontSans) {
    shell.style.setProperty("--admin-font-sans", mood.fontSans);
  } else {
    shell.style.removeProperty("--admin-font-sans");
  }
  if (mood.fontDisplay) {
    shell.style.setProperty("--admin-font-display", mood.fontDisplay);
  } else {
    shell.style.removeProperty("--admin-font-display");
  }
  if (mood.tracking) {
    shell.style.setProperty("--admin-tracking", mood.tracking);
  } else {
    shell.style.removeProperty("--admin-tracking");
  }

  return () => {
    clearInlineThemeProps(shell);
    clearInlineThemeProps(document.documentElement);
  };
}
