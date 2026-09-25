import { createContext, useContext, useLayoutEffect, useCallback } from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Kept for callers. Site is light-only. */
  setLightLock: (locked: boolean) => void
}

function applyLightClass() {
  if (typeof window === "undefined") return
  const root = window.document.documentElement
  root.classList.add("disable-transitions")
  root.classList.remove("dark")
  root.classList.add("light")
  root.style.colorScheme = "light"
  void root.offsetHeight
  root.classList.remove("disable-transitions")
}

const initialState: ThemeProviderState = {
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => null,
  setLightLock: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  storageKey = "verifykm-theme",
  ...props
}: ThemeProviderProps) {
  useLayoutEffect(() => {
    applyLightClass()
    try {
      localStorage.setItem(storageKey, "light")
    } catch {
      /* ignore quota / private mode */
    }
  }, [storageKey])

  const setTheme = useCallback((_next: Theme) => {
    applyLightClass()
    try {
      localStorage.setItem(storageKey, "light")
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const setLightLock = useCallback((_locked: boolean) => {}, [])

  return (
    <ThemeProviderContext.Provider
      {...props}
      value={{ theme: "light", resolvedTheme: "light", setTheme, setLightLock }}
    >
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
