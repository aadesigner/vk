import { Link } from "wouter";
import { Gauge, ShieldAlert, ShieldCheck } from "lucide-react";
import { EnterReveal } from "@/components/enter-reveal";
import { VerifyKMLogo } from "@/components/logo";
import { useTranslation } from "@/i18n/context";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  hideLogo?: boolean;
};

export const AUTH_INPUT = cn(
  "h-12 rounded-xl border-slate-200 bg-white px-3.5 text-[15px] text-slate-950 shadow-none",
  "placeholder:text-slate-400",
  "focus-visible:border-[#00a5fd] focus-visible:ring-2 focus-visible:ring-[#00a5fd]/20",
);

export const AUTH_LABEL = "text-[13px] font-semibold tracking-tight text-slate-800";

export const AUTH_ERROR =
  "text-sm text-red-700 bg-red-50 border border-red-200 px-3.5 py-3 rounded-xl leading-snug";

const POINTS = [
  { icon: Gauge, title: "mileage", body: "feature_mileage_desc" },
  { icon: ShieldAlert, title: "accident_history", body: "feature_accidents_desc" },
  { icon: ShieldCheck, title: "theft_check", body: "feature_theft_desc" },
] as const;

/** Shared layout for sign-in, sign-up, forgot/reset/set password. */
export function AuthPageShell({ children, className, hideLogo = false }: Props) {
  const { language, t } = useTranslation();

  return (
    <section
      className={cn(
        "auth-light relative min-h-[100dvh] overflow-hidden bg-[#eef4f8] text-slate-950",
        "-mt-[var(--site-header-offset,76px)] pt-[var(--site-header-offset,76px)]",
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1.5 bg-[#00a5fd] lg:block" />
      <div className="pointer-events-none absolute -right-24 top-24 hidden h-72 w-72 rounded-full bg-[#00a5fd]/10 blur-3xl lg:block" />

      <div className="mx-auto grid min-h-[calc(100dvh-var(--site-header-offset,76px))] w-full max-w-6xl items-center gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,28rem)] lg:gap-16 lg:px-10 lg:py-12">
        <aside className="hidden lg:block">
          {hideLogo ? null : (
            <Link href={`/${language}`} className="inline-flex w-fit">
              <VerifyKMLogo variant="light" className="h-9 w-auto" />
            </Link>
          )}
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0088d4]", !hideLogo && "mt-10")}>
            {t("auth_reports_count")}
          </p>
          <h2 className="mt-3 max-w-md text-[2.7rem] font-bold leading-[1.05] tracking-tight text-slate-950">
            {t("auth_headline")}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
            {t("auth_tagline")}
          </p>
          <ul className="mt-8 max-w-md space-y-3">
            {POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title} className="flex gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e7f6ff] text-[#0088d4]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">{t(point.title)}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-slate-600">{t(point.body)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <blockquote className="mt-8 max-w-md border-l-2 border-[#00a5fd] pl-4 text-sm leading-relaxed text-slate-700">
            {t("auth_testimonial_text")}
          </blockquote>
        </aside>

        <EnterReveal y={12} className={cn("mx-auto w-full max-w-[28rem]", className)}>
          <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-7 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.45)] sm:px-8 sm:py-8">
            {hideLogo ? null : (
              <Link href={`/${language}`} className="mb-6 inline-flex w-fit lg:hidden">
                <VerifyKMLogo variant="light" className="h-8 w-auto" />
              </Link>
            )}
            {children}
          </div>
        </EnterReveal>
      </div>
    </section>
  );
}
