# Itan API contract

Extracted from SYSTEM-DESIGN.md section 7. Keep in sync; the design doc wins on conflict until freeze.
Routes marked **(added)** are not in the design table; they were added so Dev A's screens can load data.

| Method and path | Caller | Does | FR |
| --- | --- | --- | --- |
| GET /api/records **(added)** | Patient | List the caller's records | FR-01, FR-18 |
| POST /api/records | Patient | Create a record for self or someone else | FR-01, FR-18 |
| GET /api/consent **(added)** | Patient | Has the caller consented to AI processing? | NFR-03 |
| POST /api/consent | Patient | Record AI-processing consent before first capture | NFR-03 |
| POST /api/documents | Patient | Upload one file; idempotent on `client_upload_id` | FR-02, NFR-12 |
| POST /api/documents/{id}/extract | Patient | Run extraction if not already done; return facts | FR-03–05 |
| GET /api/documents/{id} | Patient | Status and facts | FR-03 |
| GET /api/documents/{id}/image | Patient | 302 to a 60-second signed URL | FR-05 |
| GET /api/records/{id}/facts | Patient | Timeline data | FR-08 |
| POST /api/facts | Patient | Add a fact (patient\_added) | FR-07 |
| POST /api/facts/{id}/confirm | Patient | unverified to confirmed | FR-06 |
| POST /api/facts/{id}/correct | Patient | Change fields; event keeps the original | FR-07 |
| POST /api/facts/{id}/remove | Patient | Hide a wrong AI fact; event kept | FR-07 |
| POST /api/facts/{id}/dispute, DELETE the same | Patient | Dispute or withdraw, provider\_entered only | FR-27 |
| GET /api/facts/{id}/explanation | Patient | Deterministic explanation | FR-09 |
| POST /api/shares | Patient | Create a code (expiry, hidden categories, purpose) | FR-10, FR-15 |
| POST /api/shares/{id}/revoke | Patient | Revoke now | FR-11 |
| GET /api/records/{id}/access-log | Patient | Who saw what, and refusals | FR-13 |
| POST /api/referrals, GET /api/referrals/{id} | Patient | Build and preview a packet | FR-14 |
| GET /api/facilities | Patient | Short static list | FR-20 |
| POST /api/links, POST /api/links/{id}/revoke | Patient | Link and unlink a partner hospital | FR-25 |
| POST /api/view/open | Clinician | Code + name + practice number opens a viewer session | FR-10, FR-12 |
| GET /v, GET /v/referral | Clinician | Server-rendered summary and packet | FR-12, FR-14, FR-24 |
| GET /v/facts/{id}/image | Clinician | 302 to a signed URL; logged | FR-05, NFR-16 |
| POST /api/view/ack | Clinician | Referral acknowledgement | FR-19 |
| POST /api/feed/v1/bundles | Partner system | Write-only intake | FR-26, FR-27 |

No endpoint takes a record ID without also checking, through `can()`, that the caller holds that record (NFR-06).

## Conventions

**Authentication (patient routes).** Supabase Auth. Send the access token either as `Authorization: Bearer <access_token>` (from `supabase.auth.getSession()` in the browser) or rely on the Supabase session cookie set by `@supabase/ssr`. The server verifies the token with Supabase on every request. Clinician routes use the `itan_v` viewer cookie instead (set by `/api/view/open`). The feed uses a hospital bearer key.

**Errors.** Every error body has one shape:

```json
{ "error": { "code": "not_found", "message": "Not found." } }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_request` (or a specific code) | Bad JSON or fields. The message lists field paths, never values. |
| 401 | `unauthenticated` | No valid identity. |
| 403 | `forbidden`, `consent_required`, `provider_entered_immutable`, `code_not_valid`, `link_not_active`, ... | Known caller, not allowed. |
| 404 | `not_found` | Does not exist **or** the caller does not hold it. The two look the same on purpose (NFR-06). |
| 409 | e.g. `extraction_in_progress`, `client_upload_id_conflict` | Conflict with current state. |
| 413 | `file_too_large` | Upload over the limit. |
| 429 | `too_many_attempts` | Rate limited; see `Retry-After`. |
| 500 | `internal_error` | Unexpected; no detail is returned. |

All API responses carry `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Bodies are JSON. Unknown body fields are rejected with 400 on routes that say "strict".

---

## GET /api/records (added)

Patient. Lists records the caller holds.

```json
200
{
  "records": [
    { "id": "f603e60f-…", "display_name": "Demo Patient (SYNTHETIC)", "birth_year": 1972,
      "is_self": true, "held_by_caregiver": false, "created_at": "2026-11-13T00:40:12.000Z" }
  ]
}
```
Errors: 401 `unauthenticated`.

## POST /api/records

Patient. Creates a record and makes the caller its holder. Strict body.

```json
{ "display_name": "Baba Tunde", "birth_year": 1950, "is_self": false }
```
`birth_year` is optional (or null). `is_self: false` means "I hold this record for someone else" (FR-18).

```json
201
{ "record_id": "8d0f…" }
```
Errors: 400 `invalid_request`, 401 `unauthenticated`.

## GET /api/consent (added)

Patient. `ai_consent_at` is null until the consent screen has been accepted.

```json
200
{ "ai_consent_at": null }
```
Errors: 401.

## POST /api/consent

Patient. Records consent to AI processing of document images (NFR-03). Idempotent: the first timestamp is kept. No body.

```json
200
{ "ai_consent_at": "2026-11-13T09:12:44.120Z" }
```
Errors: 401. Until this is set, `POST /api/documents/{id}/extract` returns 403 `consent_required`.

## FactDTO

Every fact returned by any route has this shape. Nothing in it says "abnormal", "better" or "worse"; the UI shows words from the fields.

```json
{
  "id": "…", "record_id": "…", "document_id": "… or null",
  "origin": "ai_read | patient_added | provider_entered",
  "state": "unverified | confirmed | disputed",
  "kind": "lab | medication | allergy | diagnosis | referral | other",
  "label_as_printed": "Haemoglobin", "value_as_printed": "9.8", "unit_as_printed": "g/dL",
  "range_as_printed": "12.0 - 16.0", "flag_as_printed": null,
  "value_num": 9.8, "range_low": 12, "range_high": 16,
  "unreadable": false, "check_carefully": false, "confidence": "high",
  "source_quote": "Haemoglobin 9.8 g/dL 12.0 - 16.0", "source_box": [118, 83, 133, 448], "source_page": 1,
  "fact_date": "2026-11-03", "fact_date_as_printed": "03/11/2026",
  "test_key": "haemoglobin", "sensitive_category": null, "facility_name": "Sample Diagnostics Laboratory",
  "extra": {}, "superseded_by": null, "has_image": true, "created_at": "2026-11-13T01:02:03.000Z"
}
```
`source_box` is `[ymin, xmin, ymax, xmax]` on a 0 to 1000 scale of the page, or null (crop to the whole page then). `fact_date` null means "date not readable": show `fact_date_as_printed`. `unreadable: true` means show "could not be read", never a value. `check_carefully: true` means ask the patient to compare with the document before confirming.

## POST /api/documents

Patient. `multipart/form-data` with `record_id` (uuid), `client_upload_id` (uuid the device generates once per capture and reuses on every retry), `file` (image/jpeg, image/png up to 1 MB; application/pdf up to 4 MB). The device compresses and strips EXIF; the server does not re-encode.

```json
201  { "document_id": "3d0296b8-…", "status": "uploaded" }
200  { "document_id": "3d0296b8-…", "status": "uploaded" }   ← same client_upload_id again (safe retry)
```
Errors: 400 `invalid_request`, 400 `unsupported_type`, 401, 404 (not your record), 409 `client_upload_id_conflict`, 413 `file_too_large`, 502 `storage_failed` (retry with the same id).

## POST /api/documents/{id}/extract

Patient. No body. Reads the document with the AI, applies the guards, stores facts as `ai_read` + `unverified`. Takes 5 to 30 s; the app should show progress and may poll `GET /api/documents/{id}` if the connection drops. Calling it again after success returns the stored facts without calling the model.

```json
200  { "document_id": "…", "status": "extracted", "facts": [ FactDTO, … ] }
```
A document with nothing readable still returns 200 with `"facts": []` (show "no facts found, add them by hand").
Errors: 401, 403 `consent_required` (POST /api/consent first), 404, 409 `extraction_in_progress` (another call is running; retry in a moment), 502 `extraction_failed` with message "Itan could not read this document. Try again or add the facts by hand." (document status becomes `failed`; the same route can be called again).

## GET /api/documents/{id}

Patient.
```json
200
{ "document_id": "…", "status": "uploaded | extracting | extracted | failed", "error_code": null,
  "doc_type": "lab_report", "mime": "application/pdf", "uploaded_at": "…", "extracted_at": "…",
  "facility_as_printed": "Sample Diagnostics Laboratory", "document_date_as_printed": "03/11/2026",
  "facts": [ FactDTO, … ] }
```
Errors: 401, 404.

## GET /api/documents/{id}/image

Patient. Responds `302 Location: <signed URL valid 60 s>`. Use it as an `<img src>` or `<iframe src>` for PDFs; request it again when it expires. `Cache-Control: no-store`. Errors: 401, 404.

---

## Fact lifecycle

| Origin | Created as | Patient can |
|---|---|---|
| `ai_read` | `unverified` | confirm, correct, remove |
| `patient_added` | `confirmed` | correct, remove |
| `provider_entered` (from a hospital) | `confirmed` (the hospital vouched) | **dispute** and withdraw the dispute. Never edit or remove (403 `provider_entered_immutable`) |

`confirmed` always carries the origin badge: the patient vouched for an AI-read fact, the sending facility vouched for a hospital fact. A patient can never set `origin`, `state` or `superseded_by`: those fields in a body give 400. A removed fact is hidden everywhere and cannot be changed again (409 `already_removed`). Every change appends a `fact_event` with before and after, so the AI's original reading is never lost.

## GET /api/records/{id}/facts

Patient. The timeline: active facts (not removed, not superseded), newest `fact_date` first, undated last, then newest created. Labs that have an earlier value with the identical printed unit carry `previous`. There is no difference, direction or "better/worse" field (FR-24).

```json
200
{
  "facts": [
    { "id": "…", "label_as_printed": "HbA1c", "value_as_printed": "7.4", "unit_as_printed": "%",
      "fact_date": "2026-11-03", "state": "confirmed", "origin": "ai_read", "…": "FactDTO",
      "previous": { "value_as_printed": "8.1", "unit_as_printed": "%", "fact_date": "2026-05-14", "fact_id": "…" } }
  ],
  "documents": [
    { "id": "…", "doc_type": "lab_report", "status": "extracted", "uploaded_at": "…",
      "facility_as_printed": "Sample Diagnostics Laboratory", "document_date_as_printed": "03/11/2026" }
  ]
}
```
`previous` appears only when: same test (`test_key`), both numeric, an earlier date, and the **same printed unit**. Units are never converted. Errors: 401, 404.

## POST /api/facts

Patient adds a fact by hand. Strict body. Created `patient_added` + `confirmed`.
```json
{ "record_id": "…", "kind": "lab", "label_as_printed": "Hb", "value_as_printed": "10.1",
  "unit_as_printed": "g/dL", "range_as_printed": "12.0 - 16.0", "fact_date_as_printed": "01/11/2026",
  "sensitive_category": null }
```
Only `record_id`, `kind` (`lab|medication|allergy|diagnosis|other`) and `label_as_printed` are required. Dates are read day-first. `201 { "fact": FactDTO }`. Errors: 400, 401, 404.

## POST /api/facts/{id}/confirm
`unverified` to `confirmed`. `200 { "fact": FactDTO }`. Errors: 401, 404, 409 `invalid_transition` (already confirmed), 409 `already_removed`.

## POST /api/facts/{id}/correct
Strict body, any of `label_as_printed`, `value_as_printed`, `unit_as_printed`, `range_as_printed`, `fact_date_as_printed` (null or empty clears). Numbers, date and `test_key` are re-derived from the text; the fact becomes `confirmed` and `check_carefully` and `unreadable` clear. `kind`, the source quote/box and the image are never changed.
```json
{ "value_as_printed": "9.8" }
```
`200 { "fact": FactDTO }`. Errors: 400, 401, 403 `provider_entered_immutable`, 404, 409.

## POST /api/facts/{id}/remove
Soft delete. `200 { "removed": true, "fact_id": "…" }`. Errors: 401, 403 `provider_entered_immutable`, 404, 409.

## POST /api/facts/{id}/dispute  and  DELETE /api/facts/{id}/dispute
Hospital-sent facts only. `POST { "note": "This is not my result" }` (1 to 500 characters) sets `state: "disputed"`; `DELETE` (no body) withdraws it back to `confirmed`. The hospital's content is untouched and the note is stored beside it. The disputed state shows on the clinician view. `200 { "fact": FactDTO }`. Errors: 400, 401, 403 (not a hospital-sent fact), 404, 409.

## POST /api/facts/{id}/category
The patient's privacy tag, allowed on any origin (it is not an edit of clinical content). `{ "sensitive_category": "mental_health" }` or `null` to clear. Values: `sexual_reproductive`, `mental_health`, `infectious_disease`, `substance_use`, `other_sensitive`. `200 { "fact": FactDTO }`. Errors: 400, 401, 404, 409.

---

## GET /api/facts/{id}/explanation

Patient. Deterministic plain-language explanation of one **lab** fact (FR-09). No AI model is involved: every sentence is a fixed template or a glossary row, and the comparison uses only the range printed on the same document (NFR-17). Units are repeated as printed, never converted.

Real output for the demo record's Haemoglobin 9.8 g/dL (range printed `12.0 - 16.0`):

```json
200
{
  "status": "below",
  "sentences": [
    "Your Haemoglobin was 9.8 g/dL. The range printed on this report is 12.0 - 16.0. Your result is below that printed range.",
    "Haemoglobin is the protein in red blood cells that carries oxygen around the body, and this test measures how much of it is in your blood."
  ],
  "glossary": {
    "description": "Haemoglobin is the protein in red blood cells that carries oxygen around the body, and this test measures how much of it is in your blood.",
    "questions": ["What does this result mean for me?", "Will this test be repeated, and when?", "How does this result fit with my other results?"]
  },
  "questions": ["What does this result mean for me?", "Will this test be repeated, and when?", "How does this result fit with my other results?"],
  "notices": [
    "Explained by Itan using only the range printed on your own report. This is not medical advice. Please discuss it with your doctor.",
    "Read by AI from your document. It may contain errors."
  ]
}
```

`status` is one of `below | within | above | no_range | not_comparable | unreadable | not_a_lab`.

| Status | When | First sentence |
|---|---|---|
| `below` / `within` / `above` | numeric value and a printed range (two-sided ranges are inclusive; `< n` holds values under n; `> n` holds values over n) | "Your {label} was {value} {unit}. The range printed on this report is {range}. Your result is {below\|within\|above} that printed range." |
| `no_range` | numeric value, no printed range | "…This report does not print a range for this test, so Itan cannot compare it." |
| `not_comparable` | value is not a plain number (e.g. "Positive", "<0.5") | "…Itan only compares numeric results with a printed range, so it cannot compare this one." |
| `unreadable` | the fact is unreadable or has no value | "Itan could not read this result, so it cannot explain it. Please check the original document." |

An `unverified` fact gets "You have not confirmed this value yet." first; a `check_carefully` fact gets "Please check this value against your document." A test with no glossary row gets "Itan has no description of this test yet." and the two generic questions, and `glossary` is null.

**Show every string in `notices` on the screen** (NFR-13): the second one appears for AI-read facts. Never add your own wording about what a result means.

Errors: 400 `not_explainable` (not a lab), 401, 404.
