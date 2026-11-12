// Hashing and random tokens (Locked decision L8). Node runtime only.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export const hmacHex = (key: string, s: string) => createHmac("sha256", key).update(s, "utf8").digest("hex");

/** n random bytes as base64url. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Hospital bearer key: "itnk_" + 32 random bytes base64url. Store only sha256Hex(key). */
export const newHospitalKey = () => `itnk_${randomToken(32)}`;

/** Constant-time comparison of two hex digests of equal length. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}
