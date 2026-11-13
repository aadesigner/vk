import { describe, expect, it } from "vitest";
import {
  isCarstatIllustrativeDemoPayload,
  photoMatchesVehicleMake,
  resolveCarstatReportPhotos,
  stockPhotoPathForMakeModel,
} from "./carstatDemoPhotos.js";

describe("carstatDemoPhotos", () => {
  it("detects illustrative demo payloads", () => {
    expect(
      isCarstatIllustrativeDemoPayload({
        example_note: "FREE DEMONSTRATION. Photographs are illustrative.",
      }),
    ).toBe(true);
    expect(isCarstatIllustrativeDemoPayload({ vin: "7FARW2H56JE022576" })).toBe(false);
  });

  it("maps Honda CR-V to stock art", () => {
    expect(stockPhotoPathForMakeModel("Honda", "CR-V")).toBe("/demo-cars/honda-crv.jpg");
  });

  it("rejects Jeep demo media on Honda reports", () => {
    const jeep =
      "https://v-h-r.b-cdn.net/vhr/media/017760110fc426b7d79008da1c0427467829a05cd60dcfdb3ca4a5a9a0b39f42.webp";
    expect(photoMatchesVehicleMake(jeep, "Honda")).toBe(false);
    expect(photoMatchesVehicleMake(jeep, "Jeep")).toBe(true);
  });

  it("replaces illustrative demo collage with stock", () => {
    const jeep =
      "https://v-h-r.b-cdn.net/vhr/media/017760110fc426b7d79008da1c0427467829a05cd60dcfdb3ca4a5a9a0b39f42.webp";
    const out = resolveCarstatReportPhotos({
      photos: [jeep],
      photosHd: [jeep],
      make: "Honda",
      model: "CR-V",
      illustrativeDemo: true,
    });
    expect(out.photos).toEqual(["/demo-cars/honda-crv.jpg"]);
    expect(out.photosHd).toEqual(["/demo-cars/honda-crv.jpg"]);
  });

  it("strips misattributed media on live reports and falls back to stock", () => {
    const jeep =
      "https://v-h-r.b-cdn.net/vhr/media/0d61f374ace5f42d797b32d1a5d778ed5d32141eb814a58eaa4260951c6d4069.webp";
    const out = resolveCarstatReportPhotos({
      photos: [jeep],
      photosHd: [jeep],
      make: "Honda",
      model: "CR-V",
      illustrativeDemo: false,
    });
    expect(out.photos).toEqual(["/demo-cars/honda-crv.jpg"]);
  });
});
