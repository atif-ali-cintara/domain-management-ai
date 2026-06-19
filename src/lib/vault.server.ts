// Server-only AES-256-GCM encryption for credential vault values.
// Never import from client code or *.functions.ts at module scope.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ACCOUNT_VAULT_KEY;
  if (!raw) throw new Error("ACCOUNT_VAULT_KEY not configured");
  // Derive 32-byte key regardless of input length / format.
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // payload = iv | tag | ciphertext, base64
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}
