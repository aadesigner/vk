import { describe, expect, it } from "vitest";
import {
  buildImageProxyUrl,
  resolveVinPhotoUrlForClient,
  transformVinPhotoData,
  unwrapVinImageProxyUrl,
  withVinImageDisplayWidth,
} from "./imageProxy.js";

describe("resolveVinPhotoUrlForClient", () => {
  it("passes provider URLs through without proxying", () => {
    const url = "https://img.encar.com/cars/1.jpg";
    expect(resolveVinPhotoUrlForClient(url)).toBe(url);
  });

  it("passes through non-allowlisted admin URLs unchanged", () => {
    const url = "https://images.example-server.net/vehicle/front.jpg";
    expect(resolveVinPhotoUrlForClient(url)).toBe(url);
  });

  it("unwraps leftover proxy paths to the original URL", () => {
    const original = "https://img.encar.com/cars/1.jpg";
    const proxied = buildImageProxyUrl(original);
    expect(proxied).toMatch(/^\/api\/vin\/image\?token=/);
    expect(unwrapVinImageProxyUrl(proxied)).toBe(original);
    expect(resolveVinPhotoUrlForClient(proxied)).toBe(original);
  });
});

describe("legacy proxy helpers", () => {
  it("appends w= once on leftover proxy URLs", () => {
    const once = withVinImageDisplayWidth("/api/vin/image?token=abc");
    expect(once).toBe("/api/vin/image?token=abc&w=960");
    expect(withVinImageDisplayWidth(once)).toBe(once);
  });

  it("does not rewrite report photos through the proxy", () => {
    const photo = "https://img.encar.com/cars/1.jpg";
    const hd = "https://img.encar.com/cars/1-hd.jpg";
    const out = transformVinPhotoData({
      photos: [photo],
      photosHd: [hd],
    }) as { photos: string[]; photosHd: string[] };
    expect(out.photos[0]).toBe(photo);
    expect(out.photosHd[0]).toBe(hd);
  });
});
