// NFR-13 disclosures. PURE constants. Every response that carries AI-read facts carries one of these, so every
// screen that shows AI-derived content can state it: read by AI, may contain errors, not medical advice.
// Dev A shows the string as given, near the facts it covers.

/** For the patient's own screens (timeline, document review). */
export const AI_NOTICE_PATIENT =
  "Items marked as read by AI were read from your documents by an AI service and may contain errors. Check each one against your original document. This is not medical advice.";

/** For the clinician's summary and referral packet. */
export const AI_NOTICE_CLINICIAN =
  "Items marked as read by AI were read from the patient's documents by an AI service and may contain errors; items marked unverified have not been checked by the patient. Open the source image to check an item. This is not medical advice.";
