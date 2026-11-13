// Drug-allergy advisory (C18; FR-17, NFR-21). PURE. A short hand-built list, NOT clinically validated.
// It only ever says "check with a doctor or pharmacist". No severity, no alternatives, no "avoid", no blocking.
import type { FactDTO } from "@/lib/facts/dto";
import type { Advisory } from "./types";

export interface AdvisoryRule {
  rule_key: string;
  allergy_aliases: string[];
  medicine_aliases: string[];
  note: string;
}

export const advisoryMessage = (allergy: string, medicine: string) =>
  `Your record lists an allergy to ${allergy} and a medicine called ${medicine}. Itan cannot tell whether this is a problem. Please check with a doctor or pharmacist. This check uses a short list that has not been clinically validated. This is not medical advice.`;

/** Words that carry no drug identity. */
const STOP = new Set(["tablet", "tablets", "capsule", "capsules", "daily", "twice", "three", "times", "once", "oral", "allergy", "allergic", "with", "from", "dose", "every", "hours", "after", "before", "food", "syrup", "injection"]);

/** Lowercase, split on anything that is not a letter. "Co-amoxiclav 625 mg" -> [co, amoxiclav, mg]. */
export const tokens = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter(Boolean);

/** Does the alias (itself tokenised, so "co-amoxiclav" works) appear as consecutive tokens in the label? */
function aliasIn(labelTokens: string[], alias: string): boolean {
  const a = tokens(alias);
  if (!a.length) return false;
  for (let i = 0; i + a.length <= labelTokens.length; i++) {
    if (a.every((t, j) => labelTokens[i + j] === t)) return true;
  }
  return false;
}

const active = (f: FactDTO) => f.superseded_by === null && !f.unreadable;

export function findAdvisories(facts: FactDTO[], rules: AdvisoryRule[]): Advisory[] {
  const allergies = facts.filter((f) => f.kind === "allergy" && active(f));
  const medicines = facts.filter((f) => f.kind === "medication" && active(f));
  const out: Advisory[] = [];

  for (const a of allergies) {
    const at = tokens(a.label_as_printed);
    for (const m of medicines) {
      const mt = tokens(m.label_as_printed);
      const rule = rules.find((r) => r.allergy_aliases.some((x) => aliasIn(at, x)) && r.medicine_aliases.some((x) => aliasIn(mt, x)));
      // A direct match: the allergy substance is itself a word in the medicine's name.
      const direct = !rule && at.some((t) => t.length >= 4 && !STOP.has(t) && mt.includes(t));
      if (!rule && !direct) continue;
      out.push({
        allergy_fact_id: a.id,
        medicine_fact_id: m.id,
        allergy_label: a.label_as_printed,
        medicine_label: m.label_as_printed,
        rule_id: rule?.rule_key ?? null,
        note: rule?.note ?? null,
        message: advisoryMessage(a.label_as_printed, m.label_as_printed),
      });
    }
  }
  return out;
}
