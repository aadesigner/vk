import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminTheme } from "@/components/admin/admin-theme-provider";

export function AdminThemePicker({
  className,
  toolbar = false,
}: {
  className?: string;
  /** Icon-only control for the desktop floating toolbar */
  toolbar?: boolean;
}) {
  const { themeId, theme, themes, setThemeId } = useAdminTheme();

  const cycleTheme = () => {
    const idx = themes.findIndex((t) => t.id === themeId);
    const next = themes[(idx + 1) % themes.length] ?? themes[0];
    if (next) setThemeId(next.id);
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(
        "flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "text-muted-foreground transition-colors hover:text-foreground",
        toolbar
          ? "h-8 w-8 rounded-full hover:bg-muted"
          : "w-full gap-3 rounded-xl px-3 py-2.5 hover:bg-muted text-sm font-medium",
        className,
      )}
      aria-label={`Switch admin theme (current: ${theme.name})`}
      title={`${theme.name} — click to switch`}
    >
      <Palette className="h-4 w-4 shrink-0" />
      {!toolbar ? (
        <span className="flex-1 min-w-0 text-left truncate">{theme.name}</span>
      ) : null}
    </button>
  );
}
