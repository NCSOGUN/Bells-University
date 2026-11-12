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
import { nfr15, renderReport, scoreDocument, type DocScore } from "./extract-score";

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

async function main(): Promise<number> {
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

  const verdict = nfr15(scores);
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
