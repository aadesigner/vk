import { describe, expect, it } from "vitest";
import {
  buildImageProxyUrl,
  isCarstatImageUrl,
  resolveVinPhotoUrlForClient,
  transformVinPhotoData,
  unwrapVinImageProxyUrl,
} from "./imageProxy.js";

describe("resolveVinPhotoUrlForClient", () => {
  it("proxies only Carstat CDN URLs", () => {
    const carstat = "https://i2.carstat.dev/copart/toyota/1.webp";
    expect(isCarstatImageUrl(carstat)).toBe(true);
    const out = resolveVinPhotoUrlForClient(carstat);
    expect(out).toMatch(/^\/api\/vin\/image\?token=/);
    expect(unwrapVinImageProxyUrl(out)).toBe(carstat);
  });

  it("leaves Encar, Copart-style, and admin URLs unproxied", () => {
    expect(resolveVinPhotoUrlForClient("https://img.encar.com/cars/1.jpg")).toBe(
      "https://img.encar.com/cars/1.jpg",
    );
    expect(resolveVinPhotoUrlForClient("https://vis.iaai.com/resizer?image=1.jpg")).toBe(
      "https://vis.iaai.com/resizer?image=1.jpg",
    );
    expect(resolveVinPhotoUrlForClient("https://images.example-server.net/vehicle/front.jpg")).toBe(
      "https://images.example-server.net/vehicle/front.jpg",
    );
  });

  it("unwraps leftover non-Carstat proxy paths", () => {
    const encar = "https://img.encar.com/cars/1.jpg";
    const proxied = buildImageProxyUrl(encar);
    expect(resolveVinPhotoUrlForClient(proxied)).toBe(encar);
  });

  it("keeps leftover Carstat proxy paths proxied", () => {
    const carstat = "https://carstat.dev/cache/encar/2.webp";
    const proxied = buildImageProxyUrl(carstat);
    const resolved = resolveVinPhotoUrlForClient(proxied);
    expect(resolved).toMatch(/^\/api\/vin\/image\?token=/);
    expect(unwrapVinImageProxyUrl(resolved)).toBe(carstat);
  });
});

describe("transformVinPhotoData", () => {
  it("proxies Carstat gallery/thumbs (card width) and leaves other sources direct", () => {
    const encar = "https://img.encar.com/cars/1.jpg";
    const hd = "https://img.encar.com/cars/1-hd.jpg";
    const carstat = "https://i2.carstat.dev/copart/1.webp";
    const carstatHd = "https://i2.carstat.dev/copart/1-hd.webp";
    const out = transformVinPhotoData({
      photos: [encar, carstat],
      photosHd: [hd, carstatHd],
      thumbnailUrl: carstat,
      photoAlternates: [encar, carstat],
    }) as {
      photos: string[];
      photosHd: string[];
      thumbnailUrl: string;
      photoAlternates: Array<string | null>;
    };

    expect(out.photos[0]).toBe(encar);
    expect(out.photos[1]).toMatch(/^\/api\/vin\/image\?token=/);
    expect(out.photos[1]).toContain("&w=960");

    expect(out.photosHd[0]).toBe(hd);
    expect(out.photosHd[1]).toMatch(/^\/api\/vin\/image\?token=/);
    expect(out.photosHd[1]).not.toContain("&w=");

    expect(out.thumbnailUrl).toMatch(/^\/api\/vin\/image\?token=/);
    expect(out.thumbnailUrl).toContain("&w=960");
    expect(out.photoAlternates[0]).toBe(encar);
    expect(out.photoAlternates[1]).toMatch(/^\/api\/vin\/image\?token=/);
  });
});
