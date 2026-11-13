// Share codes (FR-10, NFR-05, Locked decisions L8, L9). PURE except for the random source.
// 8 characters of Crockford base32 = 40 bits. Only HMAC-SHA256(SHARE_PEPPER, code) is ever stored.
import { randomBytes } from "node:crypto";
import { hmacHex } from "@/lib/crypto";

/** Crockford base32: no I, L, O, U. 32 symbols, so `byte & 31` is unbiased. */
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_LENGTH = 8;

function randomChars(n: number): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}

/** A fresh code, 8 characters, unformatted. */
export const generateCode = () => randomChars(CODE_LENGTH);

/** A hospital link reference: "ITN-LNK-" + 8 characters (L9). */
export const generateLinkRef = () => `ITN-LNK-${randomChars(CODE_LENGTH)}`;

/** Display form: XXXX-XXXX. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Typed input -> canonical: uppercase, drop spaces and hyphens, O to 0, I and L to 1. */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

/** Exactly 8 characters from the alphabet. Checked before any lookup. */
export const isPlausibleCode = (normalised: string) => new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(normalised);

/** What is stored: HMAC-SHA256(pepper, normalised code), hex. The pepper comes from SHARE_PEPPER. */
export const hashCode = (normalised: string, pepper: string) => hmacHex(pepper, normalised);
