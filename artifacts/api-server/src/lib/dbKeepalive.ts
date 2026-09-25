import { pool } from "@workspace/db";
import { logger } from "./logger.js";

/** Keep one pool client warm so idle Neon/Railway DB round-trips stay cheap after quiet periods. */
const INTERVAL_MS = 90_000;
const INITIAL_DELAY_MS = 15_000;

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function pingOnce(): Promise<void> {
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    logger.warn({ err }, "db keepalive ping failed");
  }
}

export function scheduleDbKeepalive(): void {
  if (started) return;
  started = true;
  setTimeout(() => {
    void pingOnce();
    timer = setInterval(() => void pingOnce(), INTERVAL_MS);
    // Unref so keepalive does not keep a quitting process alive (tests / graceful exit).
    if (typeof timer === "object" && timer && "unref" in timer) {
      (timer as NodeJS.Timeout).unref();
    }
  }, INITIAL_DELAY_MS);
}
