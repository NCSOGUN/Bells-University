// P1: the synthetic demo documents and their answer keys (freeze item 12). No browser, no network:
// the HTML and keys come from one spec (tools/fixtures/specs.ts) and the generated files are read from disk.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureKeySchema } from "../tools/fixtures/key-schema";
import { FIXTURES, FOOTER } from "../tools/fixtures/specs";

const DIR = path.join("tools", "fixtures");
const KEYS = path.join(DIR, "keys");
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

describe("answer keys", () => {
  it("every key file validates against the Zod schema and matches its spec", () => {
    const files = readdirSync(KEYS).filter((n) => n.endsWith(".json"));
    expect(files.length).toBe(FIXTURES.length);
    for (const f of files) {
      const parsed = fixtureKeySchema.safeParse(JSON.parse(readFileSync(path.join(KEYS, f), "utf8")));
      expect(parsed.success, f).toBe(true);
      if (parsed.success) {
        const spec = FIXTURES.find((s) => s.id === parsed.data.id);
        expect(spec, f).toBeDefined();
        expect(parsed.data, f).toEqual(spec!.key);
        expect(f).toBe(`${parsed.data.id}.json`);
      }
    }
  });

  it("ids are unique and every key's file exists", () => {
    expect(new Set(FIXTURES.map((s) => s.id)).size).toBe(FIXTURES.length);
    for (const s of FIXTURES) expect(existsSync(path.join(DIR, s.key.file)), s.key.file).toBe(true);
  });

  it("every medication, allergy and lab item is critical (a wrong confident one is a critical error, NFR-15)", () => {
    for (const s of FIXTURES)
      for (const i of s.key.items) if (["lab", "medication", "allergy"].includes(i.kind)) expect(i.critical, `${s.id} ${i.label}`).toBe(true);
  });

  it("unreadable items carry no value, unit or range", () => {
    for (const s of FIXTURES)
      for (const i of s.key.items.filter((x) => !x.readable)) expect([i.value, i.unit, i.range], `${s.id} ${i.label}`).toEqual([null, null, null]);
  });
});

describe("the documents match their keys exactly (the key cannot drift from the page)", () => {
  for (const s of FIXTURES) {
    it(`${s.id}: every readable key string is printed, character for character`, () => {
      const text = decode(s.html);
      for (const i of s.key.items.filter((x) => x.readable)) {
        for (const v of [i.label, i.value, i.unit, i.range]) if (v !== null) expect(text, `${s.id}: ${v}`).toContain(v);
      }
      if (s.key.facility) expect(text).toContain(s.key.facility);
      if (s.key.document_date) expect(text).toContain(s.key.document_date);
      if (s.key.referral) for (const v of Object.values(s.key.referral)) expect(text).toContain(v);
    });

    it(`${s.id}: carries the synthetic footer on every page`, () => {
      const pages = s.html.split('<section class="page">').length - 1;
      expect(pages).toBeGreaterThan(0);
      expect(s.html.split(FOOTER).length - 1).toBe(pages);
    });
  }

  it("a blank range column really is blank on the page (no-range fixture)", () => {
    const s = FIXTURES.find((x) => x.id === "lab-no-range-photo")!;
    expect(s.key.items.every((i) => i.range === null)).toBe(true);
    expect(s.html).not.toMatch(/\d+(\.\d+)?\s*-\s*\d+(\.\d+)?/);
  });
});

describe("coverage required by freeze item 12", () => {
  const by = (pred: (s: (typeof FIXTURES)[number]) => boolean) => FIXTURES.filter(pred);
  it("has at least six documents: two printed labs, two lab PDFs, one prescription, one referral letter", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(6);
    expect(by((s) => s.render.kind === "photo" && s.key.doc_type === "lab_report").length).toBeGreaterThanOrEqual(2);
    expect(by((s) => s.render.kind === "pdf" && s.key.doc_type === "lab_report").length).toBeGreaterThanOrEqual(2);
    expect(by((s) => s.key.doc_type === "prescription").length).toBe(1);
    expect(by((s) => s.key.doc_type === "referral_letter").length).toBe(1);
  });

  it("uses dd/mm/yyyy in at least four documents and ISO in one", () => {
    expect(by((s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s.key.document_date ?? "")).length).toBeGreaterThanOrEqual(4);
    expect(by((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.key.document_date ?? "")).length).toBeGreaterThanOrEqual(1);
  });

  it("covers the edge cases: unusual units, no range, blurred, two pages, and both HbA1c dates", () => {
    for (const id of ["lab-unusual-units-pdf", "lab-no-range-photo", "lab-blurred-photo", "lab-mixed-pdf", "lab-hba1c-2025-pdf", "lab-hba1c-2026-pdf"]) {
      expect(FIXTURES.some((s) => s.id === id), id).toBe(true);
    }
    const hb = FIXTURES.filter((s) => s.id.startsWith("lab-hba1c")).map((s) => s.key.items[0].value);
    expect(hb.sort()).toEqual(["7.4", "8.1"]);
    const unusual = FIXTURES.find((s) => s.id === "lab-unusual-units-pdf")!;
    expect(unusual.key.items.find((i) => i.label === "Haemoglobin")?.unit).toBe("g/L");
  });

  it("the prescription has three medicines and a penicillin allergy; the letter carries reason, urgency and clinician", () => {
    const rx = FIXTURES.find((s) => s.id === "rx-printed-photo")!;
    expect(rx.key.items.filter((i) => i.kind === "medication")).toHaveLength(3);
    expect(rx.key.items.find((i) => i.kind === "allergy")?.label).toBe("Penicillin");
    const letter = FIXTURES.find((s) => s.id === "referral-letter-photo")!;
    expect(letter.key.referral).toMatchObject({ reason: expect.any(String), urgency: expect.any(String), clinician: expect.any(String) });
  });
});

describe("generated files meet the app's limits and contain no real data", () => {
  it("every raster image is 500 KB or less with a long edge of 1600 px or less", async () => {
    const sharp = (await import("sharp")).default;
    for (const s of FIXTURES.filter((x) => x.render.kind === "photo")) {
      const f = path.join(DIR, s.key.file);
      expect(statSync(f).size, s.id).toBeLessThanOrEqual(500 * 1024);
      const m = await sharp(f).metadata();
      expect(Math.max(m.width ?? 0, m.height ?? 0), s.id).toBeLessThanOrEqual(1600);
    }
  });

  it("every PDF has the page count its spec implies", () => {
    for (const s of FIXTURES.filter((x) => x.render.kind === "pdf")) {
      const pdf = readFileSync(path.join(DIR, s.key.file), "latin1");
      const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(pages, s.id).toBe(s.html.split('<section class="page">').length - 1);
    }
  });

  it("names are obviously fictional: patients and clinicians are marked SYNTHETIC, hospitals SIMULATED or sample", () => {
    for (const s of FIXTURES) {
      const t = decode(s.html);
      for (const m of t.matchAll(/(?:Patient|Re|Prescriber|Requested by): ((?:Dr )?Demo [A-Za-z]+(?: \([A-Z]+\))?)/g)) expect(m[1], s.id).toMatch(/\(SYNTHETIC\)$/);
      expect(t, s.id).not.toMatch(/\b(\+?234|0[789][01])\d{7,}\b/); // no phone numbers
    }
  });
});
