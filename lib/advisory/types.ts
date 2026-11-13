// Drug-allergy advisory shape (FR-17, NFR-21). Defined now so the referral packet can carry it; P11 fills it.
export interface Advisory {
  allergy_fact_id: string;
  medicine_fact_id: string;
  allergy_label: string;
  medicine_label: string;
  rule_id: string | null;
  note: string | null;
  /** The fixed advisory sentence. Never advice; always "check with a doctor or pharmacist". */
  message: string;
}
