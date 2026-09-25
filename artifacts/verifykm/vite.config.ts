import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { existsSync, readFileSync } from "node:fs";
import { seoHtmlPlugin } from "./vite-seo-plugin";

/** Fill API_PORT / VITE_* from workspace root `.env` when the shell did not export them. */
function loadRootEnvFallbacks() {
  const rootEnv = path.resolve(import.meta.dirname, "..", "..", ".env");
  if (!existsSync(rootEnv)) return;
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (
      (val.startsWith('"') && val.endsWith('"'))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Root `.env` PORT belongs to the API (8080/8081) — never use it for Vite.
    if (key === "PORT") continue;
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadRootEnvFallbacks();

// Frontend port — keep separate from API `PORT` in the root `.env`.
const rawPort = process.env.VITE_DEV_PORT ?? "5173";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid VITE_DEV_PORT value: "${rawPort}"`);
}

const apiPort = process.env.API_PORT ?? "8080";
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(({ command }) => ({
  base: basePath,
  plugins: [
    seoHtmlPlugin(),
    react(),
    tailwindcss(),
  ],
  esbuild: {
    // Vite can leave jsxDev on in production; force production JSX in builds.
    jsxDev: command === "serve",
    legalComments: "none",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "charts";
          }
          if (id.includes("node_modules/framer-motion")) {
            return "motion";
          }
          if (
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/class-variance-authority") ||
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/cmdk") ||
            id.includes("node_modules/vaul") ||
            id.includes("node_modules/sonner") ||
            id.includes("node_modules/embla-carousel")
          ) {
            return "ui";
          }
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/wouter") ||
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/scheduler")
          ) {
            return "vendor";
          }
          if (id.includes("@workspace/vin-decode") || id.includes("lib/vin-decode")) {
            return "vin-decode";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "framer-motion",
      "recharts",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // Only real backend routes (`/api`, `/api/...`). Never capture `/api-b2b` marketing.
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
        bypass(req) {
          const url = req.url ?? "";
          const path = url.split("?")[0] ?? "";
          if (path === "/api" || path.startsWith("/api/")) return undefined;
          return url;
        },
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const host = req.headers.host;
            if (host) proxyReq.setHeader("x-forwarded-host", host);
            const remote = req.socket?.remoteAddress;
            if (remote) {
              const prior = req.headers["x-forwarded-for"];
              const chain = prior ? `${prior}, ${remote}` : remote;
              proxyReq.setHeader("x-forwarded-for", chain);
            }
            const cfCountry = req.headers["cf-ipcountry"];
            if (typeof cfCountry === "string") {
              proxyReq.setHeader("cf-ipcountry", cfCountry);
            }
            const debugCountry = req.headers["x-verifykm-debug-country"];
            if (typeof debugCountry === "string") {
              proxyReq.setHeader("x-verifykm-debug-country", debugCountry);
            }
          });
        },
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
}));
