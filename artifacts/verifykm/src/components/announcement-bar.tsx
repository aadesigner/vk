import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "@/i18n/context";
import { toCanonicalRest } from "@/lib/localized-routes";
import { isSupportedLang, type Language } from "@/lib/languages";

type Announcement = {
  id: number;
  message: string;
  linkText: string | null;
  linkUrl: string | null;
  showTo: string;
  pages: string;
  endsAt: string | null;
};

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const ANNOUNCEMENT_CACHE_KEY = "verifykm_announcement_cache_v1";

/** English-canonical matchers for admin page targeting. */
const PAGE_SLUGS: Record<string, string[]> = {
  home:        ["/", ""],
  pricing:     ["/pricing"],
  checkout:    ["/checkout"],
  decoder:     ["/free-vin-decoder"],
  country:     ["/cars/"],
  auth:        ["/sign-in", "/sign-up"],
};

function matchesPage(pages: string, location: string): boolean {
  if (pages === "all") return true;
  const allowed = pages.split(",").map(s => s.trim()).filter(Boolean);
  const pathOnly = location.split("?")[0] ?? location;
  const m = pathOnly.match(/^\/([a-z]{2})(\/.*)?$/);
  const langHint = m?.[1] && isSupportedLang(m[1]) ? (m[1] as Language) : undefined;
  const rawRest = (m?.[2] ?? "").replace(/\/$/, "") || "";
  const langStripped = toCanonicalRest(rawRest, langHint) || "/";

  for (const slug of allowed) {
    const matchers = PAGE_SLUGS[slug];
    if (!matchers) continue;
    for (const matcher of matchers) {
      if (matcher.endsWith("/")) {
        if (langStripped.startsWith(matcher) || langStripped === matcher.slice(0, -1)) return true;
      } else {
        if (langStripped === matcher || langStripped.startsWith(matcher + "/")) return true;
      }
    }
  }
  return false;
}

function readAnnouncementCache(lang: string): Announcement | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ANNOUNCEMENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lang?: string; data?: Announcement | null };
    if (parsed.lang !== lang || !parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeAnnouncementCache(lang: string, data: Announcement | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!data) {
      sessionStorage.removeItem(ANNOUNCEMENT_CACHE_KEY);
      return;
    }
    sessionStorage.setItem(ANNOUNCEMENT_CACHE_KEY, JSON.stringify({ lang, data }));
  } catch {
    // ignore quota errors
  }
}

function isDismissed(id: number): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("verifykm_dismissed_announcement") === String(id);
}

export function AnnouncementBar({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const { language } = useTranslation();
  const [data, setData] = useState<Announcement | null | undefined>(() => readAnnouncementCache(language) ?? undefined);
  const [dismissed, setDismissed] = useState(() => {
    const cached = readAnnouncementCache(language);
    return cached?.id != null ? isDismissed(cached.id) : false;
  });
  const barRef = useRef<HTMLDivElement>(null);
  const { isSignedIn, isLoaded } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    const cached = readAnnouncementCache(language);
    setData(cached ?? undefined);
    setDismissed(cached?.id != null ? isDismissed(cached.id) : false);

    fetch(`${basePath}/api/announcements/active?lang=${language}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((next) => {
        setData(next);
        writeAnnouncementCache(language, next);
      })
      .catch(() => {
        setData((current) => current ?? null);
      });
  }, [language]);

  useEffect(() => {
    if (data?.id != null) {
      setDismissed(isDismissed(data.id));
    }
  }, [data?.id]);

  const audienceReady = data?.showTo === "all" || isLoaded;
  const visible =
    audienceReady &&
    data != null &&
    data !== undefined &&
    !dismissed &&
    matchesPage(data.pages, location) &&
    !(data.showTo === "guests" && isSignedIn) &&
    !(data.showTo === "users" && !isSignedIn);

  useLayoutEffect(() => {
    if (!onHeightChange) return;
    if (!visible) {
      onHeightChange(0);
      return;
    }
    const el = barRef.current;
    if (!el) return;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible, onHeightChange, data?.message]);

  if (!visible || !data) return null;

  const handleDismiss = () => {
    localStorage.setItem("verifykm_dismissed_announcement", String(data.id));
    setDismissed(true);
  };

  return (
    <div
      ref={barRef}
      className="fixed top-0 inset-x-0 z-[110] w-full text-white text-sm font-medium print:hidden"
      style={{
        background: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary)) 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 min-h-[40px]">
        <span className="text-center leading-snug">{data.message}</span>

        {data.linkUrl && (
          <a
            href={data.linkUrl}
            target={data.linkUrl.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-full text-xs font-bold"
          >
            {data.linkText || "Learn more"}
            {data.linkUrl.startsWith("http") && <ExternalLink className="h-3 w-3" />}
          </a>
        )}

        <button
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
