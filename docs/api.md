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
