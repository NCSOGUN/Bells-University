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
