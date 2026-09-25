import { useEffect, useState } from "react";
import { Search, Database, Gavel, ShieldAlert, Gauge, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { TextWithObfuscatedEmail } from "@/components/obfuscated-email-link";

const SOURCE_KEYS = [
  "auction_history",
  "accident_history",
  "mileage_verification",
  "theft_records",
] as const;

const SOURCE_ICONS = [Gavel, ShieldAlert, Gauge, Database] as const;

export function PendingVinTopNotice({
  vin,
  className,
}: {
  vin: string;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-[#00a5fd]/20 bg-[#071018] text-white shadow-[0_22px_50px_-32px_rgba(0,136,212,0.8)]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a5fd] to-[#0077c8] shadow-[0_10px_24px_-12px_rgba(0,165,253,0.9)]">
          <Search className="h-5 w-5 text-white" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold leading-snug sm:text-[15px]">
            {t("pending_report_top_notice")}{" "}
            <span className="inline-flex max-w-full align-middle">
              <span className="truncate rounded-lg border border-[#00a5fd]/30 bg-[#0c1524] px-2 py-0.5 font-mono text-[12px] font-semibold tracking-[0.12em] text-[#7dd3fc] sm:text-[13px]">
                {vin}
              </span>
            </span>{" "}
            {t("pending_report_top_notice_tail")}
          </p>
          <p className="text-sm font-semibold leading-snug text-[#7dd3fc] sm:text-[15px]">
            {t("pending_report_top_notice_verify")}
          </p>
          <p className="text-xs leading-relaxed text-white/55 sm:text-sm">
            <TextWithObfuscatedEmail
              text={t("pending_report_top_notice_sub")}
              linkClassName="font-medium text-white underline underline-offset-2 decoration-[#00a5fd]/60 hover:decoration-[#7dd3fc]"
            />
          </p>
        </div>
      </div>
    </div>
  );
}

function Radar({ paused }: { paused: boolean }) {
  return (
    <div className="relative mx-auto h-36 w-36 shrink-0" aria-hidden>
      <div className="pending-radar absolute inset-0 rounded-full border border-[#00a5fd]/30" />
      <div className="absolute inset-[18%] rounded-full border border-[#00a5fd]/20" />
      <div className="absolute inset-[36%] rounded-full border border-[#00a5fd]/15" />
      <div
        className={cn(
          "absolute inset-0 rounded-full pending-radar-sweep",
          paused && "opacity-40",
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a5fd] text-white shadow-[0_0_24px_rgba(0,165,253,0.55)]">
          <Search className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export function PendingVinSearchPanel({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPaused(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setActive((n) => (n + 1) % SOURCE_KEYS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.6rem] border border-[#00a5fd]/20 bg-[#071018] text-white shadow-[0_28px_60px_-36px_rgba(0,136,212,0.85)]",
        className,
      )}
      role="status"
    >
      <div className="grid gap-6 px-4 py-6 sm:px-6 sm:py-7 md:grid-cols-[11rem_minmax(0,1fr)] md:items-center">
        <Radar paused={paused} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7dd3fc]">
            {t("pending_report_badge")}
          </p>
          <h2 className="mt-2 text-lg font-extrabold tracking-tight sm:text-xl">
            {t("pending_search_title")}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            {t("pending_search_subtitle")}
          </p>
          <ul className="mt-4 space-y-2">
            {SOURCE_KEYS.map((key, i) => {
              const Icon = SOURCE_ICONS[i];
              const on = !paused && i === active;
              const done = !paused && i < active;
              return (
                <li
                  key={key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    on
                      ? "border-[#00a5fd]/40 bg-[#00a5fd]/15"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      on ? "bg-[#00a5fd] text-white" : "bg-white/5 text-[#7dd3fc]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", on ? "text-white" : "text-white/70")}>
                    {t(key)}
                  </span>
                  {on ? (
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a5fd] opacity-70" />
                      <span className="relative h-2 w-2 rounded-full bg-[#7dd3fc]" />
                    </span>
                  ) : done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#33bbfd]" />
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 bg-white/[0.03] px-4 py-3 sm:px-6">
        <p className="text-xs leading-relaxed text-white/55 sm:text-sm">
          {t("pending_report_desc")}
        </p>
      </div>
    </div>
  );
}
