// Fact mutations (FR-06, FR-07, FR-27, FR-15 tagging). Every write is one transaction with its fact_event.
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { writeFactEvent } from "@/lib/audit";
import { sensitiveCategorySchema } from "@/lib/categories";
import { withTransaction } from "@/lib/db/client";
import { fact, type FactRow } from "@/lib/db/schema";
import { parseDate } from "@/lib/extract/dates";
import { parseRange, parseValueNum } from "@/lib/extract/numbers";
import { lookupTestKey } from "@/lib/glossary";
import { applyCorrection, type Correction } from "./correct";
import { toFactDTO, type FactDTO } from "./dto";
import { applyTransition, type LifecycleAction, type Origin, type State } from "./lifecycle";

export const addFactSchema = z.strictObject({
  record_id: z.uuid(),
  kind: z.enum(["lab", "medication", "allergy", "diagnosis", "other"]),
  label_as_printed: z.string().trim().min(1).max(200),
  value_as_printed: z.string().trim().max(200).nullable().optional(),
  unit_as_printed: z.string().trim().max(50).nullable().optional(),
  range_as_printed: z.string().trim().max(100).nullable().optional(),
  fact_date_as_printed: z.string().trim().max(50).nullable().optional(),
  sensitive_category: sensitiveCategorySchema.nullable().optional(),
});

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: 403 | 409; code: string; message: string };

/** POST /api/facts: a patient_added fact, created confirmed (the patient vouches for it). */
export async function addFact(accountId: string, input: z.infer<typeof addFactSchema>): Promise<FactDTO> {
  const value = input.value_as_printed || null;
  const range = input.range_as_printed || null;
  const datePrinted = input.fact_date_as_printed || null;
  const { low, high } = parseRange(range);
  return withTransaction(async (tx) => {
    const [row] = await tx
      .insert(fact)
      .values({
        record_id: input.record_id,
        created_by_account_id: accountId,
        origin: "patient_added",
        state: "confirmed",
        kind: input.kind,
        label_as_printed: input.label_as_printed,
        test_key: input.kind === "lab" ? lookupTestKey(input.label_as_printed) : null,
        value_as_printed: value,
        value_num: parseValueNum(value),
        unit_as_printed: input.unit_as_printed || null,
        range_as_printed: range,
        range_low: low,
        range_high: high,
        fact_date_as_printed: datePrinted,
        fact_date: parseDate(datePrinted),
        sensitive_category: input.sensitive_category ?? null,
        extra: {},
      })
      .returning();
    await writeFactEvent({ factId: row.id, actorType: "patient", actorAccountId: accountId, event: "created", after: { state: "confirmed", origin: "patient_added" } }, tx);
    return toFactDTO(row);
  });
}

const lifecycleInput = (f: FactRow) => ({ origin: f.origin as Origin, state: f.state as State, removedAt: f.removed_at });

const failTransition = (code: string): ServiceResult<never> => {
  if (code === "provider_entered_immutable") return { ok: false, status: 403, code, message: "This was sent by a hospital and cannot be changed. You can mark it as disputed." };
  if (code === "already_removed") return { ok: false, status: 409, code, message: "This fact has been removed." };
  return { ok: false, status: 409, code: "invalid_transition", message: "This change is not possible from the fact's current state." };
};

/** confirm / remove / dispute / withdraw_dispute. */
export async function transitionFact(f: FactRow, accountId: string, action: Exclude<LifecycleAction, "correct">, note?: string): Promise<ServiceResult<FactDTO>> {
  const t = applyTransition(lifecycleInput(f), action);
  if (!t.ok) return failTransition(t.code);
  const eventName = { confirm: "confirmed", remove: "removed", dispute: "disputed", withdraw_dispute: "dispute_withdrawn" }[action];
  const row = await withTransaction(async (tx) => {
    const [updated] = await tx
      .update(fact)
      .set({ state: t.newState, ...(t.removed ? { removed_at: sql`now()` } : {}) })
      .where(eq(fact.id, f.id))
      .returning();
    await writeFactEvent(
      { factId: f.id, actorType: "patient", actorAccountId: accountId, event: eventName, before: { state: f.state }, after: { state: t.newState, ...(t.removed ? { removed: true } : {}) }, note: note ?? null },
      tx,
    );
    return updated;
  });
  return { ok: true, data: toFactDTO(row) };
}

/** correct: edit printed fields, re-derive numbers, keep the original in the event (FR-07). */
export async function correctFact(f: FactRow, accountId: string, c: Correction): Promise<ServiceResult<FactDTO>> {
  const t = applyTransition(lifecycleInput(f), "correct");
  if (!t.ok) return failTransition(t.code);
  const { after, diff } = applyCorrection(f, c);
  const row = await withTransaction(async (tx) => {
    const [updated] = await tx.update(fact).set(after).where(eq(fact.id, f.id)).returning();
    await writeFactEvent(
      { factId: f.id, actorType: "patient", actorAccountId: accountId, event: "corrected", before: { ...diff.before, state: f.state }, after: { ...diff.after, state: "confirmed" } },
      tx,
    );
    return updated;
  });
  return { ok: true, data: toFactDTO(row) };
}

/** The patient's privacy tag (FR-15). Allowed on any origin; not a clinical edit, so no lifecycle change. */
export async function tagCategory(f: FactRow, accountId: string, category: string | null): Promise<ServiceResult<FactDTO>> {
  if (f.removed_at) return failTransition("already_removed");
  const row = await withTransaction(async (tx) => {
    const [updated] = await tx.update(fact).set({ sensitive_category: category }).where(eq(fact.id, f.id)).returning();
    await writeFactEvent(
      { factId: f.id, actorType: "patient", actorAccountId: accountId, event: "category_tagged", before: { sensitive_category: f.sensitive_category }, after: { sensitive_category: category } },
      tx,
    );
    return updated;
  });
  return { ok: true, data: toFactDTO(row) };
}
