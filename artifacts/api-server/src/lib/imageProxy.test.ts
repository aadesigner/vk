import { describe, expect, it } from "vitest";
import {
  parseVinImageWidth,
  resolveVinPhotoUrlForClient,
  transformVinPhotoData,
  withVinImageDisplayWidth,
} from "./imageProxy.js";

describe("resolveVinPhotoUrlForClient", () => {
  it("proxies allowlisted provider hosts", () => {
    const out = resolveVinPhotoUrlForClient("https://img.encar.com/cars/1.jpg");
    expect(out).toMatch(/^\/api\/vin\/image\?token=/);
  });

  it("passes through non-allowlisted admin URLs unchanged", () => {
    const url = "https://images.example-server.net/vehicle/front.jpg";
    expect(resolveVinPhotoUrlForClient(url)).toBe(url);
  });

  it("keeps existing proxy paths", () => {
    const path = "/api/vin/image?token=abc";
    expect(resolveVinPhotoUrlForClient(path)).toBe(path);
  });
});

describe("vin image display width", () => {
  it("only allows card widths", () => {
    expect(parseVinImageWidth("960")).toBe(960);
    expect(parseVinImageWidth("100")).toBeNull();
    expect(parseVinImageWidth("abc")).toBeNull();
  });

  it("appends w= once", () => {
    const once = withVinImageDisplayWidth("/api/vin/image?token=abc");
    expect(once).toBe("/api/vin/image?token=abc&w=960");
    expect(withVinImageDisplayWidth(once)).toBe(once);
  });

  it("sizes hero photos but not HD lightbox photos", () => {
    const out = transformVinPhotoData({
      photos: ["https://img.encar.com/cars/1.jpg"],
      photosHd: ["https://img.encar.com/cars/1-hd.jpg"],
    }) as { photos: string[]; photosHd: string[] };
    expect(out.photos[0]).toContain("&w=960");
    expect(out.photosHd[0]).not.toContain("&w=");
  });
});
