import { describe, expect, it } from "vitest";
import { resolveVinPhotoUrlForClient } from "./imageProxy.js";

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
