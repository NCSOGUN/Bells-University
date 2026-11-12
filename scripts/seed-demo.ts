// `npm run db:seed:demo`: the SYNTHETIC demo record. Everything here is invented (hard rule 8).
// Creates (or reuses) the Supabase auth user demo@itan.example with DEMO_PASSWORD, its account, one record,
// and confirmed ai_read facts with a 'created' and a 'confirmed' fact_event each. Idempotent: if the record
// already exists, nothing is inserted again. Deliberately NO referral fact (P9 demo: reason/urgency MISSING).
import "./load-env";
import { and, eq } from "drizzle-orm";
import { env } from "../lib/config";
import { closeDb, getDb } from "../lib/db/client";
import { fact, fact_event, patient_record, record_member, type NewFact } from "../lib/db/schema";
import { parseDate } from "../lib/extract/dates";
import { parseRange, parseValueNum } from "../lib/extract/numbers";
import { lookupTestKey } from "../lib/glossary";
import { createRecord, ensureAccount } from "../lib/records";
import { serviceClient } from "../lib/supabase";

const DEMO_EMAIL = "demo@itan.example";
const DEMO_RECORD = "Demo Patient (SYNTHETIC)";
const LAB = "Sample Diagnostics Laboratory";

type DemoFact = Pick<NewFact, "kind" | "label_as_printed" | "value_as_printed" | "unit_as_printed" | "range_as_printed" | "fact_date_as_printed" | "source_quote" | "sensitive_category" | "facility_name">;

const FACTS: DemoFact[] = [
  { kind: "lab", label_as_printed: "Haemoglobin", value_as_printed: "9.8", unit_as_printed: "g/dL", range_as_printed: "12.0 - 16.0", fact_date_as_printed: "03/11/2026", source_quote: "Haemoglobin 9.8 g/dL 12.0 - 16.0", facility_name: LAB },
  { kind: "lab", label_as_printed: "HbA1c", value_as_printed: "8.1", unit_as_printed: "%", range_as_printed: "4.0 - 5.6", fact_date_as_printed: "14/05/2026", source_quote: "HbA1c 8.1 % 4.0 - 5.6", facility_name: LAB },
  { kind: "lab", label_as_printed: "HbA1c", value_as_printed: "7.4", unit_as_printed: "%", range_as_printed: "4.0 - 5.6", fact_date_as_printed: "03/11/2026", source_quote: "HbA1c 7.4 % 4.0 - 5.6", facility_name: LAB },
  { kind: "lab", label_as_printed: "Fasting blood glucose", value_as_printed: "7.2", unit_as_printed: "mmol/L", range_as_printed: "3.9 - 5.5", fact_date_as_printed: "03/11/2026", source_quote: "Fasting blood glucose 7.2 mmol/L 3.9 - 5.5", facility_name: LAB },
  { kind: "allergy", label_as_printed: "Penicillin", value_as_printed: "Rash", unit_as_printed: null, range_as_printed: null, fact_date_as_printed: "20/01/2026", source_quote: "Allergy: Penicillin (Rash)", facility_name: "Demo General Hospital (SIMULATED)" },
  { kind: "medication", label_as_printed: "Amoxicillin 500 mg", value_as_printed: "1 capsule three times daily", unit_as_printed: null, range_as_printed: null, fact_date_as_printed: "20/01/2026", source_quote: "Amoxicillin 500 mg 1 capsule three times daily", facility_name: "Demo General Hospital (SIMULATED)" },
  { kind: "diagnosis", label_as_printed: "Type 2 diabetes mellitus", value_as_printed: null, unit_as_printed: null, range_as_printed: null, fact_date_as_printed: "14/05/2026", source_quote: "Diagnosis: Type 2 diabetes mellitus", facility_name: "Demo General Hospital (SIMULATED)" },
  { kind: "diagnosis", label_as_printed: "Anxiety disorder, on review", value_as_printed: null, unit_as_printed: null, range_as_printed: null, fact_date_as_printed: "20/01/2026", source_quote: "Anxiety disorder, on review", sensitive_category: "mental_health", facility_name: "Demo General Hospital (SIMULATED)" },
];

async function findOrCreateUser(): Promise<string> {
  const sb = serviceClient();
  const created = await sb.auth.admin.createUser({ email: DEMO_EMAIL, password: env().DEMO_PASSWORD, email_confirm: true });
  if (created.data.user) return created.data.user.id;
  // Already exists: find it (the demo project has few users, so one page is enough).
  const list = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = list.data?.users.find((x) => x.email === DEMO_EMAIL);
  if (!u) throw new Error(`could not create or find ${DEMO_EMAIL}: ${created.error?.message ?? "unknown"}`);
  return u.id;
}

async function main() {
  const userId = await findOrCreateUser();
  await ensureAccount(userId);
  const db = getDb();

  const existing = await db
    .select({ id: patient_record.id })
    .from(record_member)
    .innerJoin(patient_record, eq(patient_record.id, record_member.record_id))
    .where(and(eq(record_member.account_id, userId), eq(patient_record.display_name, DEMO_RECORD)));
  if (existing.length) {
    console.log(`demo record exists (${existing[0].id}); nothing inserted`);
    return;
  }

  const { recordId } = await createRecord(userId, { displayName: DEMO_RECORD, birthYear: 1972, isSelf: true });
  await db.transaction(async (tx) => {
    for (const f of FACTS) {
      const { low, high } = parseRange(f.range_as_printed);
      const [row] = await tx
        .insert(fact)
        .values({
          ...f,
          record_id: recordId,
          document_id: null, // no document behind demo facts; the UI must cope (has_image = false)
          origin: "ai_read",
          state: "confirmed",
          test_key: f.kind === "lab" ? lookupTestKey(f.label_as_printed) : null,
          value_num: parseValueNum(f.value_as_printed),
          range_low: low,
          range_high: high,
          fact_date: parseDate(f.fact_date_as_printed),
          confidence: "high",
          source_page: 1,
          extra: { synthetic: true },
        })
        .returning({ id: fact.id });
      await tx.insert(fact_event).values([
        { fact_id: row.id, actor_type: "system", event: "created", after: { state: "unverified" } },
        { fact_id: row.id, actor_type: "patient", actor_account_id: userId, event: "confirmed", before: { state: "unverified" }, after: { state: "confirmed" } },
      ]);
    }
  });
  console.log(`demo record created (${recordId}) with ${FACTS.length} synthetic facts; sign in as ${DEMO_EMAIL}`);
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error("db:seed:demo failed:", (e as { code?: string }).code ?? "", (e as Error).message);
    await closeDb();
    process.exit(1);
  });
