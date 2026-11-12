// C06 extraction: the shape the model must return (FR-03, FR-04, FR-05).
// The model only TRANSCRIBES. Numbers (value_num, range_low, range_high) are NOT in this schema:
// our own code derives them in guards.ts (Locked decision L17).
import { z } from "zod";

export const DOC_TYPES = [
  "lab_report",
  "prescription",
  "referral_letter",
  "discharge_summary",
  "other",
] as const;

export const ITEM_KINDS = ["lab", "medication", "allergy", "diagnosis"] as const;

/** Box on a 0 to 1000 scale: [ymin, xmin, ymax, xmax]. Format UNVERIFIED, so we accept any
 *  number array here and let guards.ts reduce a bad one to null instead of failing the parse. */
const sourceBox = z.array(z.number()).nullable();

export const extractedItemSchema = z.object({
  kind: z.enum(ITEM_KINDS),
  label_as_printed: z.string(),
  value_as_printed: z.string().nullable(),
  unit_as_printed: z.string().nullable(),
  range_as_printed: z.string().nullable(),
  flag_as_printed: z.string().nullable(),
  date_as_printed: z.string().nullable(),
  readable: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  source_quote: z.string(),
  source_box: sourceBox,
  source_page: z.number().int(),
});

/** One transcribed line of a referral letter, with where it was read. */
const writtenField = z.object({
  text: z.string(),
  source_quote: z.string(),
  source_box: sourceBox,
  source_page: z.number().int(),
});

export const referralSchema = z.object({
  reason_as_written: writtenField.nullable(),
  /** null when the letter states no urgency (Locked decision L21; never inferred). */
  urgency_as_written: writtenField.nullable(),
  referring_clinician_as_written: writtenField.nullable(),
  referral_date_as_written: writtenField.nullable(),
});

export const modelOutputSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  facility_as_printed: z.string().nullable(),
  document_date_as_printed: z.string().nullable(),
  items: z.array(extractedItemSchema),
  referral: referralSchema.nullable(),
});

export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** JSON Schema handed to Gemini as `responseJsonSchema`. Zod 4 builds it; `$schema` is removed
 *  because the Gemini structured-output docs do not list it (UNVERIFIED, tested live in P2). */
export function modelJsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(modelOutputSchema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

/** Validate whatever the model returned. Never throws. */
export function parseModelOutput(raw: unknown):
  | { ok: true; data: ModelOutput }
  | { ok: false; issues: string[] } {
  const r = modelOutputSchema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  // Paths and messages only: never echo document content (Locked decision L31).
  return { ok: false, issues: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
