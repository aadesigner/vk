import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/context";
import { getErrorStatus } from "@/lib/api-error";
import { cn } from "@/lib/utils";

type ClientQueryErrorProps = {
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
};

export function ClientQueryError({
  error,
  onRetry,
  isRetrying,
  className,
}: ClientQueryErrorProps) {
  const { t } = useTranslation();
  const status = getErrorStatus(error);
  const isAuth = status === 401 || status === 403;

  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center space-y-4",
        className,
      )}
      role="alert"
    >
      <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-2 max-w-md mx-auto">
        <h3 className="font-bold text-lg">
          {isAuth ? t("client_load_auth_failed") : t("client_load_failed")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isAuth ? t("client_load_auth_failed_desc") : t("client_load_failed_desc")}
        </p>
      </div>
      {onRetry && !isAuth && (
        <Button type="button" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? (
            <><RotateCcw className="h-4 w-4 mr-2 animate-spin" />{t("processing_retrying")}</>
          ) : (
            <><RotateCcw className="h-4 w-4 mr-2" />{t("retry")}</>
          )}
        </Button>
      )}
    </div>
  );
}
