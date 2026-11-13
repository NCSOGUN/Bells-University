// What a file really is, from its first bytes (C06 upload, NFR-01). PURE.
// The multipart Content-Type is chosen by the client, so the upload route checks it against the bytes.
import type { ExtractMime } from "@/lib/extract/gemini";

const startsWith = (b: Uint8Array, sig: number[]) => b.length >= sig.length && sig.every((x, i) => b[i] === x);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** The type the bytes really are, or null for anything else. A PDF header may sit anywhere in the first
 *  1024 bytes (PDF 1.7 section 7.5.2 tolerance, which common readers apply). */
export function sniffMime(bytes: Uint8Array): ExtractMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + PDF.length <= head.length; i++) {
    if (PDF.every((x, j) => head[i + j] === x)) return "application/pdf";
  }
  return null;
}
