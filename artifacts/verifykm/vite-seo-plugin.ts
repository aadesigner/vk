import type { Plugin } from "vite";
import { injectSeoIntoHtml } from "./scripts/seo-inject.mjs";

const basePath = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");

function requestPathname(url: string | undefined): string {
  return (url ?? "/").split("?")[0] || "/";
}

function shouldInjectHtml(pathname: string): boolean {
  if (pathname.startsWith("/api") || pathname.startsWith("/@")) return false;
  if (pathname.startsWith("/src/") || pathname.startsWith("/node_modules/")) return false;
  const leaf = pathname.split("/").pop() ?? "";
  if (leaf.includes(".") && !leaf.endsWith(".html")) return false;
  return true;
}

/** Injects localized title/meta into HTML per request URL (dev + preview). */
export function seoHtmlPlugin(): Plugin {
  let requestPath = "/en";

  return {
    name: "verifykm-seo-html",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method === "GET" && shouldInjectHtml(requestPathname(req.url))) {
          requestPath = requestPathname(req.url);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.method === "GET" && shouldInjectHtml(requestPathname(req.url))) {
          requestPath = requestPathname(req.url);
        }
        next();
      });
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const pathname = ctx.originalUrl
          ? requestPathname(ctx.originalUrl)
          : requestPath;
        return injectSeoIntoHtml(html, pathname, basePath);
      },
    },
  };
}
