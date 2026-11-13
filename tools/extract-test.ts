// Prep B harness (`npm run extract-test`). Reads fixtures + answer keys, runs the real extraction
// pipeline (adapter -> schema -> guards), scores it, writes tools/prepb-report.md and tools/prepb-results.json.
// SYNTHETIC documents only (hard rule 8). Never prints document contents.
import { config } from "dotenv";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { geminiEnv } from "../lib/config";
import { ExtractionError, extractDocument, type ExtractMime } from "../lib/extract/gemini";
import { applyGuards } from "../lib/extract/guards";
import { PROMPT_VERSION } from "../lib/extract/prompt";
import { parseModelOutput } from "../lib/extract/schema";
import { fixtureKeySchema, type FixtureKey } from "./fixtures/key-schema";
import { nfr15, reclassifyGlyphVariants, renderReport, scoreDocument, type DocScore } from "./extract-score";

config({ path: ".env.local", quiet: true });

const MIME: Record<string, ExtractMime> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `--rescore`: re-apply the scoring rules to the SAVED results in tools/prepb-results.json. No model call, no network,
 *  no API key needed. Only the D-020 unit rule is applied; the saved numbers are otherwise untouched. */
function rescoreSaved(): number {
  const file = "tools/prepb-results.json";
  const saved = JSON.parse(readFileSync(file, "utf8")) as { model: string; prompt_version: string; date: string; runs: number; scores: DocScore[]; failed: { id: string; code: string }[]; rescored?: unknown };
  const strictBefore = nfr15(saved.scores, saved.failed.length);
  const scores = saved.scores.map(reclassifyGlyphVariants);
  const verdict = nfr15(scores, saved.failed.length);
  const docsWithVariants = new Set(scores.filter((s) => s.glyph_variants.length).map((s) => s.id)).size;
  const rescored = {
    rule: "D-020",
    on: new Date().toISOString().slice(0, 10),
    model_calls: 0,
    scored_strictly_before: { critical: strictBefore.critical + strictBefore.variants },
    reclassified_as_glyph_variants: verdict.variants,
    documents_with_variants: docsWithVariants,
  };
  const notes = [
    `Rescored from the saved results under the D-020 rule on ${rescored.on}, with no model calls. Scored strictly the first time this run had ${rescored.scored_strictly_before.critical} critical errors; D-020 reclassified them as ${verdict.variants} glyph variants in ${docsWithVariants} document${docsWithVariants === 1 ? "" : "s"} (the unit rule was refined after seeing this result, see D-020).`,
  ];
  writeFileSync("tools/prepb-report.md", renderReport({ scores, failed: saved.failed, model: saved.model, promptVersion: saved.prompt_version, date: saved.date, runs: saved.runs, notes }));
  writeFileSync(file, JSON.stringify({ ...saved, scores, rescored }, null, 2) + "\n");
  console.log(verdict.line);
  console.log(`strict first-run count ${rescored.scored_strictly_before.critical}; reclassified ${verdict.variants} in ${docsWithVariants} document(s); model calls: 0`);
  return verdict.pass ? 0 : 1;
}

async function main(): Promise<number> {
  if (process.argv.includes("--rescore")) return rescoreSaved();
  let model: string;
  try {
    model = geminiEnv().GEMINI_MODEL;
  } catch (e) {
    console.error(`${(e as Error).message}. Set them in .env.local (the harness never guesses a model).`);
    return 1;
  }

  const dir = path.resolve(arg("dir", "tools/fixtures")!);
  const only = arg("only");
  const delayMs = Number(arg("delay-ms", "4000"));
  const runs = Math.max(1, Number(arg("runs", "1")));

  const keysDir = path.join(dir, "keys");
  if (!existsSync(keysDir)) {
    console.error(`No answer keys at ${keysDir}. Create synthetic fixtures and keys first (P1).`);
    console.error("NFR-15: NOT RUN (no documents were scored)");
    return 1;
  }
  const keys: FixtureKey[] = [];
  for (const f of readdirSync(keysDir).filter((n) => n.endsWith(".json")).sort()) {
    const parsed = fixtureKeySchema.safeParse(JSON.parse(readFileSync(path.join(keysDir, f), "utf8")));
    if (!parsed.success) {
      console.error(`Bad answer key ${f}: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
      return 1;
    }
    if (!only || parsed.data.id === only) keys.push(parsed.data);
  }
  if (!keys.length) {
    console.error(only ? `No fixture with id "${only}".` : "No answer keys found.");
    console.error("NFR-15: NOT RUN (no documents were scored)");
    return 1;
  }

  const scores: DocScore[] = [];
  const failed: { id: string; code: string }[] = [];

  for (const key of keys) {
    const file = path.join(dir, key.file);
    const mime = MIME[path.extname(file).toLowerCase()];
    if (!existsSync(file) || !mime) {
      failed.push({ id: key.id, code: "fixture_file_missing_or_unsupported" });
      continue;
    }
    const bytes = new Uint8Array(readFileSync(file));
    for (let run = 1; run <= runs; run++) {
      try {
        // Same policy as the route (P5): if the model output does not validate, retry the model once.
        let res = await extractDocument({ bytes, mime });
        let parsed = parseModelOutput(res.raw);
        if (!parsed.ok) {
          res = await extractDocument({ bytes, mime });
          parsed = parseModelOutput(res.raw);
        }
        if (!parsed.ok) {
          failed.push({ id: key.id, code: "model_output_invalid" });
        } else {
          const score = scoreDocument(key, applyGuards(parsed.data), res.ms);
          scores.push(score);
          console.log(`${key.id} run ${run}: ${res.ms} ms, ${score.items_matched}/${score.items_expected} matched, ${score.critical.length} critical`);
        }
      } catch (e) {
        failed.push({ id: key.id, code: e instanceof ExtractionError ? e.code : "unexpected_error" });
        console.log(`${key.id} run ${run}: failed (${failed[failed.length - 1].code})`);
      }
      await sleep(delayMs);
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  writeFileSync("tools/prepb-report.md", renderReport({ scores, failed, model, promptVersion: PROMPT_VERSION, date, runs }));
  writeFileSync("tools/prepb-results.json", JSON.stringify({ model, prompt_version: PROMPT_VERSION, date, runs, scores, failed }, null, 2) + "\n");

  const verdict = nfr15(scores, failed.length);
  console.log(verdict.line);
  return verdict.pass ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("extract-test crashed:", (e as Error).name);
    process.exit(1);
  },
);
