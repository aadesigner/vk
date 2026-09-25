import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ADMIN_THEMES,
  ensureAdminThemeFonts,
  readStoredAdminTheme,
  writeStoredAdminTheme,
  type AdminThemeId,
  type AdminThemeMeta,
} from "@/lib/admin-theme";

type AdminThemeContextValue = {
  themeId: AdminThemeId;
  theme: AdminThemeMeta;
  themes: AdminThemeMeta[];
  setThemeId: (id: AdminThemeId) => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<AdminThemeId>(() => readStoredAdminTheme());

  useEffect(() => {
    ensureAdminThemeFonts(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: AdminThemeId) => {
    setThemeIdState(id);
    writeStoredAdminTheme(id);
    ensureAdminThemeFonts(id);
  }, []);

  const value = useMemo<AdminThemeContextValue>(() => {
    const theme = ADMIN_THEMES.find((t) => t.id === themeId) ?? ADMIN_THEMES[0]!;
    return {
      themeId,
      theme,
      themes: ADMIN_THEMES,
      setThemeId,
    };
  }, [themeId, setThemeId]);

  return (
    <AdminThemeContext.Provider value={value}>
      {children}
    </AdminThemeContext.Provider>
  );
}

/** Apply admin theme flag on <html> while the admin shell is mounted.
 *  Design tokens live on `.admin-shell` only — never rewrite global page colors.
 */
export function useAdminThemeDocumentSync(enabled: boolean) {
  const { themeId } = useAdminTheme();

  // Keep class/attribute in sync without remove→add flash when themeId changes.
  useEffect(() => {
    const root = document.documentElement;
    if (!enabled) {
      root.classList.remove("admin-theme-active");
      root.removeAttribute("data-admin-theme");
      return;
    }
    root.classList.add("admin-theme-active");
    root.setAttribute("data-admin-theme", themeId);
  }, [enabled, themeId]);

  // Cleanup only when leaving admin (enabled flips false / unmount).
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    return () => {
      root.classList.remove("admin-theme-active");
      root.removeAttribute("data-admin-theme");
    };
  }, [enabled]);
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return ctx;
}
