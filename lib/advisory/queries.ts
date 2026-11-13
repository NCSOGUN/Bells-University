// SQL for the advisory rules. Reads only: the advisory never changes any state (NFR-21).
import { getDb, type Executor } from "@/lib/db/client";
import { drug_allergy_alias, drug_allergy_rule } from "@/lib/db/schema";
import type { AdvisoryRule } from "./rules";

export async function loadRules(db: Executor = getDb()): Promise<AdvisoryRule[]> {
  const [rules, aliases] = await Promise.all([db.select().from(drug_allergy_rule), db.select().from(drug_allergy_alias)]);
  return rules.map((r) => ({
    rule_key: r.rule_key,
    note: r.note,
    allergy_aliases: aliases.filter((a) => a.rule_id === r.id && a.role === "allergy").map((a) => a.alias),
    medicine_aliases: aliases.filter((a) => a.rule_id === r.id && a.role === "medicine").map((a) => a.alias),
  }));
}
