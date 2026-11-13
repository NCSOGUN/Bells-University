# Locked decisions (L1 to L32)

Where the design (`docs/SYSTEM-DESIGN.md`) was silent or ambiguous, these settle it. Code comments and docs cite them as "Locked decision Ln" or "Ln". Judgement calls made while building are in `docs/DEVIATIONS.md`. Change a locked decision only by agreement of both developers, and record it there.

**Ownership and identity**
- L1. Dev B writes every handler under `app/api/**`, including `POST /api/records` and `POST /api/consent`. Dev A's pages call them. `/v` and `/c` pages call library functions from `lib/` (for example `getViewerSummary`) rather than fetching the API.
- L2. Identity is Supabase Auth. B provides `getAccountId(request)`, which verifies the access token (from the Supabase session cookie via `@supabase/ssr`, or an `Authorization: Bearer` header) with the service client's `auth.getUser(jwt)`. Verify the `@supabase/ssr` API against the installed package; if it differs, use the Bearer header only and log it.
- L3. The `account` table row has the same `id` as the Supabase auth user. `ensureAccount(userId)` creates it on first use.

**Schema conventions** (read `docs/SYSTEM-DESIGN.md` section 6 in full; it is authoritative)
- L4. Table names are the singular snake_case names in the ERD. Primary keys are `uuid default gen_random_uuid()`. Timestamps are `timestamptz default now()`. "Enums" are `text` with a CHECK constraint.
- L5. Columns the ERD does not draw but the design requires. Add them and log "ERD gap" in DEVIATIONS.md; patch the Doc at the freeze.
  - `fact`: `record_id` (FK, not null), `document_id` (FK, null), `feed_receipt_id` (FK, null), `created_by_account_id` (FK, null), `hospital_id` (FK, null), `facility_name` text, `fact_date` date (null), `fact_date_as_printed` text, `flag_as_printed` text, `check_carefully` bool default false, `source_page` int, `extra` jsonb (kind-specific data, see L21), `created_at`.
  - `fact_event`: `fact_id` FK, `at`, `actor_account_id` (null), `note` text (patient's dispute note).
  - `access_log`: `record_id` FK, `actor_label` text (viewer name and practice number, hospital name, or "patient"), `reason` text, `share_id`, `link_id`, `fact_id` (all nullable).
  - `share`: `record_id`, `created_at`, `hidden_document_ids` uuid[] (so a single document can be hidden, FR-15), `referral_id` (null).
  - `viewer_session`: `share_id` FK, `created_at`.
  - `hospital_link`: `record_id`, `hospital_id`, `created_at`, `linked_by_account_id`.
  - `feed_receipt`: `hospital_id` (null, because unauthenticated attempts cannot be attributed), `link_id` (null), `received_at`, `facts_created` int, `bundle_bytes` int.
  - `referral`: `record_id`, `created_by_account_id`, `destination_facility_id` (null), `referring_clinician_as_written`, `referral_date_as_written`, `created_at`.
  - `referral_ack`: `referral_id`, `viewer_session_id`, `at`.
  - `document`: `record_id`, `uploaded_at`, `extracted_at`, `facility_as_printed`, `document_date_as_printed`, `byte_size`, `error_code`.
  - `code_attempt`: `ip_hash`, `at`, `success`.
- L6. Sensitive-category set (fixed list, stored in `lib/categories.ts` and enforced by a CHECK): `sexual_reproductive`, `mental_health`, `infectious_disease`, `substance_use`, `other_sensitive`. A patient tags a fact with one or none. Dev A shows this list in the share screen.

**Errors and hashing**
- L7. Every error response is `{ "error": { "code": string, "message": string } }`. Status map: 400 `invalid_request`; 401 `unauthenticated`; 403 `forbidden` (the caller is known but `can()` said no); 404 `not_found` (a record or object the caller does not hold looks the same as one that does not exist: this satisfies NFR-06); 409 conflict codes; 413 `file_too_large`; 429 `too_many_attempts`.
- L8. Hashes. Share code: `HMAC-SHA256(SHARE_PEPPER, normalisedCode)` hex. Viewer token: 32 random bytes base64url, stored as SHA-256 hex. Hospital key: `itnk_` plus 32 random bytes base64url, stored as SHA-256 hex. Client IP for rate limits: `HMAC-SHA256(SHARE_PEPPER, ip)` hex, never the raw IP. The IP comes from the first entry of `x-forwarded-for`, else `x-real-ip`, else "unknown".
- L9. Share codes: 8 characters from the Crockford base32 alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (32 symbols, so `byte & 31` is unbiased). Shown as `XXXX-XXXX`. Normalise input by uppercasing, stripping spaces and hyphens, mapping O to 0 and I or L to 1. Link references are `ITN-LNK-` plus 8 characters of the same alphabet.
- L10. Rate limit: count rows in `code_attempt` with `success = false` for the same `ip_hash` in the last 10 minutes; at 5 or more, respond 429 with `Retry-After` and do not check the code. A refusal is written to the patient's access log only when the code resolved to a share (expired or revoked). An unknown code is recorded only in `code_attempt`.
- L11. Viewer cookie: name `itan_v`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, lifetime `min(30 minutes, time until the share expires)`. Re-check the share (not revoked, not expired) on every request that uses the session.
- L12. `/api/view/open` returns the same body for unknown, expired and revoked codes: 403 `code_not_valid`. The distinct reason goes into the log only.
- L13. Share expiry: default 60 minutes; allowed 15 minutes to 24 hours for `general`; `referral` shares up to `MAX_REFERRAL_EXPIRY_DAYS = 7` (a constant in `lib/config.ts`; the maximum is still an open decision, section 17 item 15).
- L14. Signed image URLs: Supabase Storage `createSignedUrl(path, 60)`. Storage path: `records/{record_id}/{document_id}.{ext}` in the private bucket `documents`.

**Facts and extraction**
- L15. Kind mapping: lab: `label_as_printed` is the test name; `value_as_printed` the result. Medication: `label_as_printed` is the drug name (with strength if it is part of the printed name), `value_as_printed` the dose and frequency as printed. Allergy: label is the substance, value the reaction as printed. Diagnosis: label is the diagnosis text. Referral: see L21.
- L16. `test_key` comes from the glossary: normalise `label_as_printed` (lowercase, strip punctuation and spaces) and look it up in the glossary aliases; no match means `null`. FR-24 and the explanation engine work only for facts with a `test_key`.
- L17. `value_num`, `range_low` and `range_high` are derived by our code from the printed strings, never taken from the model. Parse `value_as_printed` as an optional sign, digits and one decimal point only; anything else (for example `<0.5`, `Positive`) gives `value_num = null`. Parse ranges of the forms `12.0 - 16.0`, `12.0–16.0`, `12-16` (low and high), `< 5.7` (high only), `> 3` (low only); anything else gives nulls and only the text is kept.
- L18. A date printed as `dd/mm/yyyy` is day-first (Nigerian convention). Accept ISO `yyyy-mm-dd` and `dd Mon yyyy`. If it cannot be parsed, `fact_date` is null and the UI shows "date not readable". `fact_date_as_printed` always keeps the original text.
- L19. If guard 3 (value inside the source quote) fails, treat the item as unreadable: `unreadable = true`, value fields cleared, `check_carefully = true`, and record `{guard_failed: "value_not_in_quote"}` in `extra`.
- L20. Previous-value comparison (FR-24): per record and `test_key`, among facts that are not removed, not unreadable and have `value_num` not null. Latest is the one with the newest `fact_date` (then `created_at`). Previous is the next older one on a different date. Compare only if `unit_as_printed` is identical after trimming; never convert units (NFR-18). Return both values and dates and nothing else: no direction word.
- L21. Referral facts: a `fact` with `kind = 'referral'` and `extra = { reason_as_written, urgency_as_written, urgency_code (routine|urgent|asap|stat, partner only), requester }`. A feed `ServiceRequest` creates one; extraction of a referral letter creates one from the letter. The patient-built `referral` row copies those strings verbatim and points to `source_fact_id`. No code path ever writes reason or urgency from anything else.
- L22. Extraction concurrency: claim a document with `UPDATE document SET status='extracting', ... WHERE id = $1 AND (status IN ('uploaded','failed') OR (status='extracting' AND started_at < now() - interval '120 seconds')) RETURNING *`. No row returned and status is `extracted`: return the existing facts. No row returned and status is `extracting`: 409 `extraction_in_progress`.
- L23. Extraction is refused with 403 `consent_required` if `account.ai_consent_at` is null (NFR-03).
- L24. Upload limits: images up to 1 MB (the device sends 500 KB or less); PDFs up to 4 MB. Larger gives 413 `file_too_large` with a clear message. The Vercel body limit is believed to be 4.5 MB and is **unverified**.

**Feed**
- L25. A hospital link is created for one chosen hospital by the patient (`POST /api/links { hospital_id }`) and returns a `link_ref`. It stays valid until revoked. The first accepted delivery records `hospital_patient_ref` from the bundle; later deliveries with a different reference are refused 403 `link_not_active`. The "one-time code" in FR-25 is the `link_ref` that the patient hands over once.
- L26. Feed check order: method (405) then bearer key (401) then `Idempotency-Key` present (400 `idempotency_key_required`) then body size (413) then JSON and Zod (422) then link (403) then replay (200) then write (202). Refusal bodies never contain record content or say why a link is not active.
- L27. A feed delivery's facts are `origin = 'provider_entered'`, `state = 'confirmed'`, with `hospital_id`, `facility_name`, `feed_receipt_id`. A re-sent Observation with the same `identifier` (system and value, stored as `source_identifier = "<system>|<value>"`) from the same hospital supersedes the older fact: set `superseded_by` on the old one. Superseded facts are kept but hidden from summaries.
- L28. FHIR value text: `valueString` is kept exactly. For `valueQuantity`, `value_as_printed` is the JSON number rendered as a string, which can lose a trailing zero (`12.0` arrives as `12`). The simulated hospital therefore sends results as `valueString` plus a unit when exact text matters. Document this limitation in `docs/api.md`.
- L29. The feed accepts `Content-Type` of `application/fhir+json` or `application/json`. At most 50 resources per bundle and exactly one `Patient` entry. Only `Observation` and `ServiceRequest` are accepted (the design's subset); anything else is 422.

**Testing and logging**
- L30. Unit tests (policy, guards, explanation, codes, FHIR subset, glossary lint) need no database. For integration tests, try in-memory Postgres via `@electric-sql/pglite` with Drizzle; if it does not work with the schema within 30 minutes, drop it, log it, and cover those paths in `scripts/smoke.ts`, which runs against `BASE_URL` and a real database.
- L31. Never log document contents, raw Gemini responses, share codes, viewer tokens or hospital keys. Log ids, statuses and error codes only.
- L32. Next.js 16: `params` is a Promise (`await params`); there is no `middleware.ts` (it became `proxy.ts`): do not use either; set headers in `next.config.ts` `headers()`. Route handlers use `export const runtime = 'nodejs'`.
