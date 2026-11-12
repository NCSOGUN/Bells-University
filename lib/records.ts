// Accounts and records (C03 server side; FR-01, FR-18, NFR-03). P4 extends this file.
import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Executor } from "./db/client";
import { account, patient_record, record_member } from "./db/schema";

/** The account row has the same id as the Supabase auth user (L3). Created on first use. */
export async function ensureAccount(userId: string, db: Executor = getDb()): Promise<void> {
  await db.insert(account).values({ id: userId }).onConflictDoNothing({ target: account.id });
}

export interface NewRecord {
  displayName: string;
  birthYear: number | null;
  isSelf: boolean;
}

/** One transaction: the record plus the caller as its holder. */
export async function createRecord(accountId: string, r: NewRecord): Promise<{ recordId: string }> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(patient_record)
      .values({ display_name: r.displayName, birth_year: r.birthYear, is_self: r.isSelf })
      .returning({ id: patient_record.id });
    await tx.insert(record_member).values({ account_id: accountId, record_id: row.id, role: "holder" });
    return { recordId: row.id };
  });
}

export interface RecordSummary {
  id: string;
  display_name: string;
  birth_year: number | null;
  is_self: boolean;
  created_at: Date;
}

export async function listRecordsForAccount(accountId: string): Promise<RecordSummary[]> {
  return getDb()
    .select({
      id: patient_record.id,
      display_name: patient_record.display_name,
      birth_year: patient_record.birth_year,
      is_self: patient_record.is_self,
      created_at: patient_record.created_at,
    })
    .from(record_member)
    .innerJoin(patient_record, eq(patient_record.id, record_member.record_id))
    .where(eq(record_member.account_id, accountId))
    .orderBy(patient_record.created_at);
}

/** Record ids the account holds. Used to build the holder Actor for can() (lib/policy.ts). */
export async function recordIdsForAccount(accountId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: record_member.record_id })
    .from(record_member)
    .where(eq(record_member.account_id, accountId));
  return rows.map((r) => r.id);
}

/** Sets account.ai_consent_at = now() only if it is not already set (NFR-03). Returns the timestamp. */
export async function recordAiConsent(accountId: string): Promise<Date> {
  const db = getDb();
  await ensureAccount(accountId, db);
  await db
    .update(account)
    .set({ ai_consent_at: new Date() })
    .where(and(eq(account.id, accountId), isNull(account.ai_consent_at)));
  const [row] = await db.select({ at: account.ai_consent_at }).from(account).where(eq(account.id, accountId));
  return row.at!;
}

export async function hasAiConsent(accountId: string): Promise<boolean> {
  const [row] = await getDb().select({ at: account.ai_consent_at }).from(account).where(eq(account.id, accountId));
  return Boolean(row?.at);
}
