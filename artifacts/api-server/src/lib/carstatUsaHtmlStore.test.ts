import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/kmcheck_test";
});

describe("carstatUsaHtmlStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "usa-html-"));
    process.env.CARSTAT_USA_HTML_CACHE_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.CARSTAT_USA_HTML_CACHE_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("round-trips gzipped sanitized HTML by VIN", async () => {
    const { writeStoredUsaHtml, readStoredUsaHtml } = await import("./carstatUsaHtmlStore.js");
    const vin = "7FARW2H56JE022576";
    const html = `<!DOCTYPE html><html><head><title>Vehicle history report</title></head><body>${"report-row ".repeat(400)}</body></html>`;
    const meta = await writeStoredUsaHtml(vin, html, {
      sourceHtmlUrl: "https://report-cars.b-cdn.net/reports/carfax/x.html",
    });
    expect(meta?.vin).toBe(vin);
    expect(meta?.byteLengthGzip).toBeGreaterThan(0);
    expect(meta?.byteLengthGzip).toBeLessThan(meta!.byteLengthRaw);

    const back = await readStoredUsaHtml(vin.toLowerCase());
    expect(back).toBe(html);
  });

  it("returns null for missing VIN", async () => {
    const { readStoredUsaHtml } = await import("./carstatUsaHtmlStore.js");
    expect(await readStoredUsaHtml("AAAAAAAAAAAAAAAAA")).toBeNull();
  });
});
