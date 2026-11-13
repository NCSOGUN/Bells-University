// The clinician's one-screen summary (FR-12, FR-24, NFR-16). PURE: build it from already-loaded data.
// Groups: medicines, allergies, diagnoses, recent results. Hidden and removed facts never get in (filter.ts).
// Unverified and disputed facts ARE shown, flagged by their state fields: the clinician decides how far to trust them.
import type { FactDTO } from "@/lib/facts/dto";
import { AI_NOTICE_CLINICIAN } from "@/lib/notices";
import { attachPrevious, latestPerTestKey, type FactWithPrevious } from "@/lib/facts/compare";
import { filterFactsForShare } from "./filter";
import type { ViewerContext } from "./session";

export const RECORDED_NOTICE = "Name and practice number were recorded but not verified.";
export const PARTIAL_NOTICE = "The patient has chosen not to share some items. This record may be incomplete.";
export const MAX_RECENT_RESULTS = 12;

export interface ViewerSummary {
  record: { display_name: string; birth_year: number | null; held_by_caregiver: boolean };
  viewer: { name: string; practice_no: string };
  recorded_notice: string;
  partial_notice: string | null;
  /** NFR-13. Always present: the summary can contain AI-read items. */
  ai_notice: string;
  sections: {
    medicines: FactDTO[];
    allergies: FactDTO[];
    diagnoses: FactDTO[];
    recent_results: FactWithPrevious[];
  };
  expires_at: string;
}

const newestFirst = (a: FactDTO, b: FactDTO) => (b.fact_date ?? "").localeCompare(a.fact_date ?? "") || b.created_at.localeCompare(a.created_at);

export function buildSummary(
  ctx: Pick<ViewerContext, "viewer" | "share">,
  record: { display_name: string; birth_year: number | null; is_self: boolean },
  facts: FactDTO[],
): ViewerSummary {
  const { visible, hiddenAny } = filterFactsForShare(facts, ctx.share);
  const ofKind = (k: string) => visible.filter((f) => f.kind === k).sort(newestFirst);
  const withPrev = attachPrevious(visible);
  const recent = latestPerTestKey(visible.filter((f) => f.kind === "lab"))
    .sort(newestFirst)
    .slice(0, MAX_RECENT_RESULTS)
    .map((f) => withPrev.find((w) => w.id === f.id) ?? f);

  return {
    record: { display_name: record.display_name, birth_year: record.birth_year, held_by_caregiver: !record.is_self },
    viewer: { name: ctx.viewer.name, practice_no: ctx.viewer.practiceNo },
    recorded_notice: RECORDED_NOTICE,
    partial_notice: hiddenAny ? PARTIAL_NOTICE : null,
    ai_notice: AI_NOTICE_CLINICIAN,
    sections: { medicines: ofKind("medication"), allergies: ofKind("allergy"), diagnoses: ofKind("diagnosis"), recent_results: recent },
    expires_at: ctx.share.expiresAt.toISOString(),
  };
}
