import crypto from "crypto";

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "dev-insecure-secret-change-in-production";
  return crypto.createHash("sha256").update(`${secret}:vin-share`).digest();
}

/** Share links valid 90 days — rotate via new share-link request. */
export function signVinShareToken(vin: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const exp = Math.floor(Date.now() / 1000) + 90 * 86400;
  const plaintext = JSON.stringify({ vin: vin.toUpperCase(), exp });
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function verifyVinShareToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const key = deriveKey();
    const iv = Buffer.from(parts[0], "base64url");
    const encrypted = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
    const { vin, exp } = JSON.parse(plaintext) as { vin: string; exp: number };
    if (!vin || typeof vin !== "string") return null;
    if (Date.now() / 1000 > exp) return null;
    return vin.toUpperCase();
  } catch {
    return null;
  }
}
