// Glossary lookup (Locked decision L16). test_key comes from the glossary aliases; no match means null.
// FR-24 (previous value) and the explanation engine work only for facts with a test_key.
// The lookup uses the seed content in lib/db/seed-data.ts directly (the same rows the seed writes), so it is
// synchronous and needs no database: guards.ts can call it inline. See docs/DEVIATIONS.md D-008.
import { GLOSSARY, type GlossarySeed } from "./db/seed-data";

/** Lowercase, strip punctuation and whitespace. "Haemoglobin (Hb)" -> "haemoglobinhb". */
export function normaliseKey(label: string): string {
  return label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

let index: Map<string, string> | undefined;

function getIndex(): Map<string, string> {
  if (!index) {
    index = new Map();
    for (const row of GLOSSARY) {
      for (const alias of [row.test_key, row.display_name, ...row.aliases]) {
        const k = normaliseKey(alias);
        // First entry wins; aliases are written so they do not collide across tests.
        if (k && !index.has(k)) index.set(k, row.test_key);
      }
    }
  }
  return index;
}

/** Printed test label -> test_key, or null. Tries the whole label, then the part outside brackets,
 *  then the part inside: "Haemoglobin (Hb)", "Haemoglobin" and "Hb" all resolve. */
export function lookupTestKey(label: string): string | null {
  const idx = getIndex();
  const tries = [label, label.replace(/\([^)]*\)/g, " "), ...[...label.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])];
  for (const t of tries) {
    const hit = idx.get(normaliseKey(t));
    if (hit) return hit;
  }
  return null;
}

export function getGlossaryRow(testKey: string | null): GlossarySeed | null {
  if (!testKey) return null;
  return GLOSSARY.find((g) => g.test_key === testKey) ?? null;
}
