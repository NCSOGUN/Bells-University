// The hidden-items filter (FR-15, US-7). PURE. Applied to EVERY fact a clinician can see: the summary, the packet
// and the source-image route. A hidden fact never reaches the clinician's browser, not even its id.
export interface ShareHides {
  hiddenCategories: string[];
  hiddenDocumentIds: string[];
}

export interface Filterable {
  sensitive_category: string | null;
  document_id: string | null;
  superseded_by: string | null;
  removed_at?: string | Date | null;
}

export function isHiddenByShare(f: Filterable, share: ShareHides): boolean {
  return (
    (f.sensitive_category !== null && share.hiddenCategories.includes(f.sensitive_category)) ||
    (f.document_id !== null && share.hiddenDocumentIds.includes(f.document_id))
  );
}

/** `hiddenAny` is true whenever the patient chose to hide anything, so the clinician is told the record is
 *  partial without being told what was hidden (Locked decision L16). */
export function filterFactsForShare<T extends Filterable>(facts: T[], share: ShareHides): { visible: T[]; hiddenAny: boolean } {
  const visible = facts.filter((f) => !f.removed_at && f.superseded_by === null && !isHiddenByShare(f, share));
  return { visible, hiddenAny: share.hiddenCategories.length > 0 || share.hiddenDocumentIds.length > 0 };
}
