import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SaveMessage = { ok: boolean; text: string } | null;

type Props = {
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  saveMsg?: SaveMessage;
  disabled?: boolean;
  hint?: string;
  extra?: React.ReactNode;
  className?: string;
};

/** Sticky save bar + Ctrl/Cmd+S shortcut for admin VIN editors. */
export function AdminVinSaveBar({
  onSave,
  saving = false,
  saveLabel = "Save changes",
  saveMsg,
  disabled = false,
  hint = "Ctrl+S to save · updates catalog and all user reports for this VIN",
  extra,
  className,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving && !disabled) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, saving, disabled]);

  return (
    <div
      className={cn(
        // Match admin-main padding (p-3 / sm:p-4 / lg:p-6); offset above mobile bottom nav
        "sticky bottom-[4.5rem] md:bottom-0 z-40 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 py-3 mt-6",
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "flex flex-col sm:flex-row sm:items-center gap-3 max-w-[100vw]",
        className,
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {saveMsg ? (
          <p
            className={cn(
              "text-sm flex items-center gap-1.5 font-medium",
              saveMsg.ok ? "text-[#0088d4] dark:text-[#00a5fd]" : "text-destructive",
            )}
          >
            {saveMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            {saveMsg.text}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {extra}
        <Button onClick={onSave} disabled={saving || disabled} className="gap-1.5 min-w-[8.5rem]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}
