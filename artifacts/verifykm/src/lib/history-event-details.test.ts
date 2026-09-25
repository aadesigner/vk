import { describe, expect, it } from "vitest";
import { ensureExpandableDetails, splitColonTitle } from "./history-event-details";

describe("splitColonTitle", () => {
  it("splits license plate and diagnosis titles", () => {
    expect(splitColonTitle("License plate: 12가3456")).toEqual({
      title: "License plate",
      label: "License plate",
      value: "12가3456",
    });
    expect(splitColonTitle("Diagnosis: Engine OK")).toEqual({
      title: "Diagnosis",
      label: "Diagnosis",
      value: "Engine OK",
    });
  });

  it("ignores URLs", () => {
    expect(splitColonTitle("Photo: https://cdn.example.com/a.jpg")).toBeNull();
  });
});

describe("ensureExpandableDetails", () => {
  it("keeps provider details when present", () => {
    const out = ensureExpandableDetails({
      title: "Car inspection completed",
      details: [{ label: "Inspection station", value: "Seoul" }],
      date: "2024-06-11",
    });
    expect(out.details).toEqual([{ label: "Inspection station", value: "Seoul" }]);
  });

  it("synthesizes details from date when none exist", () => {
    const out = ensureExpandableDetails({
      title: "Korean performance inspection",
      date: "2023-05-01",
    });
    expect(out.title).toBe("Korean performance inspection");
    expect(out.details.some((d) => d.label === "Date" && d.value === "2023-05-01")).toBe(true);
  });

  it("splits colon titles into expandable rows", () => {
    const out = ensureExpandableDetails({
      title: "License plate: 서울12가3456",
      date: "2022-01-01",
    });
    expect(out.title).toBe("License plate");
    expect(out.details[0]).toEqual({ label: "License plate", value: "서울12가3456" });
  });
});
