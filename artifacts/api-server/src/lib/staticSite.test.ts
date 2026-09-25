import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("staticSite asset fallback", () => {
  const src = readFileSync(join(apiRoot, "lib/staticSite.ts"), "utf8");

  it("returns 404 for missing asset paths instead of SPA index.html", () => {
    expect(src).toContain("isStaticAssetRequest");
    expect(src).toMatch(/isStaticAssetRequest\(req\.path\)[\s\S]*404/);
  });

  it("returns real 404 for unknown HTML routes instead of soft-404 home", () => {
    expect(src).toContain("isKnownSpaPath");
    expect(src).toContain("sendHardNotFound");
    expect(src).toMatch(/!isKnownSpaPath\(req\.path\)/);
  });

  it("disables express.static trailing-slash redirects for sitemap URL parity", () => {
    expect(src).toMatch(/redirect:\s*false/);
  });

  it("301-redirects crawlers from / to /en to avoid soft-duplicate English home", () => {
    expect(src).toContain("isCrawlerUserAgent");
    expect(src).toMatch(/req\.path === \"\/\"[\s\S]*isCrawlerUserAgent[\s\S]*redirect\(301,\s*`\/en/);
  });

  it("injects marketing SEO meta + SSR body in SPA fallback for indexable pages", () => {
    expect(src).toContain("injectMarketingPageSeoFromPath");
  });

  it("sets Content-Language on localized HTML responses", () => {
    expect(src).toContain("applyContentLanguageHeader");
    expect(src).toContain("Content-Language");
  });
});

describe("trailing-slash sitemap parity (express.static + dir index)", () => {
  let publicDir = "";
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    publicDir = mkdtempSync(join(tmpdir(), "verifykm-static-"));
    const pricingDir = join(publicDir, "en", "pricing");
    mkdirSync(pricingDir, { recursive: true });
    writeFileSync(join(pricingDir, "index.html"), "<!doctype html><title>pricing</title>", "utf8");

    const app = express();
    app.use(
      express.static(publicDir, {
        index: false,
        redirect: false,
      }),
    );
    app.get(/.*/, (req, res) => {
      const safe = req.path.replace(/\/+$/, "") || "/";
      const withIndex = join(publicDir, safe, "index.html");
      if (existsSync(withIndex) && statSync(withIndex).isFile()) {
        res.type("html").sendFile(withIndex);
        return;
      }
      res.status(404).end();
    });

    server = createServer(app);
    baseUrl = await new Promise<string>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") throw new Error("no listen address");
        resolve(`http://127.0.0.1:${addr.port}`);
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    rmSync(publicDir, { recursive: true, force: true });
  });

  it("serves prerendered page at sitemap URL without trailing-slash 301", async () => {
    const res = await fetch(`${baseUrl}/en/pricing`, { redirect: "manual" });
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    const body = await res.text();
    expect(body).toContain("<title>pricing</title>");
  });
});
