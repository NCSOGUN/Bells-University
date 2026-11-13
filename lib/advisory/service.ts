// GET advisories for a record (FR-17). Read-only and non-blocking: no other route depends on this one.
import { getDb, type Db } from "@/lib/db/client";
import { listActiveFacts } from "@/lib/facts/queries";
import { loadRules } from "./queries";
import { findAdvisories } from "./rules";

export async function getAdvisories(recordId: string, db: Db = getDb()) {
  const [facts, rules] = await Promise.all([listActiveFacts(recordId, db), loadRules(db)]);
  return { advisories: findAdvisories(facts, rules), validated: false as const };
}
