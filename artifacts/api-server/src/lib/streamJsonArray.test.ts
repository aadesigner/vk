import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { forEachJsonArrayRecord } from "./streamJsonArray";

describe("forEachJsonArrayRecord", () => {
  it("streams array records without loading the full file tree", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "json-stream-"));
    const filePath = path.join(dir, "catalog.json");
    await writeFile(filePath, JSON.stringify([
      { vin: "1HGBH41JXMN109186", make: "Honda" },
      { vin: "WBAGW4107LCD28117", make: "BMW" },
    ]));

    const seen: unknown[] = [];
    const count = await forEachJsonArrayRecord(filePath, {}, async (record) => {
      seen.push(record);
    });

    expect(count).toBe(2);
    expect(seen).toHaveLength(2);
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects imports above maxRows", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "json-stream-"));
    const filePath = path.join(dir, "catalog.json");
    await writeFile(filePath, JSON.stringify([{ vin: "1" }, { vin: "2" }]));

    await expect(forEachJsonArrayRecord(filePath, { maxRows: 1 }, async () => {}))
      .rejects
      .toThrow(/1-row limit/);

    await rm(dir, { recursive: true, force: true });
  });

  it("allows an empty array (caller handles no rows)", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "json-stream-"));
    const filePath = path.join(dir, "catalog.json");
    await writeFile(filePath, "[]");

    const count = await forEachJsonArrayRecord(filePath, {}, async () => {});
    expect(count).toBe(0);

    await rm(dir, { recursive: true, force: true });
  });

  it("rejects non-array JSON roots", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "json-stream-"));
    const filePath = path.join(dir, "catalog.json");
    await writeFile(filePath, JSON.stringify({ items: [] }));

    await expect(forEachJsonArrayRecord(filePath, {}, async () => {}))
      .rejects
      .toThrow(/Expected a JSON array/);

    await rm(dir, { recursive: true, force: true });
  });
});
