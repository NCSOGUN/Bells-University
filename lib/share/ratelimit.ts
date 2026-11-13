// Rate limit on code guesses (NFR-05, Locked decisions L8, L10). PURE helpers; the SQL is in queries.ts.
// 5 failed tries per hashed IP per 10 minutes, then 429 and the code is not even checked.
import { RATE_LIMIT_FAILS } from "@/lib/config";
import { hmacHex } from "@/lib/crypto";

export const isRateLimited = (failedCountInWindow: number) => failedCountInWindow >= RATE_LIMIT_FAILS;

/** First entry of x-forwarded-for, else x-real-ip, else "unknown" (L8). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || headers.get("x-real-ip")?.trim() || "unknown";
}

/** The raw IP is never stored: HMAC-SHA256(pepper, ip). */
export const hashIp = (ip: string, pepper: string) => hmacHex(pepper, ip);
