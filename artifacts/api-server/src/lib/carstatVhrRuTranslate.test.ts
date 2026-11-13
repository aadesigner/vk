import { describe, expect, it } from "vitest";
import {
  containsCyrillic,
  containsHangul,
  translateKoToEn,
  translateNormalizedReportRuToEn,
  translateRuToEn,
  translateVhrJsonRuToEn,
} from "./carstatVhrRuTranslate.js";

describe("carstatVhrRuTranslate", () => {
  it("detects Cyrillic", () => {
    expect(containsCyrillic("Белый")).toBe(true);
    expect(containsCyrillic("White")).toBe(false);
  });

  it("translates known fuel / color / ownership phrases", () => {
    expect(translateRuToEn("Неэтилированный бензин")).toBe("Unleaded gasoline");
    expect(translateRuToEn("Белый")).toBe("White");
    expect(translateRuToEn("Смена владельца")).toBe("Change of Owner");
    expect(translateRuToEn("Первичная регистрация")).toBe("Initial registration");
    expect(translateRuToEn("Gasoline")).toBe("Gasoline");
  });

  it("translates KR option packages / body type from Carstat RU dumps", () => {
    expect(translateRuToEn("4-дверный седан")).toBe("4-door sedan");
    expect(translateRuToEn("Экспортная декларация")).toBe("Export declaration");
    expect(translateRuToEn("Сиденья из искусственной кожи")).toBe("Artificial leather seats");
    expect(translateRuToEn("пакет Display Audio")).toBe("Display Audio package");
    expect(translateRuToEn("смарт-ключ")).toBe("Smart key");
    expect(translateRuToEn("Навигация (неподтверждено)")).toBe("Navigation (unconfirmed)");
    expect(translateRuToEn("пакет Hyundai SmartSense I (не подтверждено)")).toMatch(
      /Hyundai SmartSense I package \(unconfirmed\)/i,
    );
    expect(translateRuToEn("система обнаружения слепых зон (BSD)")).toMatch(/Blind-spot/i);
    expect(translateRuToEn("Electricпривод багажника")).toMatch(/Electric.*trunk drive/i);
  });

  it("translates Cyrillic on already-normalized report blobs", () => {
    const out = translateNormalizedReportRuToEn({
      bodyType: "4-дверный седан",
      vehicleExtras: [
        { key: "x", label: "Экспортная декларация", value: "Сиденья из искусственной кожи" },
      ],
      mileageHistory: [{ date: "2024-01-01", odometer: 132000, source: "Экспортная декларация" }],
      photos: ["https://example.com/a.jpg"],
    });
    expect(out.bodyType).toBe("4-door sedan");
    expect(out.vehicleExtras?.[0]?.label).toBe("Export declaration");
    expect(out.vehicleExtras?.[0]?.value).toBe("Artificial leather seats");
    expect(out.mileageHistory?.[0]?.source).toBe("Export declaration");
    expect(out.photos?.[0]).toBe("https://example.com/a.jpg");
  });

  it("walks nested VHR-like payloads", () => {
    const out = translateVhrJsonRuToEn({
      source: {
        id: 68,
        sections: [
          {
            type: "korean_insurance",
            items: [
              {
                korea_section: "export_declaration",
                data: {
                  data: {
                    fuel_name: "Неэтилированный бензин",
                    color_name: "Белый",
                    model_name: "Avante",
                  },
                },
              },
              {
                korea_section: "ownership",
                data: {
                  owner_changes: [{ type: "Смена владельца", date: "2025-12-24" }],
                },
              },
            ],
          },
        ],
      },
    });
    const exportData = (out as any).source.sections[0].items[0].data.data;
    expect(exportData.fuel_name).toBe("Unleaded gasoline");
    expect(exportData.color_name).toBe("White");
    expect(exportData.model_name).toBe("Avante");
    expect((out as any).source.sections[0].items[1].data.owner_changes[0].type).toBe(
      "Change of Owner",
    );
  });

  it("translates Korean inspection summary boilerplate", () => {
    expect(containsHangul("조수석휀다")).toBe(true);
    expect(containsHangul("Issue")).toBe(false);
    const out = translateKoToEn(
      "비금속또는 탈부착 가능부품은 점검사항에서 제외되며 중고차특성상 부분판금도색부식은 있을수 있습니다.조수석휀다브라켓교환",
    );
    expect(out).not.toMatch(/[가-힣]/);
    expect(out).toMatch(/Non-metal or detachable parts/i);
    expect(out).toMatch(/Passenger-side fender bracket replaced/i);
  });
});
