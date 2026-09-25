import { createRoot } from "react-dom/client";
import { setCredentials, setClientGuardToken } from "@workspace/api-client-react";
import "@/fonts/sora-latin.css";
import { fetchGeoLanguageHint } from "@/lib/geo-language-client";
import { pathNeedingLangPrefix } from "@/lib/lang-preference";
import App from "./App";
import "./index.css";
import { installFetchGuard } from "./lib/install-fetch-guard";
import { installChunkLoadRecovery } from "./lib/lazy-with-retry";

const clientGuardToken = import.meta.env.VITE_CLIENT_GUARD_TOKEN as string | undefined;

setCredentials("include");
setClientGuardToken(clientGuardToken ?? null);
installFetchGuard(clientGuardToken);
installChunkLoadRecovery();

// Warm geo hint for `/` and unprefixed paths that need a language prefix.
if (typeof window !== "undefined") {
  const path = window.location.pathname;
  const normalized = path.replace(/\/$/, "") || "/";
  if (normalized === "/" || pathNeedingLangPrefix(path) !== null) {
    void fetchGeoLanguageHint();
  }
}

createRoot(document.getElementById("root")!).render(<App />);

function removeMarketingSsrShell() {
  document.getElementById("verifykm-page-ssr")?.remove();
  document.getElementById("verifykm-page-ssr-style")?.remove();
  document.getElementById("verifykm-vin-ssr")?.remove();
  document.getElementById("verifykm-vin-ssr-style")?.remove();
}

requestAnimationFrame(() => {
  removeMarketingSsrShell();
  document.documentElement.classList.add("verifykm-hydrated");
});
