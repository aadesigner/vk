import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { sortHistoryNewestFirst } from "@/lib/history-sort";
import { sliceForHistoryPreview } from "@/lib/history-section-limit";
import { HistoryShowAllButton } from "@/components/history-show-all-button";
import { KoreanWonAmount } from "@/components/korean-won-amount";
import { formatAmountPlain, resolveAmountDisplayCurrency } from "@/lib/korean-currency";
import {
  type InsuranceClaimEntry,
  translateInsuranceClaimType,
  translateInsuranceClaimDescription,
  formatInsuranceClaimsCount,
  localizeInsuranceClaimDate,
} from "@/lib/insurance-claims";
import type { Language } from "@/i18n/context";
import { VinReportSection, VinReportSectionHeader } from "@/components/vin-report-section";
import { ReportReveal } from "@/components/report-reveal";

type Props = {
  claims: InsuranceClaimEntry[];
  country?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  t: (key: string) => string;
  language: Language;
  variant?: "report" | "public";
  className?: string;
  delay?: number;
};

function ClaimAmount({
  amount,
  currencyCode,
  krwPerUsd,
}: {
  amount: number;
  currencyCode: ReturnType<typeof resolveAmountDisplayCurrency>;
  krwPerUsd?: number | null;
}) {
  if (currencyCode === "KRW") {
    return <KoreanWonAmount krw={amount} krwPerUsd={krwPerUsd} />;
  }
  return <span className="font-bold">{formatAmountPlain(amount, currencyCode)}</span>;
}

function ClaimRow({
  claim,
  country,
  vehicleYear,
  krwPerUsd,
  t,
  language,
  index,
  total,
  hasKoreanInsuranceClaims,
}: {
  claim: InsuranceClaimEntry;
  country?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  t: Props["t"];
  language: Language;
  index: number;
  total: number;
  hasKoreanInsuranceClaims: boolean;
}) {
  const typeLabel = translateInsuranceClaimType(t, claim.type);
  const hasBreakdown = claim.partCost != null || claim.laborCost != null || claim.paintingCost != null;
  const displayDate = localizeInsuranceClaimDate(claim.date, language, vehicleYear, country);
  const displayDescription = translateInsuranceClaimDescription(t, claim.description);
  const currencyCode = resolveAmountDisplayCurrency({
    currency: claim.currency,
    vehicleCountry: country,
    hasKoreanInsuranceClaims,
  });

  return (
    <div className={cn("border-b border-[#00a5fd]/10 px-1 py-3 last:border-b-0", index === total - 1 && "pb-0")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {displayDate ? (
            <p className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <Calendar className="h-3 w-3 shrink-0" />
              {displayDate}
            </p>
          ) : null}
          {typeLabel && (
            <p className="mt-1 text-sm font-semibold leading-snug text-[#071018]">{typeLabel}</p>
          )}
        </div>
        {claim.lossAmount != null && (
          <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-[#071018]">
            <ClaimAmount amount={claim.lossAmount} currencyCode={currencyCode} krwPerUsd={krwPerUsd} />
          </span>
        )}
      </div>
      {hasBreakdown && (
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          {claim.partCost != null && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("insurance_claim_part_cost")}</dt>
              <dd className="text-xs font-semibold tabular-nums">
                <ClaimAmount amount={claim.partCost} currencyCode={currencyCode} krwPerUsd={krwPerUsd} />
              </dd>
            </div>
          )}
          {claim.laborCost != null && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("insurance_claim_labor_cost")}</dt>
              <dd className="text-xs font-semibold tabular-nums">
                <ClaimAmount amount={claim.laborCost} currencyCode={currencyCode} krwPerUsd={krwPerUsd} />
              </dd>
            </div>
          )}
          {claim.paintingCost != null && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("insurance_claim_painting_cost")}</dt>
              <dd className="text-xs font-semibold tabular-nums">
                <ClaimAmount amount={claim.paintingCost} currencyCode={currencyCode} krwPerUsd={krwPerUsd} />
              </dd>
            </div>
          )}
        </dl>
      )}
      {displayDescription && !hasBreakdown && (
        <p className="mt-1 text-[11px] leading-snug text-slate-500">{displayDescription}</p>
      )}
    </div>
  );
}

function ClaimsList({
  claims,
  country,
  vehicleYear,
  krwPerUsd,
  t,
  language,
}: {
  claims: InsuranceClaimEntry[];
  country?: string | null;
  vehicleYear?: number | null;
  krwPerUsd?: number | null;
  t: Props["t"];
  language: Language;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = sliceForHistoryPreview(claims, expanded);
  const hasKoreanInsuranceClaims = claims.length > 0;

  return (
    <>
      <div className="space-y-2.5">
        {visible.map((claim, i) => (
          <ClaimRow
            key={`${claim.date}-${claim.type}-${i}`}
            claim={claim}
            country={country}
            vehicleYear={vehicleYear}
            krwPerUsd={krwPerUsd}
            t={t}
            language={language}
            index={i}
            total={visible.length}
            hasKoreanInsuranceClaims={hasKoreanInsuranceClaims}
          />
        ))}
      </div>
      <HistoryShowAllButton
        total={claims.length}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        t={t}
        className="mt-2.5"
      />
    </>
  );
}

export function InsuranceClaimsSection({
  claims,
  country,
  vehicleYear,
  krwPerUsd,
  t,
  language,
  variant = "report",
  className,
  delay = 0.1,
}: Props) {
  if (!claims.length) return null;

  const sortedClaims = sortHistoryNewestFirst(claims);
  const note = t("report_insurance_claims_note");

  if (variant === "public") {
    return (
      <ReportReveal delay={delay} y={12} className={className}>
        <VinReportSection accent="sky">
          <VinReportSectionHeader
            variant="public"
            icon={FileText}
            accent="sky"
            title={t("report_insurance_claims")}
            trailing={
              <Badge variant="secondary" className="text-[11px] sm:text-xs shrink-0">
                {formatInsuranceClaimsCount(t, sortedClaims.length)}
              </Badge>
            }
          />
          <div className="px-4 py-2.5 sm:px-5 sm:py-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">{note}</p>
            <ClaimsList claims={sortedClaims} country={country} vehicleYear={vehicleYear} krwPerUsd={krwPerUsd} t={t} language={language} />
          </div>
        </VinReportSection>
      </ReportReveal>
    );
  }

  return (
    <ReportReveal delay={delay} y={16} inView className={className}>

      <VinReportSection accent="sky">
        <VinReportSectionHeader
          icon={FileText}
          accent="sky"
          title={t("report_insurance_claims")}
          subtitle={note}
          trailing={
            <Badge variant="secondary" className="text-xs shrink-0">
              {formatInsuranceClaimsCount(t, sortedClaims.length)}
            </Badge>
          }
        />
        <div className="px-4 py-3">
          <ClaimsList claims={sortedClaims} country={country} vehicleYear={vehicleYear} krwPerUsd={krwPerUsd} t={t} language={language} />
        </div>
      </VinReportSection>
    </ReportReveal>
  );
}
