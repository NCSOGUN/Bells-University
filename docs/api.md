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
| POST /api/facts/{id}/category **(added)** | Patient | Tag or clear a fact's sensitive category | FR-15 |
| GET /api/facts/{id}/explanation | Patient | Deterministic explanation | FR-09 |
| GET /api/records/{id}/advisories **(added)** | Patient | Drug-allergy flags, never blocking | FR-17 |
| POST /api/shares | Patient | Create a code (expiry, hidden categories, purpose) | FR-10, FR-15 |
| POST /api/shares/{id}/revoke | Patient | Revoke now | FR-11 |
| GET /api/records/{id}/shares **(added)** | Patient | The record's shares and their state | FR-10, FR-11 |
| GET /api/records/{id}/access-log | Patient | Who saw what, and refusals | FR-13 |
| POST /api/referrals, GET /api/referrals/{id} | Patient | Build and preview a packet | FR-14 |
| GET /api/facilities | Patient | Short static list | FR-20 |
| POST /api/links, POST /api/links/{id}/revoke | Patient | Link and unlink a partner hospital | FR-25 |
| GET /api/hospitals **(added)** | Patient | Hospitals that can be linked | FR-25 |
| GET /api/records/{id}/links **(added)** | Patient | The record's links and their deliveries | FR-25, NFR-23 |
| POST /api/view/open | Clinician | Code + name + practice number opens a viewer session | FR-10, FR-12 |
| GET /v, GET /v/referral | Clinician | Server-rendered summary and packet | FR-12, FR-14, FR-24 |
| GET /v/facts/{id}/image | Clinician | 302 to a signed URL; logged | FR-05, NFR-16 |
| POST /api/view/ack | Clinician | Referral acknowledgement | FR-19 |
| POST /api/feed/v1/bundles | Partner system | Write-only intake | FR-26, FR-27 |
| GET /api/health **(added)** | Anyone | Region and Node version, no database | freeze item 3 |

No endpoint takes a record ID without also checking, through `can()`, that the caller holds that record (NFR-06). `tests/static.test.ts` checks this table both ways: every row has a route file, and every route file and method has a row.

**Types.** `lib/api-types.ts` has every request body, response and error code below as TypeScript types. It is type-only, so client components can `import type { … } from "@/lib/api-types"` without pulling server code into the bundle.

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
| 403 | `forbidden`, `consent_required`, `provider_entered_immutable`, `dispute_provider_only`, `code_not_valid`, `link_not_active` | Known caller, not allowed. |
| 403 | `no_cookie`, `session_expired`, `share_expired`, `share_revoked` | Clinician routes only: the viewer session can no longer be used. Show "This access is no longer valid." and the code entry. |
| 404 | `not_found` | Does not exist **or** the caller does not hold it. The two look the same on purpose (NFR-06). |
| 409 | `extraction_in_progress`, `client_upload_id_conflict`, `invalid_transition`, `already_removed` | Conflict with current state. |
| 413 | `file_too_large` (uploads), `payload_too_large` (feed) | Over the limit. |
| 415 | `unsupported_media_type` | Feed only: wrong `Content-Type`. |
| 429 | `too_many_attempts` | Rate limited; see `Retry-After`. |
| 500 | `internal_error` | Unexpected; no detail is returned. |
| 502 | `extraction_failed`, `storage_failed` | The model or Storage failed. Nothing half-written; the same call can be retried (uploads with the same `client_upload_id`). |
| 503 | `service_unavailable` | Sign-in could not be checked (Supabase Auth unreachable, or no answer within 8 s). Has `Retry-After: 5`. **The caller is not signed out:** keep the session, show "Please try again", and retry. A 401 is the only "sign in again" signal. |

**`ai_notice` (NFR-13).** Every response that carries facts also carries an `ai_notice` string: `GET /api/records/{id}/facts`, `GET /api/documents/{id}`, `POST /api/documents/{id}/extract` (patient wording), and `getViewerSummary` / `getReferralPacketForViewer` (clinician wording). Show it, as given, on every screen that shows those facts. It states that items were read by AI, may contain errors, and are not medical advice.

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
The server checks the file's first bytes: a file whose contents are not the JPEG, PNG or PDF it claims to be is 400 `unsupported_type`. Errors: 400 `invalid_request`, 400 `unsupported_type`, 401, 404 (not your record), 409 `client_upload_id_conflict`, 413 `file_too_large`, 502 `storage_failed` (retry with the same id).

## POST /api/documents/{id}/extract

Patient. No body. Reads the document with the AI, applies the guards, stores facts as `ai_read` + `unverified`. Takes 5 to 30 s; the app should show progress and may poll `GET /api/documents/{id}` if the connection drops. Calling it again after success returns the stored facts without calling the model.

```json
200  { "document_id": "…", "status": "extracted", "facts": [ FactDTO, … ], "ai_notice": "Items marked as read by AI were read from your documents by an AI service and may contain errors. …" }
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
  "facts": [ FactDTO, … ], "ai_notice": "…" }
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
  ],
  "ai_notice": "Items marked as read by AI were read from your documents by an AI service and may contain errors. …"
}
```
`previous` appears only when: same test (`test_key`), both numeric, an earlier date, and the **same unit**. Two units count as the same when they are equal after Unicode NFKC folding, whitespace collapsing and trimming (so `µmol/L` and `μmol/L`, which look identical but use different characters, match); nothing else is folded: case and every other difference still count. The stored text of each fact is shown as supplied, not rewritten. Units are never converted. Errors: 401, 404.

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
Hospital-sent facts only. `POST { "note": "This is not my result" }` (1 to 500 characters) sets `state: "disputed"`; `DELETE` (no body) withdraws it back to `confirmed`. The hospital's content is untouched and the note is stored beside it. The disputed state shows on the clinician view. `200 { "fact": FactDTO }`. Errors: 400, 401, 403 `dispute_provider_only` (not a hospital-sent fact), 404, 409.

## POST /api/facts/{id}/category
The patient's privacy tag, allowed on any origin (it is not an edit of clinical content). `{ "sensitive_category": "mental_health" }` or `null` to clear. Values: `sexual_reproductive`, `mental_health`, `infectious_disease`, `substance_use`, `other_sensitive`. `200 { "fact": FactDTO }`. Errors: 400, 401, 404, 409.

---

## GET /api/facts/{id}/explanation

Patient. Deterministic plain-language explanation of one **lab** fact (FR-09). No AI model is involved: every sentence is a fixed template or a glossary row, and the comparison uses only the range printed on the same document (NFR-17). Units are repeated as printed, never converted.

Real output for the **seeded** demo fact Haemoglobin 9.8 g/dL (AI-read, confirmed, range printed `12.0 - 16.0`). The demo record's newest Haemoglobin may be a later hospital-sent value; a `provider_entered` fact gets only the first notice.

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

---

## POST /api/shares

Patient. Creates a share code. **The code is returned once and never again** (only its hash is stored), so show it immediately.

```json
{ "record_id": "…", "purpose": "general", "expires_in_minutes": 60,
  "hidden_categories": ["mental_health"], "hidden_document_ids": ["…"] }
```
Strict body. Only `record_id` and `purpose` (`general` or `referral`) are required. `expires_in_minutes` defaults to 60; general shares allow 15 to 1440; referral shares up to 10080 (7 days) and need a `referral_id`. `hidden_categories` must come from the fixed list (see POST /api/facts/{id}/category); every hidden document and the referral must belong to the record.

```json
201
{ "share_id": "…", "code": "7KQ2-M9XD",
  "url": "https://<host>/c#7KQ2-M9XD", "qr_svg": "<svg …>…</svg>", "expires_at": "2026-11-13T11:42:00.000Z" }
```
The code is in the URL **fragment** (after `#`), so it never reaches a server log. Render `qr_svg` for the doctor to scan, or show `code` to read aloud. Errors: 400 `invalid_request` / `invalid_expiry` / `document_not_in_record` / `referral_not_in_record`, 401, 404.

## POST /api/shares/{id}/revoke

Patient. Revokes now. Idempotent. The doctor's next request is refused. `200 { "revoked": true }`. Errors: 401, 404 (not your share).

## GET /api/records/{id}/shares

Patient. Never returns codes or hashes.
```json
200
{ "shares": [ { "id": "…", "purpose": "general", "created_at": "…", "expires_at": "…", "revoked_at": null,
                "status": "valid", "hidden_categories": ["mental_health"], "hidden_document_ids": [], "viewer_count": 1 } ] }
```
`status` is `valid | expired | revoked`. Errors: 401, 404.

## GET /api/records/{id}/access-log?limit=

Patient. Newest first, default 100, max 200. Append-only; entries cannot be removed. Show `label` as the line of text.
```json
200
{ "entries": [
  { "id": "…", "at": "2026-11-13T10:02:11.000Z", "actor_type": "clinician",
    "actor_label": "Dr A · MDCN 12345 (unverified)", "action": "viewer_opened", "outcome": "allowed",
    "reason": null, "share_id": "…", "link_id": null, "fact_id": null,
    "label": "Dr A · MDCN 12345 (unverified) opened your record" } ] }
```
`action` is one of `share_created, share_revoked, viewer_opened, viewer_open_refused, viewer_image_viewed, referral_acknowledged, link_created, link_revoked, feed_delivery_accepted, feed_delivery_refused`. A `viewer_open_refused` entry means someone tried a code of yours that had expired or been revoked (`reason`). Errors: 401, 404.

## POST /api/view/open (clinician, no sign-in)

Body: `{ "code": "7KQ2-M9XD", "name": "Dr A", "practice_no": "MDCN 12345" }` (name 2 to 80 characters, practice number 2 to 40; both trimmed). The code is case-insensitive and tolerant: spaces and hyphens are ignored, `O` reads as `0`, `I` and `L` read as `1`. The name and practice number are **recorded but not verified**; say so on screen.

```json
200  { "ok": true, "next": "/v" }        // "/v/referral" for a referral share; sets the itan_v cookie
403  { "error": { "code": "code_not_valid", "message": "This code is not valid." } }
429  { "error": { "code": "too_many_attempts", … } }   // header Retry-After: 600
```
Unknown, expired and revoked codes return the **identical** 403 body, so nothing can be learned by guessing. After 5 wrong tries from one address in 10 minutes the 6th gets 429 and the code is not even checked. The cookie (`itan_v`, HttpOnly, SameSite=Lax, Secure in production) lasts at most 30 minutes and never past the share's expiry. The response never contains record content. Errors: 400 `invalid_request`.

Client flow on `/c`: read the code from `location.hash`, POST it here, then navigate to `next`. Do not put the code in a query string.

## GET /v/facts/{id}/image (clinician)

Needs the `itan_v` cookie. `302` to a signed URL valid for 60 seconds; every view is written to the patient's access log. `403 share_revoked | share_expired | session_expired | no_cookie` when the access is no longer valid. `404` for a fact that is hidden by the share, belongs to another record, or has no image (identical, so hidden items are not revealed).

## Library functions for the clinician pages (Dev A)

`/v` and `/c` pages call these directly instead of fetching the API. Import from `@/lib/share/service`:

| Function | Use |
|---|---|
| `getViewerFromRequest(request)` | In a server component or route: pass a `Request` carrying the cookie. Returns `{ ok: true, actor, viewer, share, recordId, purpose }` or `{ ok: false, reason }` (`no_cookie`, `session_expired`, `share_expired`, `share_revoked`). It re-checks the share every call. On `ok: false`, show "This access is no longer valid." and a way to enter a new code. |
| `getViewerSummary(ctx)` | Pass the `ok: true` result. Returns the one-screen summary below, or `null`. |

Server components read the cookie with `cookies()` from `next/headers`; build a `Request` for the helper: `new Request("http://x", { headers: { cookie: "itan_v=" + value } })`.

```json
{
  "record": { "display_name": "Demo Patient (SYNTHETIC)", "birth_year": 1972, "held_by_caregiver": false },
  "viewer": { "name": "Dr A", "practice_no": "MDCN 12345" },
  "recorded_notice": "Name and practice number were recorded but not verified.",
  "partial_notice": "The patient has chosen not to share some items. This record may be incomplete.",
  "ai_notice": "Items marked as read by AI were read from the patient's documents by an AI service and may contain errors; …",
  "sections": {
    "medicines": [ FactDTO ], "allergies": [ FactDTO ], "diagnoses": [ FactDTO ],
    "recent_results": [ FactDTO & { "previous": { "value_as_printed": "8.1", "unit_as_printed": "%", "fact_date": "2026-05-14", "fact_id": "…" } } ]
  },
  "expires_at": "2026-11-13T11:42:00.000Z"
}
```
`partial_notice` is null unless the patient hid something; it never says what. Show the **origin and state badges** on every fact (unverified, confirmed, disputed, "Sent by hospital") and make each fact with `has_image` open `/v/facts/{id}/image`. Recent results are the latest value per test, newest first, at most 12. Show the exact strings above; do not paraphrase.

---

## GET /api/facilities

Any signed-in account. The short fictional list used to pick a referral destination (FR-20). Every name ends "(SIMULATED)".
```json
200  { "facilities": [ { "id": "…", "name": "Demo General Hospital (SIMULATED)", "city": "Abeokuta", "is_simulated": true } ] }
```

## POST /api/referrals

Patient builds a referral from a **source**. Strict body.
```json
{ "record_id": "…", "source_fact_id": "…", "destination_facility_id": "…",
  "referring_clinician_as_written": "Dr A", "referral_date_as_written": "05/11/2026" }
```
Only `record_id` is required. `source_fact_id` must be a fact of `kind: "referral"` in the same record: either one a partner hospital sent, or one read from a photographed referral letter (the extraction creates it). The clinician and date are copied from the source when you do not send them.

**Reason and urgency can never be sent.** A body containing `reason`, `reason_as_written`, `urgency`, `urgency_as_written` or `urgency_code` is rejected:
```json
400  { "error": { "code": "field_not_allowed", "message": "Reason and urgency cannot be set here. They are carried from the referring clinician's own record or letter." } }
```
```json
201  { "referral_id": "…" }
```
Errors: 400 `invalid_request` / `invalid_source` / `invalid_destination` / `field_not_allowed`, 401, 404 (not your record).

## GET /api/referrals/{id}

Patient. Preview of exactly what a doctor will see, the acknowledgements, and the disclaimer.
```json
200
{
  "referral": { "id": "…", "record_id": "…", "source_fact_id": "…", "destination_facility_id": "…",
                "referring_clinician_as_written": "Dr Demo Physician (SIMULATED)", "referral_date_as_written": "10/11/2026", "created_at": "…" },
  "packet": {
    "patient": { "display_name": "Demo Patient (SYNTHETIC)", "birth_year": 1972 },
    "destination": "Sample Teaching Hospital (SIMULATED)",
    "urgency":              { "status": "present", "value": "urgent", "source": "Sent by Demo General Hospital (SIMULATED)", "urgency_code": "urgent" },
    "reason_for_referral":  { "status": "present", "value": "Persistent anaemia, needs specialist review", "source": "Sent by Demo General Hospital (SIMULATED)" },
    "referring_clinician":  { "status": "present", "value": "Dr Demo Physician (SIMULATED)", "source": "Sent by Demo General Hospital (SIMULATED)" },
    "date":                 { "status": "present", "value": "10/11/2026", "source": "Sent by Demo General Hospital (SIMULATED)" },
    "results":   { "status": "present", "value": [ FactDTO & { "previous": { … } } ] },
    "medicines": { "status": "present", "value": [ FactDTO ] },
    "allergies": { "status": "missing", "note": "None recorded in this record" },
    "advisories": [],
    "documents": [ "…" ]
  },
  "acknowledgements": [ { "status": "service_offered", "label": "Received — service offered here", "at": "…", "viewer_name": "Dr Ack" } ],
  "disclaimer": "This is not a statement that a bed is available.",
  "ai_notice": "Items marked as read by AI were read from your documents by an AI service and may contain errors. …"
}
```

**The seven fields** are always present as keys: `results, urgency, medicines, allergies, reason_for_referral, referring_clinician, date`. Each has `status: "present" | "missing"`. **A missing field is shown as missing, never hidden.** Use these fixed texts, copied exactly:

| Situation | `note` |
|---|---|
| No source, or the source does not state it | `Not stated by the referring clinician` |
| Source is a letter the patient has not confirmed | `Read from a letter but not yet confirmed by the patient` |
| Hospital's referral that the patient has disputed (value still shown) | `The patient has marked this as disputed` |
| No medicines, allergies or results recorded | `None recorded in this record` |

`source` is one of `Sent by {hospital}`, `Read from the patient's referral letter and confirmed by the patient`, `Entered by the patient`. `urgency_code` (routine, urgent, asap, stat) appears only for hospital-sent referrals, beside the hospital's own words. Itan never maps urgency to anything of its own. Missing medicines/allergies do not mean "none"; the note says only that none are recorded. Errors: 401, 404.

## POST /api/view/ack (clinician)

Needs the `itan_v` cookie of a **referral** share. `{ "status": "service_offered" | "service_not_offered" }`.
```json
200  { "label": "Received — service offered here", "disclaimer": "This is not a statement that a bed is available." }
```
Always show the disclaimer with the label. Errors: 400, 403 (no cookie, expired or revoked share, or a general share). The patient's access log gets `referral_acknowledged`. Simulated in this version: label the screen so.

## Library function for the referral page (Dev A)

`getReferralPacketForViewer(ctx)` from `@/lib/referral/service`, after `getViewerFromRequest` returned `ok: true`. Returns null unless the share is a referral share.
```json
{ "packet": { …as above, with hidden items removed… },
  "viewer": { "name": "Dr Ack", "practice_no": "MDCN 99999" },
  "recorded_notice": "Name and practice number were recorded but not verified.",
  "partial_notice": null,
  "ai_notice": "Items marked as read by AI were read from the patient's documents by an AI service and may contain errors; …",
  "current_acknowledgement": null,
  "ack_labels": { "service_offered": "Received — service offered here", "service_not_offered": "Received — service not offered here" },
  "disclaimer": "This is not a statement that a bed is available.",
  "expires_at": "…" }
```

---

## GET /api/records/{id}/advisories

Patient. Non-blocking drug-allergy flags (FR-17). It reads only and never stops any other action. It uses a short hand-built list that **has not been clinically validated**, so `validated` is always `false` and the message says so. Show the `message` exactly; add no severity, colour-coded danger, "avoid" or alternatives.

```json
200
{
  "advisories": [
    { "allergy_fact_id": "…", "medicine_fact_id": "…",
      "allergy_label": "Penicillin", "medicine_label": "Amoxicillin 500 mg",
      "rule_id": "penicillins", "note": "These medicines belong to the penicillin group.",
      "message": "Your record lists an allergy to Penicillin and a medicine called Amoxicillin 500 mg. Itan cannot tell whether this is a problem. Please check with a doctor or pharmacist. This check uses a short list that has not been clinically validated. This is not medical advice." }
  ],
  "validated": false
}
```
A pair matches when the allergy and the medicine are both in one rule's group (penicillins, cephalosporins related to penicillins, sulfonamides, NSAIDs, macrolides), or when the allergy word appears in the medicine's name. Unreadable and superseded facts are ignored. The same advisories appear in `packet.advisories` on a referral, computed only from facts the viewer can see (a hidden allergy never leaks). Errors: 401, 404.

---

## Hospital links (C14, FR-25)

A patient links **one chosen hospital** to a record and gets a **link reference** (`ITN-LNK-` plus 8 Crockford base32 characters) to hand to that hospital's records officer once, as text or QR. The link stays valid until the patient revokes it. The hospital's first accepted delivery records its own patient number on the link; a later delivery with a different number is refused. Every link, unlink and delivery (accepted or refused) appears in the access log.

### GET /api/hospitals (added)

Signed-in. `200 { "hospitals": [ { "id": "…", "name": "Demo General Hospital (SIMULATED)", "simulated": true } ] }`. Errors: 401.

### POST /api/links

Patient (holder of the record).
```json
{ "record_id": "…", "hospital_id": "…" }
```
```json
201
{ "link_id": "…", "link_ref": "ITN-LNK-7K2Q9MWD",
  "hospital": { "id": "…", "name": "Demo General Hospital (SIMULATED)", "simulated": true },
  "qr_svg": "<svg …>…</svg>", "created_at": "2026-11-13T08:13:49.780Z" }
```
`qr_svg` encodes the link reference as plain text. Access log: `link_created`. Errors: 400 `invalid_request` / `hospital_not_found`, 401, 404 (not your record).

### POST /api/links/{id}/revoke

Patient. Revokes now; idempotent. The hospital's next delivery gets 403 `link_not_active` and the patient sees the refused delivery in the access log. `200 { "revoked": true }`. Access log: `link_revoked` (once). Errors: 401, 404 (not your link).

### GET /api/records/{id}/links (added)

Patient.
```json
200
{ "links": [ { "id": "…", "link_ref": "ITN-LNK-7K2Q9MWD",
               "hospital": { "id": "…", "name": "Demo General Hospital (SIMULATED)", "simulated": true },
               "created_at": "…", "revoked_at": null, "status": "active",
               "deliveries_accepted": 2, "deliveries_refused": 0, "last_delivery_at": "…" } ] }
```
`status` is `active | revoked`. Errors: 401, 404.

---

## POST /api/feed/v1/bundles (partner, C15; FR-26, FR-27, NFR-22 to NFR-24)

**Write-only.** A partner hospital system pushes results and referrals. There is **no read route**: no method or path under `/api/feed` returns anything from a record. This is a **FHIR R4 subset, not a FHIR server**: Itan is FHIR R4-aligned at this partner interface only, and its internal model is its own relational schema. It does not claim FHIR compliance.

**Request headers**

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <hospital key>` (`itnk_…`; stored only as SHA-256; revocable) |
| `Idempotency-Key` | a UUID, new for each delivery; re-sending the same one is safe |
| `Content-Type` | `application/fhir+json` or `application/json` |

**Body:** a `Bundle` of `type: "collection"`, at most 50 entries, with **exactly one** `Patient` carrying two identifiers: system `urn:itan:link` with the link reference, and the hospital's own patient number (any other system). Then one or more of:

| Resource | Fields read (everything else is ignored) | Becomes |
| --- | --- | --- |
| `Observation` | `identifier[0]`, `code.text`, exactly one of `valueString` / `valueQuantity {value, unit}`, `referenceRange[0] {text, low, high}`, `effectiveDateTime` (full date, optional time) | a `lab` fact |
| `ServiceRequest` | `identifier[0]`, `reasonCode[].text`, `priority` (`routine`, `urgent`, `asap`, `stat`), `requester.display` | a `referral` fact; reason (texts joined with `; `), urgency and requester carried **exactly as sent** |

Any other resource type is 422. Facts are `origin: provider_entered`, `state: confirmed`, with the hospital's name as `facility_name`. The patient can dispute them but never edit them. `fact_date` is the date part of `effectiveDateTime` with no timezone shifting.

**A corrected result** arrives as a new `Observation` with the **same identifier** (system and value): the new fact supersedes the old one (`superseded_by`), the old one is kept in the history and hidden from summaries.

**Limitation (L28).** `valueQuantity.value` is a JSON number, so `12.0` arrives as `12` and the printed trailing zero is lost. Send `valueString` when exact text matters; the unit is then taken from `referenceRange[0].low.unit` (or `high.unit`), because FHIR's `valueString` has no unit. Numbers (`value_num`, range bounds) are always derived by Itan's own parser from the text.

**Example bundle** (SIMULATED, synthetic):
```json
{ "resourceType": "Bundle", "type": "collection",
  "entry": [
    { "resource": { "resourceType": "Patient", "identifier": [
        { "system": "urn:itan:link", "value": "ITN-LNK-7K2Q9MWD" },
        { "system": "urn:demo-general-hospital:mrn", "value": "DEMO-00123" } ] } },
    { "resource": { "resourceType": "Observation",
        "identifier": [ { "system": "urn:demo-general-hospital:lab", "value": "LAB-20261110-HB" } ],
        "code": { "text": "Haemoglobin" }, "valueString": "11.2",
        "referenceRange": [ { "text": "12.0 - 16.0", "low": { "value": 12.0, "unit": "g/dL" }, "high": { "value": 16.0, "unit": "g/dL" } } ],
        "effectiveDateTime": "2026-11-10T09:30:00+01:00" } },
    { "resource": { "resourceType": "ServiceRequest",
        "reasonCode": [ { "text": "Persistent anaemia, needs specialist review" } ],
        "priority": "urgent", "requester": { "display": "Dr Demo Physician (SIMULATED)" } } } ] }
```

**Example call**
```bash
curl -i -X POST "$BASE_URL/api/feed/v1/bundles" \
  -H "Authorization: Bearer $HOSPITAL_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/fhir+json" \
  --data @tools/sim-hospital/fixtures/results.json   # after filling {{LINK_REF}} and {{MRN}}
```
Or use the simulated hospital: `npm run sim -- send-results --link ITN-LNK-… --mrn DEMO-00123`.

**Responses.** Checks run in this order and stop at the first refusal (L26):

| Status | `error.code` | When | Logged |
| --- | --- | --- | --- |
| 405 + `Allow: POST` | `method_not_allowed` | any method other than POST, on any path under `/api/feed` (checked before the key) | `feed_receipt` refused, hospital unknown |
| 401 | `unauthenticated` | missing, wrong or revoked key | `feed_receipt` refused, hospital unknown |
| 400 | `idempotency_key_required` | missing or not a UUID | `feed_receipt` refused |
| 413 | `payload_too_large` | body over 1 MB (1,048,576 bytes) | `feed_receipt` refused |
| 415 | `unsupported_media_type` | another `Content-Type` | `feed_receipt` refused |
| 422 | `bundle_invalid` | not JSON, or outside the subset. `error.issues: [{path, message}]` gives paths and messages only, never your values. **Nothing is written.** | `feed_receipt` refused |
| 403 | `link_not_active` | unknown link reference, revoked link, a link belonging to another hospital, or a different hospital patient number. **The body is identical in all four cases**, so a hospital cannot probe which patients exist. | `feed_receipt` refused; if the link exists, `feed_delivery_refused` in that patient's access log |
| 200 | — | the same `Idempotency-Key` again (from the same hospital): `{ "receipt_id": "…", "facts_created": 3, "replayed": true }`, nothing written | — |
| 202 | — | accepted: `{ "receipt_id": "…", "facts_created": 3 }` | `feed_receipt` accepted, one `fact_event` per fact, `feed_delivery_accepted` in the access log, all in one transaction |

Refused receipts never store the idempotency key, so a corrected retry with the same key still goes through. Every response has `Cache-Control: no-store`. No refusal body contains record content.

---

## GET /api/health (added)

Anyone, no sign-in, no database access. Used to read the function region from a deployment (freeze item 3).
```json
200  { "ok": true, "region": "lhr1", "node": "v24.18.0" }
```
`region` is `"local"` outside Vercel.
