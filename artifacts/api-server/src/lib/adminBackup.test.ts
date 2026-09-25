import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://localhost:5432/verifykm_test";
});

import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  validateBackupPayload,
} from "./adminBackup.js";

function emptyTables(): Record<string, unknown[]> {
  const tables: Record<string, unknown[]> = {};
  for (const spec of BACKUP_TABLES) tables[spec.key] = [];
  return tables;
}

describe("adminBackup validateBackupPayload", () => {
  it("accepts a minimal valid backup", () => {
    const result = validateBackupPayload({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: "2026-09-23T12:00:00.000Z",
      tables: emptyTables(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.counts.users).toBe(0);
      expect(Object.keys(result.counts).length).toBe(BACKUP_TABLES.length);
    }
  });

  it("rejects wrong format/version", () => {
    expect(
      validateBackupPayload({
        format: "other",
        version: BACKUP_VERSION,
        exportedAt: "2026-09-23T12:00:00.000Z",
        tables: emptyTables(),
      }).ok,
    ).toBe(false);

    expect(
      validateBackupPayload({
        format: BACKUP_FORMAT,
        version: 999,
        exportedAt: "2026-09-23T12:00:00.000Z",
        tables: emptyTables(),
      }).ok,
    ).toBe(false);
  });

  it("rejects missing tables and non-array rows", () => {
    const tables = emptyTables();
    delete tables.users;
    expect(
      validateBackupPayload({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: "2026-09-23T12:00:00.000Z",
        tables,
      }).ok,
    ).toBe(false);

    const bad = emptyTables();
    bad.users = "nope" as unknown as unknown[];
    expect(
      validateBackupPayload({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: "2026-09-23T12:00:00.000Z",
        tables: bad,
      }).ok,
    ).toBe(false);
  });

  it("keeps insert order with users before lookups/payments children", () => {
    const keys = BACKUP_TABLES.map((t) => t.key);
    expect(keys.indexOf("users")).toBeLessThan(keys.indexOf("payments"));
    expect(keys.indexOf("payments")).toBeLessThan(keys.indexOf("vin_lookups"));
    expect(keys.indexOf("vin_lookups")).toBeLessThan(keys.indexOf("pending_vin_check_requests"));
    expect(keys.indexOf("pending_vin_checks")).toBeLessThan(
      keys.indexOf("pending_vin_check_requests"),
    );
  });

  it("revives acquisitionCapturedAt on users restore", () => {
    const users = BACKUP_TABLES.find((t) => t.key === "users");
    expect(users?.dateColumns).toContain("acquisitionCapturedAt");
  });
});
