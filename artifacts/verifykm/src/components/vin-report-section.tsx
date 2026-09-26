import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared share-card surface for VIN report sections.
 * Decorations (hairline + soft wash) live in CSS ::before/::after — no extra DOM per card.
 * Print flattens via .vin-report-section rules in index.css.
 */
export const VIN_REPORT_PAGE_FIELD = "bg-[#e8eef3] print:bg-white";
export const VIN_REPORT_PAGE_SHELL = cn(
  "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10",
  "print:px-0 print:py-0 space-y-5 sm:space-y-6 print:space-y-2 vin-report-print",
);

export const VIN_REPORT_SECTION_SURFACE = cn(
  "vin-report-section relative overflow-hidden rounded-2xl border border-[#00a5fd]/12 bg-white",
  "shadow-[0_18px_40px_-32px_rgba(7,16,24,0.38)]",
  "print:shadow-none print:border-slate-300 print:rounded-none",
);

/** @deprecated Prefer CSS on .vin-report-section — kept for timeline one-off. */
export const VIN_REPORT_SECTION_RADIAL = "hidden";

/** @deprecated Prefer CSS on .vin-report-section — kept for timeline one-off. */
export const VIN_REPORT_SECTION_HAIRLINE = "hidden";

export type VinReportSectionAccent =
  | "primary"
  | "orange"
  | "sky"
  | "purple"
  | "emerald"
  | "rose"
  | "amber"
  | "slate";

const ACCENT_ICON: Record<VinReportSectionAccent, string> = {
  primary: "text-primary",
  orange: "text-orange-500",
  sky: "text-sky-500",
  purple: "text-purple-500",
  emerald: "text-[#00a5fd]",
  rose: "text-rose-500",
  amber: "text-amber-500",
  slate: "text-slate-500",
};

const ACCENT_CHIP: Record<VinReportSectionAccent, string> = {
  primary: "bg-primary/10",
  orange: "bg-orange-500/10",
  sky: "bg-sky-500/10",
  purple: "bg-purple-500/10",
  emerald: "bg-[#00a5fd]/10",
  rose: "bg-rose-500/10",
  amber: "bg-amber-500/10",
  slate: "bg-slate-500/10",
};

export const ACCENT_HEADER_WASH: Record<VinReportSectionAccent, string> = {
  primary: "bg-primary/[0.03]",
  orange: "bg-orange-500/[0.03]",
  sky: "bg-sky-500/[0.03]",
  purple: "bg-purple-500/[0.03]",
  emerald: "bg-[#00a5fd]/[0.03]",
  rose: "bg-rose-500/[0.03]",
  amber: "bg-amber-500/[0.03]",
  slate: "bg-slate-500/[0.03]",
};

/** Drives top hairline + corner wash via --vr-accent (see index.css). */
const ACCENT_FOCUS_VAR: Record<VinReportSectionAccent, string> = {
  primary: "[--vr-accent:hsl(var(--primary))]",
  orange: "[--vr-accent:#f97316]",
  sky: "[--vr-accent:#0ea5e9]",
  purple: "[--vr-accent:#a855f7]",
  emerald: "[--vr-accent:#00a5fd]",
  rose: "[--vr-accent:#f43f5e]",
  amber: "[--vr-accent:#f59e0b]",
  slate: "[--vr-accent:#64748b]",
};

type VinReportSectionProps = {
  children: ReactNode;
  className?: string;
  /** When false, omit CSS decoration class. Default true. */
  decorated?: boolean;
  /** Matches header chip color — top focus / wash use this instead of brand green. */
  accent?: VinReportSectionAccent;
};

export function VinReportSection({
  children,
  className,
  decorated = true,
  accent = "primary",
}: VinReportSectionProps) {
  return (
    <div
      className={cn(
        VIN_REPORT_SECTION_SURFACE,
        decorated && "vin-report-section--decorated",
        ACCENT_FOCUS_VAR[accent],
        className,
      )}
    >
      {children}
    </div>
  );
}

type VinReportSectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ElementType;
  accent?: VinReportSectionAccent;
  trailing?: ReactNode;
  /** Public-style uppercase muted title vs report-style bold title. */
  variant?: "report" | "public";
  className?: string;
};

export function VinReportSectionHeader({
  title,
  subtitle,
  icon: Icon,
  accent = "primary",
  trailing,
  variant = "report",
  className,
}: VinReportSectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-5 sm:py-3.5",
        ACCENT_HEADER_WASH[accent],
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ACCENT_CHIP[accent], ACCENT_ICON[accent])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          {variant === "public" ? (
            <h2 className="truncate text-[11px] font-bold uppercase tracking-widest text-muted-foreground sm:text-xs">
              {title}
            </h2>
          ) : (
            <h2 className="truncate text-sm font-bold leading-tight text-[#071018]">{title}</h2>
          )}
          {subtitle ? (
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
