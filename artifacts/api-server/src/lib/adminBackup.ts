/**
 * Full admin-area backup export / restore for migration.
 * Does not change payment provider call patterns — data only.
 * Runs only when an admin hits export/import — no background jobs.
 */
import { createGzip, createGunzip } from "zlib";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import { tmpdir } from "os";
import path from "path";
import type { Response } from "express";
import { sql, gt, asc } from "drizzle-orm";
import {
  db,
  usersTable,
  providersTable,
  pricingTable,
  systemSettingsTable,
  announcementsTable,
  couponsTable,
  vinCatalogTable,
  paymentsTable,
  vinLookupsTable,
  pendingVinChecksTable,
  pendingVinCheckRequestsTable,
  accessBlocksTable,
  userDevicesTable,
  emailLogsTable,
  systemLogsTable,
} from "@workspace/db";
import { yieldEventLoop } from "./batchAsync.js";
import { logger } from "./logger.js";

export const BACKUP_FORMAT = "verifykm-admin-backup";
export const BACKUP_VERSION = 1;
/** Transaction-scoped advisory lock — auto-releases on commit/rollback (no pool leak). */
const BACKUP_LOCK_KEY = 872_364_021;
/** Keep batches small — catalog JSONB rows can be large. */
const SELECT_BATCH = 100;
const INSERT_BATCH = 80;
/** Hard caps to protect Railway RAM (import loads JSON once into memory). */
export const BACKUP_UPLOAD_MAX_BYTES = 100 * 1024 * 1024; // 100MB gzipped upload
export const BACKUP_INFLATED_MAX_BYTES = 150 * 1024 * 1024; // 150MB plain JSON

type IdKind = "text" | "serial";

type BackupTableSpec = {
  key: string;
  pgName: string;
  table: any;
  idColumn: string;
  idKind: IdKind;
  dateColumns: string[];
};

/** Insert order (parents before children). Truncate uses the reverse. */
export const BACKUP_TABLES: BackupTableSpec[] = [
  {
    key: "users",
    pgName: "users",
    table: usersTable,
    idColumn: "id",
    idKind: "text",
    dateColumns: [
      "lastLoginAt",
      "lastSeenAt",
      "acquisitionCapturedAt",
      "createdAt",
      "updatedAt",
    ],
  },
  {
    key: "providers",
    pgName: "providers",
    table: providersTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt", "updatedAt"],
  },
  {
    key: "pricing",
    pgName: "pricing",
    table: pricingTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["updatedAt"],
  },
  {
    key: "system_settings",
    pgName: "system_settings",
    table: systemSettingsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["updatedAt"],
  },
  {
    key: "announcements",
    pgName: "announcements",
    table: announcementsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["endsAt", "createdAt"],
  },
  {
    key: "coupons",
    pgName: "coupons",
    table: couponsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["expiresAt", "createdAt", "updatedAt"],
  },
  {
    key: "vin_catalog",
    pgName: "vin_catalog",
    table: vinCatalogTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["importedAt", "updatedAt"],
  },
  {
    key: "payments",
    pgName: "payments",
    table: paymentsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt", "updatedAt"],
  },
  {
    key: "vin_lookups",
    pgName: "vin_lookups",
    table: vinLookupsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt", "updatedAt"],
  },
  {
    key: "pending_vin_checks",
    pgName: "pending_vin_checks",
    table: pendingVinChecksTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt", "updatedAt", "publishedAt"],
  },
  {
    key: "pending_vin_check_requests",
    pgName: "pending_vin_check_requests",
    table: pendingVinCheckRequestsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["notifiedAt", "createdAt"],
  },
  {
    key: "access_blocks",
    pgName: "access_blocks",
    table: accessBlocksTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt", "expiresAt"],
  },
  {
    key: "user_devices",
    pgName: "user_devices",
    table: userDevicesTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt", "lastSeenAt"],
  },
  {
    key: "email_logs",
    pgName: "email_logs",
    table: emailLogsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt"],
  },
  {
    key: "system_logs",
    pgName: "system_logs",
    table: systemLogsTable,
    idColumn: "id",
    idKind: "serial",
    dateColumns: ["createdAt"],
  },
];

export type BackupPayload = {
  format: string;
  version: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
};

export type BackupValidationOk = {
  ok: true;
  counts: Record<string, number>;
  exportedAt: string;
};

export type BackupValidationErr = {
  ok: false;
  error: string;
};

export function validateBackupPayload(raw: unknown): BackupValidationOk | BackupValidationErr {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Backup root must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return { ok: false, error: `Invalid format (expected ${BACKUP_FORMAT})` };
  }
  if (obj.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version (expected ${BACKUP_VERSION})` };
  }
  if (typeof obj.exportedAt !== "string" || !obj.exportedAt) {
    return { ok: false, error: "Missing exportedAt" };
  }
  if (!obj.tables || typeof obj.tables !== "object" || Array.isArray(obj.tables)) {
    return { ok: false, error: "Missing tables object" };
  }
  const tables = obj.tables as Record<string, unknown>;
  const counts: Record<string, number> = {};
  for (const spec of BACKUP_TABLES) {
    const rows = tables[spec.key];
    if (rows === undefined) {
      return { ok: false, error: `Missing table: ${spec.key}` };
    }
    if (!Array.isArray(rows)) {
      return { ok: false, error: `Table ${spec.key} must be an array` };
    }
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      if (!rows[i] || typeof rows[i] !== "object" || Array.isArray(rows[i])) {
        return { ok: false, error: `Table ${spec.key} has invalid row at index ${i}` };
      }
    }
    counts[spec.key] = rows.length;
  }
  return { ok: true, counts, exportedAt: obj.exportedAt };
}

function reviveDates(row: Record<string, unknown>, dateColumns: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const col of dateColumns) {
    const v = out[col];
    if (v == null) continue;
    if (v instanceof Date) continue;
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      out[col] = Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return out;
}

async function writeGzipChunk(
  gzip: ReturnType<typeof createGzip>,
  chunk: string,
): Promise<void> {
  if (gzip.write(chunk)) return;
  await new Promise<void>((resolve) => gzip.once("drain", resolve));
}

function exportAborted(res: Response): boolean {
  return Boolean(res.writableEnded || res.destroyed || res.req?.aborted);
}

async function selectBatch(
  spec: BackupTableSpec,
  after: string | number | null,
): Promise<Record<string, unknown>[]> {
  const idCol = (spec.table as any)[spec.idColumn];
  if (spec.idKind === "text") {
    const q =
      after == null
        ? db.select().from(spec.table).orderBy(asc(idCol)).limit(SELECT_BATCH)
        : db
            .select()
            .from(spec.table)
            .where(gt(idCol, String(after)))
            .orderBy(asc(idCol))
            .limit(SELECT_BATCH);
    return (await q) as Record<string, unknown>[];
  }

  const afterNum = after == null ? 0 : Number(after);
  const q = db
    .select()
    .from(spec.table)
    .where(gt(idCol, afterNum))
    .orderBy(asc(idCol))
    .limit(SELECT_BATCH);
  return (await q) as Record<string, unknown>[];
}

/** Stream a gzipped backup to the HTTP response. Batched — does not load the DB into RAM. */
export async function streamBackupExport(res: Response): Promise<{ counts: Record<string, number> }> {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="verifykm-backup-${stamp}.json.gz"`,
  );
  res.setHeader("Cache-Control", "no-store");

  const gzip = createGzip({ level: 6 });
  gzip.on("error", (err) => {
    logger.error({ err }, "backup_export_gzip_error");
    if (!res.headersSent) res.status(500).end();
    else res.destroy(err as Error);
  });
  gzip.pipe(res);

  // Stop burning DB/CPU if the admin closes the tab mid-download.
  const onClose = () => {
    try {
      gzip.destroy();
    } catch { /* ignore */ }
  };
  res.req?.once("close", onClose);

  const counts: Record<string, number> = {};
  try {
    await writeGzipChunk(
      gzip,
      `{"format":${JSON.stringify(BACKUP_FORMAT)},"version":${BACKUP_VERSION},"exportedAt":${JSON.stringify(new Date().toISOString())},"tables":{`,
    );

    for (let t = 0; t < BACKUP_TABLES.length; t++) {
      if (exportAborted(res)) {
        throw new Error("Backup export aborted by client");
      }
      const spec = BACKUP_TABLES[t]!;
      if (t > 0) await writeGzipChunk(gzip, ",");
      await writeGzipChunk(gzip, `${JSON.stringify(spec.key)}:[`);

      let count = 0;
      let after: string | number | null = null;
      let first = true;

      for (;;) {
        if (exportAborted(res)) {
          throw new Error("Backup export aborted by client");
        }
        const rows = await selectBatch(spec, after);
        if (rows.length === 0) break;
        for (const row of rows) {
          if (!first) await writeGzipChunk(gzip, ",");
          first = false;
          await writeGzipChunk(gzip, JSON.stringify(row));
          count += 1;
          after = row[spec.idColumn] as string | number;
        }
        if (rows.length < SELECT_BATCH) break;
        await yieldEventLoop();
      }

      counts[spec.key] = count;
      await writeGzipChunk(gzip, "]");
    }

    await writeGzipChunk(gzip, "}}");
    await new Promise<void>((resolve, reject) => {
      const onErr = (err: Error) => reject(err);
      gzip.once("error", onErr);
      gzip.end(() => {
        gzip.off("error", onErr);
        resolve();
      });
    });

    return { counts };
  } finally {
    res.req?.off("close", onClose);
  }
}

async function gunzipFileToJsonPath(srcPath: string): Promise<string> {
  const dest = path.join(
    tmpdir(),
    `verifykm-backup-inflated-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
  await pipeline(createReadStream(srcPath), createGunzip(), createWriteStream(dest));
  return dest;
}

export async function loadBackupFromUploadPath(
  filePath: string,
  originalName?: string,
): Promise<BackupPayload> {
  const lower = (originalName ?? filePath).toLowerCase();
  const isGz = lower.endsWith(".gz");
  let jsonPath = filePath;
  let cleanup: string | null = null;

  try {
    const uploadStat = await fs.stat(filePath);
    if (uploadStat.size > BACKUP_UPLOAD_MAX_BYTES) {
      throw new Error(
        `Backup upload too large (max ${Math.round(BACKUP_UPLOAD_MAX_BYTES / (1024 * 1024))}MB)`,
      );
    }

    if (isGz) {
      jsonPath = await gunzipFileToJsonPath(filePath);
      cleanup = jsonPath;
    }
    const stat = await fs.stat(jsonPath);
    if (stat.size > BACKUP_INFLATED_MAX_BYTES) {
      throw new Error(
        `Backup JSON is too large after decompression (max ${Math.round(BACKUP_INFLATED_MAX_BYTES / (1024 * 1024))}MB)`,
      );
    }
    const text = await fs.readFile(jsonPath, "utf8");
    // Drop inflated temp ASAP so we don't hold file + string + object longer than needed.
    if (cleanup) {
      await fs.unlink(cleanup).catch(() => undefined);
      cleanup = null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Backup file is not valid JSON");
    }
    const validation = validateBackupPayload(parsed);
    if (!validation.ok) throw new Error(validation.error);
    return parsed as BackupPayload;
  } finally {
    if (cleanup) {
      await fs.unlink(cleanup).catch(() => undefined);
    }
  }
}

function readLockOk(lockRows: unknown): boolean {
  if (Array.isArray(lockRows)) {
    const row = lockRows[0] as { ok?: boolean } | undefined;
    return Boolean(row?.ok);
  }
  const withRows = lockRows as { rows?: Array<{ ok?: boolean }> };
  return Boolean(withRows.rows?.[0]?.ok);
}

/**
 * Full replace restore. Validates first; truncates + inserts in one transaction.
 * Uses transaction-scoped advisory lock (no leaked session locks on the pool).
 */
export async function restoreBackupPayload(
  payload: BackupPayload,
): Promise<{ counts: Record<string, number> }> {
  const validation = validateBackupPayload(payload);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const counts: Record<string, number> = {};

  await db.transaction(async (tx) => {
    const lockRows = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${BACKUP_LOCK_KEY}) AS ok`,
    );
    if (!readLockOk(lockRows)) {
      throw new Error("Another backup restore is already running. Try again shortly.");
    }

    await tx.execute(sql`SET LOCAL statement_timeout = '600000'`);
    await tx.execute(sql`SET LOCAL lock_timeout = '30000'`);

    const truncateList = [...BACKUP_TABLES].reverse().map((t) => t.pgName).join(", ");
    await tx.execute(sql.raw(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`));

    for (const spec of BACKUP_TABLES) {
      const rawRows = (payload.tables[spec.key] ?? []) as Record<string, unknown>[];
      counts[spec.key] = rawRows.length;
      if (rawRows.length === 0) continue;

      for (let i = 0; i < rawRows.length; i += INSERT_BATCH) {
        const chunk = rawRows
          .slice(i, i + INSERT_BATCH)
          .map((row) => reviveDates(row, spec.dateColumns));
        await tx.insert(spec.table).values(chunk as any);
        if (i > 0 && i % (INSERT_BATCH * 4) === 0) await yieldEventLoop();
      }
    }

    for (const spec of BACKUP_TABLES) {
      if (spec.idKind !== "serial") continue;
      await tx.execute(
        sql.raw(`
          SELECT setval(
            pg_get_serial_sequence('${spec.pgName}', 'id'),
            COALESCE((SELECT MAX(id) FROM ${spec.pgName}), 1),
            true
          )
        `),
      );
    }
  });

  return { counts };
}
