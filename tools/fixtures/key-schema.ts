// Answer-key shape for the Prep B extraction test (P1 defines it; P2's harness reads it).
// Fixtures and keys must be SYNTHETIC. No real patient data anywhere (hard rule 8).
import { z } from "zod";

export const keyItemSchema = z.object({
  kind: z.enum(["lab", "medication", "allergy", "diagnosis", "referral"]),
  label: z.string(),
  value: z.string().nullable(),
  unit: z.string().nullable(),
  range: z.string().nullable(),
  readable: z.boolean(),
  /** True for every medication, allergy and lab value: a wrong one presented as confident is critical (NFR-15). */
  critical: z.boolean(),
});

export const fixtureKeySchema = z.object({
  id: z.string(),
  file: z.string(),
  doc_type: z.enum(["lab_report", "prescription", "referral_letter", "other"]),
  facility: z.string().nullable(),
  document_date: z.string().nullable(),
  items: z.array(keyItemSchema),
  referral: z
    .object({ reason: z.string(), urgency: z.string(), clinician: z.string() })
    .nullable(),
});

export type KeyItem = z.infer<typeof keyItemSchema>;
export type FixtureKey = z.infer<typeof fixtureKeySchema>;
