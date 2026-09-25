import { Link } from "wouter";
import { AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/context";
import type { VinReportErrorKind } from "@/lib/api-error";
import { pathFor } from "@/lib/localized-routes";

type VinReportErrorViewProps = {
  kind: VinReportErrorKind;
  language: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  showDashboardLink?: boolean;
};

function titleKey(kind: VinReportErrorKind): string {
  switch (kind) {
    case "not_found":
      return "report_not_found";
    case "forbidden":
      return "report_access_denied";
    case "unauthorized":
      return "report_sign_in_required";
    case "server":
      return "report_load_failed";
    case "rate_limit":
      return "error_rate_limit";
    default:
      return "report_load_failed";
  }
}

function descKey(kind: VinReportErrorKind): string | null {
  switch (kind) {
    case "not_found":
      return "vin_public_not_found_desc";
    case "forbidden":
      return "report_access_denied_desc";
    case "unauthorized":
      return "report_sign_in_required_desc";
    case "server":
      return "report_load_failed_desc";
    case "rate_limit":
      return "error_rate_limit_desc";
    default:
      return null;
  }
}

export function VinReportErrorView({
  kind,
  language,
  onRetry,
  isRetrying,
  showDashboardLink = true,
}: VinReportErrorViewProps) {
  const { t } = useTranslation();
  const desc = descKey(kind);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t(titleKey(kind))}</h1>
        {desc && <p className="text-sm text-muted-foreground">{t(desc)}</p>}
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {onRetry && (kind === "server" || kind === "unknown" || kind === "rate_limit") && (
          <Button type="button" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? (
              <><RotateCcw className="h-4 w-4 mr-2 animate-spin" />{t("processing_retrying")}</>
            ) : (
              <><RotateCcw className="h-4 w-4 mr-2" />{t("retry")}</>
            )}
          </Button>
        )}
        {kind === "unauthorized" && (
          <Button asChild>
            <Link href={pathFor(language, "sign_in")}>{t("sign_in")}</Link>
          </Button>
        )}
        {showDashboardLink && (
          <Button variant="outline" asChild>
            <Link href={kind === "forbidden" ? `/${language}` : pathFor(language, "dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {kind === "forbidden" ? t("back_to_home") : t("back_to_dashboard")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function resolveVinReportErrorKind(error: unknown): VinReportErrorKind {
  if (error && typeof error === "object") {
    const tagged = error as { kind?: VinReportErrorKind; notFound?: boolean; forbidden?: boolean; authRequired?: boolean; serverError?: boolean; rateLimited?: boolean };
    if (tagged.kind) return tagged.kind;
    if (tagged.notFound) return "not_found";
    if (tagged.forbidden) return "forbidden";
    if (tagged.authRequired) return "unauthorized";
    if (tagged.serverError) return "server";
    if (tagged.rateLimited) return "rate_limit";
    if ("status" in error && typeof (error as { status: unknown }).status === "number") {
      const status = (error as { status: number }).status;
      if (status === 404) return "not_found";
      if (status === 403) return "forbidden";
      if (status === 401) return "unauthorized";
      if (status === 429) return "rate_limit";
      if (status >= 500) return "server";
    }
  }
  return "unknown";
}
