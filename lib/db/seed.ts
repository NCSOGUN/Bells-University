// `npm run db:seed` (C02, freeze item 8). Idempotent: upserts by natural key, safe to re-run.
// DRAFT: glossary and drug-allergy content needs review by someone with clinical knowledge (NFR-20).
// Loads: fictional facilities (FR-20), the SIMULATED hospital + one credential, the glossary, the rules.
// The hospital key is printed ONCE and written to tools/sim-hospital/.env.local (gitignored). It is never
// rotated unless `--rotate-key` is passed.
import "../../scripts/load-env";
import { and, eq, isNull, sql } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import { newHospitalKey, sha256Hex } from "../crypto";
import { closeDb, getDb } from "./client";
import { drug_allergy_rule, facility, glossary, hospital, hospital_credential } from "./schema";
import { DRUG_ALLERGY_RULES, FACILITIES, GLOSSARY, SIMULATED_HOSPITAL } from "./seed-data";

async function main() {
  const db = getDb();
  const rotate = process.argv.includes("--rotate-key");

  for (const f of FACILITIES) {
    await db
      .insert(facility)
      .values({ name: f.name, city: f.city, is_simulated: true })
      .onConflictDoUpdate({ target: facility.name, set: { city: f.city, is_simulated: true } });
  }
  console.log(`facility: ${FACILITIES.length} rows`);

  const [h] = await db
    .insert(hospital)
    .values(SIMULATED_HOSPITAL)
    .onConflictDoUpdate({ target: hospital.name, set: { simulated: true } })
    .returning();

  const active = await db
    .select({ id: hospital_credential.id })
    .from(hospital_credential)
    .where(and(eq(hospital_credential.hospital_id, h.id), isNull(hospital_credential.revoked_at)));

  if (active.length === 0 || rotate) {
    const key = newHospitalKey();
    await db.transaction(async (tx) => {
      if (rotate) {
        await tx
          .update(hospital_credential)
          .set({ revoked_at: sql`now()` })
          .where(and(eq(hospital_credential.hospital_id, h.id), isNull(hospital_credential.revoked_at)));
      }
      await tx.insert(hospital_credential).values({ hospital_id: h.id, key_hash: sha256Hex(key) });
    });
    mkdirSync("tools/sim-hospital", { recursive: true });
    writeFileSync("tools/sim-hospital/.env.local", `# SIMULATED hospital key. Never commit.\nHOSPITAL_KEY=${key}\n`);
    console.log(`hospital: "${h.name}" new key (shown once, also written to tools/sim-hospital/.env.local):`);
    console.log(`  ${key}`);
  } else {
    console.log(`hospital: "${h.name}" has an active key (not rotated; pass --rotate-key to replace it)`);
  }

  for (const g of GLOSSARY) {
    await db
      .insert(glossary)
      .values({ ...g, reviewed_by: null })
      .onConflictDoUpdate({
        target: glossary.test_key,
        set: { display_name: g.display_name, aliases: g.aliases, description: g.description, questions: g.questions },
      });
  }
  console.log(`glossary: ${GLOSSARY.length} rows`);

  for (const r of DRUG_ALLERGY_RULES) {
    await db
      .insert(drug_allergy_rule)
      .values({ ...r, reviewed_by: null })
      .onConflictDoUpdate({
        target: drug_allergy_rule.rule_key,
        set: { allergy_aliases: r.allergy_aliases, medicine_aliases: r.medicine_aliases, note: r.note },
      });
  }
  console.log(`drug_allergy_rule: ${DRUG_ALLERGY_RULES.length} rows`);
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error("db:seed failed:", (e as { code?: string }).code ?? "", (e as Error).message);
    await closeDb();
    process.exit(1);
  });
