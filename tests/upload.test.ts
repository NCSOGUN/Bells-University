// C06 upload checks that run before any database or storage call (R1 S-02, NFR-01).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sniffMime } from "@/lib/documents/sniff";
import { uploadDocument, type Deps } from "@/lib/documents/service";

const FIX = path.join("tools", "fixtures");
const fixture = (ext: string) => {
  const f = readdirSync(FIX).find((n) => n.endsWith(ext))!;
  return new Uint8Array(readFileSync(path.join(FIX, f)));
};

/** Deps that fail the test if the upload gets as far as the database or storage. */
const untouchable = new Proxy({} as Deps, {
  get: () => {
    throw new Error("the upload reached the database or storage");
  },
});

const input = (mime: string, bytes: Uint8Array) => ({
  recordId: "00000000-0000-4000-8000-000000000001",
  clientUploadId: "00000000-0000-4000-8000-000000000002",
  mime,
  bytes,
});

describe("sniffMime", () => {
  it("recognises the real fixtures", () => {
    expect(sniffMime(fixture(".jpg"))).toBe("image/jpeg");
    expect(sniffMime(fixture(".pdf"))).toBe("application/pdf");
  });

  it("recognises a PNG signature", () => {
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
  });

  it("finds a PDF header within the first 1024 bytes, not beyond", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n");
    const early = new Uint8Array(20 + pdf.length);
    early.set(pdf, 20);
    expect(sniffMime(early)).toBe("application/pdf");
    const late = new Uint8Array(1100 + pdf.length);
    late.set(pdf, 1100);
    expect(sniffMime(late)).toBeNull();
  });

  it("refuses HTML, SVG and empty input", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(sniffMime(enc("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(enc('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffMime(new Uint8Array(0))).toBeNull();
  });
});

describe("uploadDocument refuses before touching the database or storage", () => {
  it("a file whose bytes do not match its declared type is 400 unsupported_type", async () => {
    const html = new TextEncoder().encode("<!doctype html><p>not an image</p>");
    const r = await uploadDocument(input("image/png", html), untouchable);
    expect(r).toMatchObject({ ok: false, status: 400, code: "unsupported_type" });
  });

  it("a real JPEG declared as a PDF is refused", async () => {
    const r = await uploadDocument(input("application/pdf", fixture(".jpg")), untouchable);
    expect(r).toMatchObject({ ok: false, status: 400, code: "unsupported_type" });
  });

  it("an undeclared type, an oversized image and an empty file keep their existing answers", async () => {
    expect(await uploadDocument(input("text/html", fixture(".jpg")), untouchable)).toMatchObject({ status: 400, code: "unsupported_type" });
    expect(await uploadDocument(input("image/jpeg", new Uint8Array(1_048_577)), untouchable)).toMatchObject({ status: 413, code: "file_too_large" });
    expect(await uploadDocument(input("image/jpeg", new Uint8Array(0)), untouchable)).toMatchObject({ status: 400, code: "invalid_request" });
  });
});
