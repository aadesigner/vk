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
  "h-12 rounded-2xl border-slate-200 bg-[#f4f8fc] px-4 text-base text-slate-950 shadow-none",
  "placeholder:text-slate-400",
  "focus-visible:border-[#00a5fd] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#00a5fd]/20",
);

export const AUTH_LABEL = "text-[12px] font-semibold tracking-tight text-slate-500";

export const AUTH_ERROR =
  "text-sm text-red-700 bg-red-50 border border-red-100 px-3.5 py-3 rounded-2xl leading-snug";

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
        "auth-light relative min-h-[100dvh] overflow-x-hidden text-slate-950",
        "-mt-[var(--site-header-offset,76px)] pt-[var(--site-header-offset,76px)]",
      )}
    >
      <div className="absolute inset-0 -z-20 bg-[#e8f3fa] dark:hidden" />
      <div className="absolute inset-0 -z-20 hidden dark:block" style={{ background: "#060a14" }} />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#00a5fd_1px,transparent_1px),linear-gradient(to_bottom,#00a5fd_1px,transparent_1px)] [background-size:64px_64px] opacity-[0.07]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#00a5fd_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.06]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_55%_at_18%_-8%,rgba(0,165,253,0.28),transparent)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(0,165,253,0.14),transparent)]" />
      <div className="absolute bottom-0 left-0 right-0 h-40 -z-10 bg-gradient-to-t from-[#e8f3fa] to-transparent dark:from-[#060a14]" />

      <div className="relative mx-auto grid min-h-[calc(100dvh-var(--site-header-offset,76px))] w-full max-w-6xl items-start lg:items-center gap-8 px-4 py-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,28rem)] lg:gap-14 lg:px-10">
        <aside className="relative hidden lg:block">
          <span
            aria-hidden
            className="pointer-events-none absolute -left-4 -top-8 select-none font-black uppercase leading-none tracking-[-0.08em] text-[#00a5fd]/[0.12]"
            style={{ fontSize: "6.4rem" }}
          >
            VIN
          </span>
          <div className="relative rounded-[2rem] border border-white/70 bg-white/65 px-8 py-9 shadow-[0_28px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm">
            {hideLogo ? null : (
              <Link href={`/${language}`} className="inline-flex w-fit">
                <VerifyKMLogo variant="light" className="h-9 w-auto" />
              </Link>
            )}
            <p className={cn("text-[11px] font-bold uppercase tracking-[0.2em] text-[#0088d4]", !hideLogo && "mt-8")}>
              {t("auth_reports_count")}
            </p>
            <h2 className="mt-3 max-w-md text-[2.65rem] font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950">
              {t("auth_headline")}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
              {t("auth_tagline")}
            </p>
            <ul className="mt-8 space-y-3">
              {POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.title} className="flex gap-3 rounded-2xl border border-[#00a5fd]/12 bg-white/80 px-4 py-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e7f6ff] text-[#0088d4]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-950">{t(point.title)}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-slate-600">{t(point.body)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <blockquote className="mt-7 border-l-2 border-[#00a5fd] pl-4 text-sm leading-relaxed text-slate-700">
              {t("auth_testimonial_text")}
            </blockquote>
          </div>
        </aside>

        <EnterReveal y={12} className={cn("mx-auto w-full max-w-[28rem]", className)}>
          <div className="rounded-[1.75rem] border border-white/80 bg-white px-5 py-7 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.42)] sm:px-8 sm:py-8">
            {hideLogo ? null : (
              <Link href={`/${language}`} className="mb-5 flex justify-center lg:hidden">
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
