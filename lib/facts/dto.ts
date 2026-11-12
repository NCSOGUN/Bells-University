// FactDTO: the only fact shape routes return (FR-05, FR-06, NFR-16). Used by P5 to P9.
// No field expresses direction or judgement: no "abnormal", "trend", "better", "worse".
import type { FactRow } from "@/lib/db/schema";

export interface FactDTO {
  id: string;
  record_id: string;
  document_id: string | null;
  origin: "ai_read" | "patient_added" | "provider_entered";
  state: "unverified" | "confirmed" | "disputed";
  kind: string;
  label_as_printed: string;
  value_as_printed: string | null;
  unit_as_printed: string | null;
  range_as_printed: string | null;
  flag_as_printed: string | null;
  value_num: number | null;
  range_low: number | null;
  range_high: number | null;
  unreadable: boolean;
  check_carefully: boolean;
  confidence: string | null;
  source_quote: string | null;
  source_box: number[] | null;
  source_page: number | null;
  fact_date: string | null;
  fact_date_as_printed: string | null;
  test_key: string | null;
  sensitive_category: string | null;
  facility_name: string | null;
  extra: Record<string, unknown>;
  superseded_by: string | null;
  /** True when a source image exists (document_id set). Open it via the image routes. */
  has_image: boolean;
  created_at: string;
}

export function toFactDTO(f: FactRow): FactDTO {
  return {
    id: f.id,
    record_id: f.record_id,
    document_id: f.document_id,
    origin: f.origin as FactDTO["origin"],
    state: f.state as FactDTO["state"],
    kind: f.kind,
    label_as_printed: f.label_as_printed,
    value_as_printed: f.value_as_printed,
    unit_as_printed: f.unit_as_printed,
    range_as_printed: f.range_as_printed,
    flag_as_printed: f.flag_as_printed,
    value_num: f.value_num,
    range_low: f.range_low,
    range_high: f.range_high,
    unreadable: f.unreadable,
    check_carefully: f.check_carefully,
    confidence: f.confidence,
    source_quote: f.source_quote,
    source_box: Array.isArray(f.source_box) ? (f.source_box as number[]) : null,
    source_page: f.source_page,
    fact_date: f.fact_date,
    fact_date_as_printed: f.fact_date_as_printed,
    test_key: f.test_key,
    sensitive_category: f.sensitive_category,
    facility_name: f.facility_name,
    extra: (f.extra as Record<string, unknown>) ?? {},
    superseded_by: f.superseded_by,
    has_image: f.document_id !== null,
    created_at: f.created_at.toISOString(),
  };
}
