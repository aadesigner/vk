import { cn } from "@/lib/utils";
import {
  convertKrwToUsd,
  formatKoreanWonPlain,
  formatUsdAmount,
  resolveKrwPerUsd,
} from "@/lib/korean-currency";
import {
  isRegistryRepairCostLabel,
  MIN_PLAUSIBLE_NEW_CAR_LIST_KRW,
  MAX_PLAUSIBLE_NEW_CAR_LIST_KRW,
  resolveKoreanDisplayKrw,
  sanitizeKoreanRepairKrwAmount,
} from "@workspace/korean-registry";

type Props = {
  /** Raw KRW amount */
  krw?: number | null;
  /** Provider text e.g. "2,566,720 won" or "136.6 million won" */
  text?: string | null;
  /** Registry field label — selects list-price vs repair parsing */
  amountLabel?: string | null;
  krwPerUsd?: number | null;
  className?: string;
  usdClassName?: string;
  wonClassName?: string;
};

function resolveWonDisplayKrw(
  krw: number | null | undefined,
  text: string | null | undefined,
  amountLabel?: string | null,
): number | null {
  if (text) return resolveKoreanDisplayKrw(text, amountLabel);
  if (krw == null || krw <= 0) return null;
  if (amountLabel && isRegistryRepairCostLabel(amountLabel)) {
    return sanitizeKoreanRepairKrwAmount(krw);
  }
  if (krw >= MIN_PLAUSIBLE_NEW_CAR_LIST_KRW && krw <= MAX_PLAUSIBLE_NEW_CAR_LIST_KRW) {
    return Math.round(krw);
  }
  return sanitizeKoreanRepairKrwAmount(krw);
}

export function KoreanWonAmount({
  krw,
  text,
  amountLabel,
  krwPerUsd,
  className,
  usdClassName,
  wonClassName,
}: Props) {
  const resolvedKrw = resolveWonDisplayKrw(krw, text, amountLabel);
  if (resolvedKrw == null || resolvedKrw <= 0) return null;

  const rate = resolveKrwPerUsd(krwPerUsd);
  const usd = formatUsdAmount(convertKrwToUsd(resolvedKrw, rate));

  return (
    <span className={cn("tabular-nums inline-flex items-baseline gap-1 flex-wrap", className)}>
      <span className={cn("font-semibold", usdClassName)}>{usd}</span>
      <span className={cn("text-muted-foreground/50 font-normal text-[0.92em]", wonClassName)}>
        (₩{Math.round(resolvedKrw).toLocaleString()})
      </span>
    </span>
  );
}

/** Plain string for print / PDF — USD primary, won in parentheses */
export function formatKoreanWonDisplay(
  input: number | string,
  krwPerUsd?: number | null,
  amountLabel?: string | null,
): string | null {
  const krw =
    typeof input === "number"
      ? input
      : resolveKoreanDisplayKrw(input, amountLabel);
  if (krw == null || krw <= 0) return null;
  return formatKoreanWonPlain(krw, resolveKrwPerUsd(krwPerUsd));
}

export function textContainsWon(value: string): boolean {
  return /won|₩/i.test(value);
}
