import { useState, useCallback, useEffect, useMemo } from "react";
import {
  FileDown, Loader2, Share2, Copy, Check, Link2, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n/context";
import { useToast } from "@/hooks/use-toast";
import { openVinReportPdf, shareVinReportPdf, copyReportLink } from "@/lib/print-report";
import { tagAcquisitionUrl } from "@/lib/acquisition";
import { cn } from "@/lib/utils";

export type VinSharePreviewData = {
  thumbnailUrl?: string | null;
  odometer?: number | null;
  accidentCount?: number | null;
  ownerCount?: number | null;
};

export type VinShareActionsProps = {
  vin: string;
  language: string;
  vehicleTitle: string;
  /** Real report snapshot for the left-side PDF mock. */
  preview?: VinSharePreviewData;
  basePath: string;
  compact?: boolean;
  dense?: boolean;
  className?: string;
  disabled?: boolean;
};

function useShareUrl({
  vin,
  language,
  basePath,
  disabled,
}: Pick<VinShareActionsProps, "vin" | "language" | "basePath" | "disabled">) {
  const buildShareUrl = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${basePath}/${language}/vin/${vin}`;
  }, [basePath, language, vin]);

  const resolveShareUrl = useCallback(async (): Promise<string | null> => {
    return buildShareUrl();
  }, [buildShareUrl]);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    setLinkLoading(true);
    void resolveShareUrl()
      .then((url) => {
        if (!cancelled) {
          setShareUrl(url);
          setLinkLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLinkLoading(false);
      });
    return () => { cancelled = true; };
  }, [disabled, resolveShareUrl]);

  return { resolveShareUrl, shareUrl, linkLoading };
}

function fillShareTemplate(template: string, vehicleTitle: string): string {
  return template.replace(/\{vehicle\}/g, vehicleTitle);
}

export function VinReportDataDisclaimer({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p
      className={cn("text-xs leading-relaxed text-slate-500 sm:text-[13px]", className)}
      role="note"
    >
      {t("vin_report_data_disclaimer")}
    </p>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

export function VinReportShareActions({
  vin,
  language,
  vehicleTitle,
  basePath,
  compact = false,
  dense = false,
  className,
  disabled = false,
}: VinShareActionsProps & { dense?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const { resolveShareUrl, shareUrl, linkLoading } = useShareUrl({
    vin, language, basePath, disabled,
  });

  const shareText = useMemo(
    () => fillShareTemplate(t("vin_share_social_message"), vehicleTitle),
    [t, vehicleTitle],
  );
  const emailSubject = useMemo(
    () => fillShareTemplate(t("vin_share_email_subject"), vehicleTitle),
    [t, vehicleTitle],
  );

  const handleDownloadPdf = async () => {
    if (disabled || downloading) return;
    setDownloading(true);
    try {
      await openVinReportPdf();
    } finally {
      setDownloading(false);
    }
  };

  const handleSharePdf = async () => {
    if (disabled) return;
    setSharing(true);
    try {
      const url = tagAcquisitionUrl(shareUrl ?? await resolveShareUrl() ?? "", "share", "native", "report_share");
      const result = await shareVinReportPdf({ vehicleTitle, vin, shareUrl: url || null, shareText });
      if (result === "copied") {
        toast({ description: t("vin_share_pdf_copied") });
      } else if (result === "failed") {
        toast({ variant: "destructive", description: t("vin_share_pdf_failed") });
      }
    } catch {
      toast({ variant: "destructive", description: t("vin_share_pdf_failed") });
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (disabled || !shareUrl) return;
    setCopying(true);
    try {
      const ok = await copyReportLink(tagAcquisitionUrl(shareUrl, "share", "copy", "report_share"));
      if (ok) {
        toast({ description: t("vin_share_pdf_copied") });
      } else {
        toast({ variant: "destructive", description: t("vin_share_link_error") });
      }
    } finally {
      setCopying(false);
    }
  };

  const openSocial = (kind: "whatsapp" | "telegram" | "email") => {
    if (!shareUrl) return;
    const tagged = tagAcquisitionUrl(shareUrl, kind, "social", "report_share");
    const body = `${shareText}\n${tagged}`;
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(body)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(tagged)}&text=${encodeURIComponent(shareText)}`,
      email: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`,
    };
    window.open(urls[kind], kind === "email" ? "_self" : "_blank", "noopener,noreferrer");
  };

  const btnClass = compact || dense
    ? "h-9 gap-1.5 text-xs px-3 whitespace-nowrap rounded-lg"
    : "gap-2 h-11 px-5 text-sm font-semibold rounded-xl";

  if (compact) {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full", className)}>
        <Button type="button" size="sm" variant="outline" className={cn(btnClass, "w-full")} disabled={disabled || downloading} onClick={() => void handleDownloadPdf()}>
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          {t("vin_result_download_pdf")}
        </Button>
        <Button type="button" size="sm" className={cn(btnClass, "w-full")} disabled={disabled || sharing} onClick={() => void handleSharePdf()}>
          {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
          {t("vin_result_share_pdf")}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled={disabled || downloading}
          onClick={() => void handleDownloadPdf()}
          className="flex min-h-[6.5rem] flex-col items-start justify-between rounded-lg border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_16px_36px_-30px_rgba(7,16,24,0.45)] transition-colors hover:border-[#00a5fd]/40 hover:bg-[#f7fbfe] disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#0088d4]" />
          ) : (
            <FileDown className="h-5 w-5 text-[#0088d4]" />
          )}
          <span className="text-[15px] font-bold tracking-tight text-slate-950">
            {t("vin_result_download_pdf")}
          </span>
        </button>
        <button
          type="button"
          disabled={disabled || sharing}
          onClick={() => void handleSharePdf()}
          className="flex min-h-[6.5rem] flex-col items-start justify-between rounded-lg border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_16px_36px_-30px_rgba(7,16,24,0.45)] transition-colors hover:border-[#00a5fd]/40 hover:bg-[#f7fbfe] disabled:opacity-50"
        >
          {sharing ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#0088d4]" />
          ) : (
            <Share2 className="h-5 w-5 text-[#0088d4]" />
          )}
          <span className="text-[15px] font-bold tracking-tight text-slate-950">
            {t("vin_result_share_pdf")}
          </span>
        </button>
        <button
          type="button"
          disabled={disabled || linkLoading || !shareUrl || copying}
          onClick={() => void handleCopyLink()}
          className="flex min-h-[6.5rem] flex-col items-start justify-between rounded-lg border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_16px_36px_-30px_rgba(7,16,24,0.45)] transition-colors hover:border-[#00a5fd]/40 hover:bg-[#f7fbfe] disabled:opacity-50"
        >
          {copying ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#0088d4]" />
          ) : (
            <Copy className="h-5 w-5 text-[#0088d4]" />
          )}
          <span className="text-[15px] font-bold tracking-tight text-slate-950">
            {t("vin_share_copy_link")}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-slate-200 pb-2 sm:pb-1.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <Input
            readOnly
            value={linkLoading ? t("vin_share_preparing") : (shareUrl ?? "")}
            className="h-8 border-0 bg-transparent px-0 font-mono text-xs text-slate-600 shadow-none focus-visible:ring-0"
            onFocus={(e) => e.target.select()}
            aria-label={t("vin_share_link_label")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 disabled:opacity-40"
            disabled={disabled || !shareUrl}
            onClick={() => openSocial("whatsapp")}
          >
            <WhatsAppIcon className="h-3.5 w-3.5" />
            {t("vin_share_whatsapp")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 disabled:opacity-40"
            disabled={disabled || !shareUrl}
            onClick={() => openSocial("telegram")}
          >
            <TelegramIcon className="h-3.5 w-3.5" />
            {t("vin_share_telegram")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 disabled:opacity-40"
            disabled={disabled || !shareUrl}
            onClick={() => openSocial("email")}
          >
            <Mail className="h-3.5 w-3.5" />
            {t("vin_share_email")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Decorative PDF document mock for the share card — uses live report photo + stats when provided. */
export function VinReportPdfPreview({
  vehicleTitle,
  vin,
  preview,
  className,
}: {
  vehicleTitle: string;
  vin: string;
  preview?: VinSharePreviewData;
  className?: string;
}) {
  const { t } = useTranslation();
  const thumbnailUrl = preview?.thumbnailUrl ?? null;
  const odometer = preview?.odometer;
  const accidentCount = preview?.accidentCount;
  const ownerCount = preview?.ownerCount;

  const statCells: { label: string; value: string }[] = [];
  if (odometer != null && odometer > 0) {
    statCells.push({
      label: t("demo_odometer"),
      value: `${odometer.toLocaleString()} km`,
    });
  }
  if (accidentCount != null) {
    statCells.push({
      label: t("mock_label_accidents"),
      value: accidentCount === 0 ? t("demo_none_found") : String(accidentCount),
    });
  }
  if (ownerCount != null && ownerCount > 0) {
    statCells.push({
      label: t("mock_label_owners"),
      value: ownerCount === 1 ? t("owner_single") : String(ownerCount),
    });
  }

  return (
    <div
      className={cn(
        "relative w-[168px] sm:w-[188px] shrink-0 mx-auto lg:mx-0",
        className,
      )}
      aria-hidden
    >
      <div className="absolute -inset-4 rounded-3xl bg-primary/[0.08] blur-2xl" />
      <div className="relative rotate-[-2.5deg] rounded-xl border border-border/70 bg-card shadow-[0_16px_40px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_48px_-14px_rgba(0,0,0,0.55)] overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-1">
            <div className="h-2 w-14 rounded-full bg-primary/30" />
            <div className="rounded bg-primary/15 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-primary">
              PDF
            </div>
          </div>
          <div>
            <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground leading-none">
              {t("print_summary_title")}
            </p>
            <p className="text-[10.5px] font-bold text-foreground leading-tight mt-1 line-clamp-2">{vehicleTitle}</p>
            <p className="text-[7px] font-mono text-muted-foreground mt-0.5 truncate">{vin}</p>
          </div>
          <div className="relative rounded-md aspect-[4/3] border border-border/50 overflow-hidden bg-muted/40">
            {thumbnailUrl ? (
              <>
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.1] dark:opacity-[0.07] bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.4)_48%,transparent_100%)] bg-[length:100%_200%] animate-[demo-scan_4.5s_ease-in-out_infinite]"
                />
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/60 to-muted/30">
                <div className="h-6 w-10 rounded-sm bg-primary/15 border border-primary/20" />
              </div>
            )}
          </div>
          {statCells.length > 0 ? (
            <div className={cn("grid gap-1 pt-0.5", statCells.length >= 2 ? "grid-cols-2" : "grid-cols-1")}>
              {statCells.slice(0, 4).map((cell) => (
                <div
                  key={cell.label}
                  className="rounded-md bg-primary/[0.08] border border-primary/15 px-1.5 py-1 min-w-0"
                >
                  <p className="text-[6px] font-semibold uppercase tracking-wide text-muted-foreground truncate leading-none">
                    {cell.label}
                  </p>
                  <p className="text-[8px] font-bold text-foreground tabular-nums truncate mt-0.5 leading-tight">
                    {cell.value}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-muted" />
              <div className="h-1.5 w-[90%] rounded-full bg-muted/80" />
              <div className="h-1.5 w-[75%] rounded-full bg-muted/60" />
            </div>
          )}
        </div>
      </div>
      <div className="absolute -right-1.5 -bottom-1.5 h-[90%] w-full rounded-xl border border-border/25 bg-background/50 -z-10 rotate-[4deg]" />
    </div>
  );
}

export function VinShareReportHighlights({ className }: { className?: string }) {
  const { t } = useTranslation();
  const items = [
    t("print_summary_mileage_history"),
    t("print_summary_findings"),
    t("print_summary_photos"),
  ];

  return (
    <ul className={cn("space-y-1.5", className)}>
      {items.map((label) => (
        <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
