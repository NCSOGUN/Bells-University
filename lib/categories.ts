// Sensitive categories a patient can tag a fact with (Locked decision L6, FR-15).
// Fixed list. The same values are enforced by a CHECK constraint on fact.sensitive_category.
import { z } from "zod";

export const SENSITIVE_CATEGORIES = [
  "sexual_reproductive",
  "mental_health",
  "infectious_disease",
  "substance_use",
  "other_sensitive",
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

export const sensitiveCategorySchema = z.enum(SENSITIVE_CATEGORIES);
