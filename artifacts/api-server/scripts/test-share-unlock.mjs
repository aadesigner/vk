/**
 * Verify /api/vin/public ignores ?s= share tokens (no payment bypass).
 * Usage: node scripts/test-share-unlock.mjs [VIN] [API_BASE]
 */
import crypto from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

function signVinShareToken(vin) {
  const secret = process.env.JWT_SECRET ?? "dev-insecure-secret-change-in-production";
  const key = crypto.createHash("sha256").update(`${secret}:vin-share`).digest();
  const iv = crypto.randomBytes(12);
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const plaintext = JSON.stringify({ vin: vin.toUpperCase(), exp });
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), encrypted.toString("base64url"), tag.toString("base64url")].join(".");
}

const vin = (process.argv[2] ?? "1N6ED1EJXNN664377").toUpperCase();
const base = (process.argv[3] ?? `http://localhost:${process.env.API_PORT ?? 8090}`).replace(/\/$/, "");
const token = signVinShareToken(vin);
const url = `${base}/api/vin/public/${encodeURIComponent(vin)}?s=${encodeURIComponent(token)}`;

const res = await fetch(url, {
  headers: { Origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" },
});
const body = await res.json().catch(() => ({}));
console.log("URL:", url);
console.log("HTTP:", res.status);
console.log("isUnlocked:", body.isUnlocked);
console.log("has accidents:", Array.isArray(body.accidents) && body.accidents.length > 0);
if (body.isUnlocked) {
  console.error("FAIL: share token still unlocks public report");
  process.exit(1);
}
console.log("OK: share token does not unlock");
