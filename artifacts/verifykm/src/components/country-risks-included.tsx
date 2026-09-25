import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

type Severity = "high" | "medium" | "low";

const SEV: Record<Severity, { labelKey: string; bar: string; text: string; wash: string }> = {
  high: {
    labelKey: "severity_high",
    bar: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    wash: "bg-red-500/[0.08]",
  },
  medium: {
    labelKey: "severity_medium",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    wash: "bg-amber-500/[0.08]",
  },
  low: {
    labelKey: "severity_low",
    bar: "bg-yellow-500",
    text: "text-yellow-600 dark:text-yellow-400",
    wash: "bg-yellow-500/[0.08]",
  },
};

function splitIssue(text: string): { title: string; detail?: string } {
  const parts = text.split(" — ");
  if (parts.length >= 2) {
    return { title: parts[0].trim(), detail: parts.slice(1).join(" — ").trim() };
  }
  return { title: text };
}

type Props = {
  slug: "usa" | "korea" | "canada" | "china" | "japan" | "uae";
  issues: string[];
  included: string[];
  severities: Severity[];
};

function PanelHeader({
  title,
  subtitle,
  eyebrow,
  accent,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 sm:px-5 py-3 border-b border-border/60 min-h-[5.25rem] flex flex-col justify-center",
        accent ? "bg-[#00a5fd]/[0.05]" : "bg-muted/25 dark:bg-white/[0.02]",
      )}
    >
      <p
        className={cn(
          "font-mono text-[9px] font-bold uppercase tracking-[0.22em]",
          accent ? "text-[#0088d4] dark:text-[#33bbfd]" : "text-muted-foreground/75",
        )}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 text-base sm:text-lg font-bold tracking-tight leading-tight">{title}</h2>
      <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground leading-snug line-clamp-2">
        {subtitle}
      </p>
    </div>
  );
}

export function CountryRisksIncludedSection({ slug, issues, included, severities }: Props) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden border-y border-border/60 bg-muted/15 dark:bg-white/[0.015] py-10 md:py-12 px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px)] [background-size:96px_100%] opacity-50"
      />
      <div className="relative max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-stretch">
        {/* Risks */}
        <div className="relative h-full rounded-lg border border-border/70 bg-background shadow-[0_1px_0_hsl(var(--border)/0.4)] overflow-hidden flex flex-col">
          <PanelHeader
            eyebrow={t("country_risks_eyebrow")}
            title={t("country_common_issues")}
            subtitle={t(`country_${slug}_issues_sub`)}
          />

          <ul className="flex-1 flex flex-col min-h-0">
            {issues.map((issue, i) => {
              const sev = severities[i] ?? "medium";
              const cfg = SEV[sev];
              const { title, detail } = splitIssue(issue);
              const isLast = i === issues.length - 1;

              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className={cn(
                    "relative flex-1 flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[4.25rem]",
                    !isLast && "border-b border-border/55",
                  )}
                >
                  <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", cfg.bar)} />
                  <div
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ring-1 ring-inset",
                      cfg.wash,
                      sev === "high"
                        ? "ring-red-500/20"
                        : sev === "medium"
                          ? "ring-amber-500/20"
                          : "ring-yellow-500/20",
                    )}
                  >
                    <span className={cn("font-mono text-[11px] font-bold tabular-nums", cfg.text)}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{title}</p>
                      <span className={cn("shrink-0 text-[9px] font-semibold uppercase tracking-wider pt-0.5", cfg.text)}>
                        {t(cfg.labelKey)}
                      </span>
                    </div>
                    {detail ? (
                      <p className="mt-0.5 text-xs text-muted-foreground leading-snug line-clamp-1 sm:line-clamp-2">
                        {detail}
                      </p>
                    ) : null}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* Included */}
        <div className="relative h-full rounded-lg border border-[#00a5fd]/30 bg-background shadow-[0_1px_0_hsl(var(--border)/0.4)] overflow-hidden flex flex-col">
          <span aria-hidden className="absolute inset-y-0 left-0 z-10 w-1 bg-[#00a5fd]" />
          <PanelHeader
            eyebrow={t("country_included_eyebrow")}
            title={t("country_whats_included")}
            subtitle={t(`country_${slug}_included_sub`)}
            accent
          />

          <ol className="flex-1 flex flex-col min-h-0">
            {included.map((item, i) => {
              const isLast = i === included.length - 1;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.2, delay: 0.03 + i * 0.03 }}
                  className={cn(
                    "flex-1 flex items-center gap-2.5 pl-5 pr-4 sm:pl-6 sm:pr-5 py-2 min-h-0",
                    !isLast && "border-b border-dashed border-border/45",
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#00a5fd]/12 ring-1 ring-inset ring-[#00a5fd]/30">
                    <Check className="h-2.5 w-2.5 text-[#0088d4] dark:text-[#33bbfd]" />
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[13px] sm:text-sm leading-snug text-foreground/90">{item}</span>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
