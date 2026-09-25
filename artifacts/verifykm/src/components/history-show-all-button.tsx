import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HISTORY_PREVIEW_LIMIT } from "@/lib/history-section-limit";

type Props = {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string) => string;
  className?: string;
};

export function HistoryShowAllButton({ total, expanded, onToggle, t, className }: Props) {
  if (total <= HISTORY_PREVIEW_LIMIT) return null;

  const label = expanded
    ? t("history_show_less")
    : t("history_show_all").replace("{count}", String(total));

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group w-full flex items-center justify-center gap-1.5 rounded-lg border border-primary/20",
        "bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold",
        "py-2 px-3 transition-colors",
        className,
      )}
    >
      <span>{label}</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}
