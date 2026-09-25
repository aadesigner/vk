import pino from "pino";
import PinoPretty from "pino-pretty";
import { Writable } from "stream";
import { db, systemLogsTable } from "@workspace/db";

const isProduction = process.env.NODE_ENV === "production";

const DB_LOG_MESSAGE_MAX = isProduction ? 500 : 2000;
const DB_LOG_CONTEXT_MAX = isProduction ? 1500 : 8000;

/** HTTP access lines are noisy and not useful in the admin log viewer. */
const DB_LOG_SKIP_MSGS = new Set([
  "request completed",
  "request errored",
]);

/**
 * Writable stream that parses pino NDJSON lines and fire-and-forgets inserts
 * into system_logs. Production stores errors only; dev stores info+.
 */
class DbLogStream extends Writable {
  private _buf = "";
  private static readonly MAX_BUF = 64 * 1024;

  override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: () => void): void {
    this._buf += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    if (this._buf.length > DbLogStream.MAX_BUF) {
      this._buf = this._buf.slice(-DbLogStream.MAX_BUF);
    }
    let nl = this._buf.indexOf("\n");
    while (nl !== -1) {
      const line = this._buf.slice(0, nl).trim();
      this._buf = this._buf.slice(nl + 1);
      if (line) this._parseLine(line);
      nl = this._buf.indexOf("\n");
    }
    cb();
  }

  private _parseLine(line: string): void {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const numLevel = Number(obj.level ?? 0);
      if (numLevel < 30) return; // skip debug / trace
      const dbLevel = numLevel >= 50 ? "error" : numLevel >= 40 ? "warn" : "info";
      if (isProduction && dbLevel !== "error") return;
      const message = String(obj.msg ?? "").slice(0, DB_LOG_MESSAGE_MAX);
      if (!message || DB_LOG_SKIP_MSGS.has(message)) return;
      const { level: _l, msg: _m, time: _t, pid: _p, hostname: _h, v: _v, req: _req, res: _res, responseTime: _rt, ...context } = obj;
      const hasCtx = Object.keys(context).length > 0;
      db.insert(systemLogsTable).values({
        level: dbLevel,
        message,
        context: hasCtx ? JSON.stringify(context).slice(0, DB_LOG_CONTEXT_MAX) : undefined,
      }).catch(() => {});
    } catch { /* ignore malformed lines */ }
  }
}

const dbStream = new DbLogStream();

const prettyStream = isProduction
  ? (process.stdout as unknown as { write(msg: string): void })
  : (PinoPretty({ colorize: true }) as unknown as { write(msg: string): void });

/** Production: errors only in DB. Dev: warn+ (info still goes to terminal via pretty stream). */
const dbLogLevel = isProduction ? "error" : "warn";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
  },
  pino.multistream([
    { stream: prettyStream },
    { stream: dbStream as unknown as { write(msg: string): void }, level: dbLogLevel },
  ]),
);
