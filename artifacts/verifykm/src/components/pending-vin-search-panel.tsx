import { Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";
import { TextWithObfuscatedEmail } from "@/components/obfuscated-email-link";

const CHECKS = [
  "auction_history",
  "accident_history",
  "mileage_verification",
  "theft_records",
] as const;

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
        "rounded-2xl border border-[#00a5fd]/20 bg-[#071018] px-4 py-4 text-white sm:px-5",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold leading-snug sm:text-[15px]">
        {t("pending_report_top_notice")}{" "}
        <span className="inline-flex max-w-full align-middle">
          <span className="truncate rounded-md border border-[#00a5fd]/30 bg-[#0c1524] px-2 py-0.5 font-mono text-[12px] font-semibold tracking-wide text-[#7dd3fc] sm:text-[13px]">
            {vin}
          </span>
        </span>{" "}
        {t("pending_report_top_notice_tail")}
      </p>
      <p className="mt-1.5 text-sm font-medium text-[#7dd3fc]">
        {t("pending_report_top_notice_verify")}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-white/55 sm:text-sm">
        <TextWithObfuscatedEmail
          text={t("pending_report_top_notice_sub")}
          linkClassName="font-medium text-white underline underline-offset-2 decoration-[#00a5fd]/60 hover:decoration-[#7dd3fc]"
        />
      </p>
    </div>
  );
}

export function PendingVinSearchPanel({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#00a5fd]/20 bg-[#071018] text-white",
        className,
      )}
      role="status"
    >
      <div className="px-4 py-5 sm:px-5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7dd3fc]">
          <Clock className="h-3.5 w-3.5" />
          {t("pending_report_badge")}
        </p>
        <h2 className="mt-2 text-lg font-bold tracking-tight sm:text-xl">
          {t("pending_report_eta_title")}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/60">
          {t("pending_report_eta_body")}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {CHECKS.map((key) => (
            <li
              key={key}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/80"
            >
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-start gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3fc]" />
        <p className="text-xs leading-relaxed text-white/55 sm:text-sm">
          {t("pending_report_desc")}
        </p>
      </div>
    </div>
  );
}
