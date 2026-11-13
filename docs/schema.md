# Database tables (for Dev A)

Source of truth: `lib/db/schema.ts`. Postgres on Supabase (London). Row level security is on and deny-all for every table, so **browser code cannot query the database**: always call the API routes or the `lib/` functions. Values are kept as printed; `*_num`, `range_low`, `range_high` are derived by our code.

| Table | Purpose | Key columns |
|---|---|---|
| `account` | One row per Supabase auth user (same id) | `id`, `ai_consent_at` (null until the consent screen, NFR-03) |
| `patient_record` | A person's record | `display_name`, `birth_year`, `is_self` (false = held by a caregiver, FR-18) |
| `record_member` | Who holds which record | `account_id`, `record_id`, `role` = `holder` |
| `document` | An uploaded photo or PDF | `record_id`, `client_upload_id` (unique, makes uploads idempotent), `status` uploaded/extracting/extracted/failed, `error_code`, `doc_type`, `facility_as_printed`, `document_date_as_printed`, `uploaded_at` |
| `fact` | One medical fact | see below |
| `fact_event` | Append-only history of a fact | `fact_id`, `event`, `actor_type` system/patient/partner, `before`, `after`, `note` (dispute note) |
| `share` | A share code (only its hash is stored) | `record_id`, `purpose` general/referral, `expires_at`, `revoked_at`, `referral_id` |
| `viewer_session` | A clinician who opened a code | `share_id`, `viewer_name`, `practice_no` (unverified), `expires_at` |
| `access_log` | Append-only "who saw what" (FR-13) | `record_id`, `at`, `actor_type`, `actor_label`, `action`, `outcome` allowed/refused, `reason` |
| `code_attempt` | Rate limit on code guesses | `ip_hash` (never the raw IP), `at`, `success` |
| `referral` | A referral packet built by the patient | `source_fact_id` (the only place reason/urgency come from), `destination_facility_id`, `*_as_written` |
| `referral_ack` | "Received, service offered here" (never a bed statement) | `referral_id`, `status` service_offered/service_not_offered |
| `facility` | Short fictional list for referral destinations (FR-20) | `name` (all "(SIMULATED)"), `city` |
| `hospital` | Partner hospitals (one SIMULATED) | `name`, `simulated` |
| `hospital_credential` | Feed bearer keys (hashed) | `hospital_id`, `key_hash`, `revoked_at` |
| `hospital_link` | Patient linked a hospital (FR-25) | `record_id`, `hospital_id`, `link_ref` `ITN-LNK-XXXXXXXX`, `revoked_at` |
| `feed_receipt` | Every feed delivery, accepted or refused | `hospital_id`, `link_id`, `idempotency_key`, `status`, `refusal_reason`, `facts_created` |
| `glossary` | Plain-language test descriptions and questions. **No ranges** (NFR-17) | `test_key`, `aliases`, `description`, `questions` |
| `drug_allergy_rule` | Hand-built, not clinically validated (FR-17) | `allergy_aliases`, `medicine_aliases`, `note` |

## `fact` in detail

| Group | Columns |
|---|---|
| Identity | `id`, `record_id`, `kind` lab/medication/allergy/diagnosis/referral/other |
| Who vouches | `origin` ai_read/patient_added/provider_entered, `state` unverified/confirmed/disputed |
| As printed | `label_as_printed`, `value_as_printed`, `unit_as_printed`, `range_as_printed`, `flag_as_printed`, `fact_date_as_printed` |
| Derived by our code | `value_num`, `range_low`, `range_high`, `fact_date` (null = "date not readable"), `test_key` (glossary match or null) |
| Reading quality | `unreadable`, `check_carefully`, `confidence` |
| Provenance (NFR-16) | `document_id` + `source_quote` + `source_box` [ymin,xmin,ymax,xmax 0..1000] + `source_page` (AI-read); `feed_receipt_id` + `hospital_id` + `facility_name` (hospital-sent); `created_by_account_id` (patient-added) |
| Privacy | `sensitive_category`: null or one of `sexual_reproductive`, `mental_health`, `infectious_disease`, `substance_use`, `other_sensitive` |
| Lifecycle | `removed_at` (soft delete), `superseded_by` (a corrected hospital result replaced it; hide it), `extra` (kind-specific JSON) |

Display rules that come from the data: show `unverified` and `disputed` as word badges, never colour alone; a fact with `document_id = null` has no source image (the seeded demo facts are like this); hide facts with `removed_at` or `superseded_by` set.

## Demo data
`npm run db:seed:demo` creates `demo@itan.example` (password in `DEMO_PASSWORD`) with one record "Demo Patient (SYNTHETIC)": haemoglobin, two HbA1c values on two dates (for FR-24), fasting glucose, a penicillin allergy, amoxicillin (for FR-17), type 2 diabetes, and an anxiety diagnosis tagged `mental_health` (for the hidden-category demo). All invented.

## Normalisation and integrity (D-014)
Lists are child tables, never array columns: `share_hidden_category (share_id, category)`, `share_hidden_document (share_id, document_id)`, `glossary_alias`, `glossary_question`, `drug_allergy_alias`. Strings that record what a source said (`fact.facility_name`, `referral.*_as_written`, `access_log.actor_label`) are deliberate snapshots, not duplicates.

Database-level guarantees (migration 0003): `access_log` and `fact_event` cannot be updated, deleted or truncated; a hospital-sent fact cannot be edited, only disputed or tagged; patient-added and hospital-sent facts can never be stored `unverified`. Because audit rows cannot be deleted, tests and scripts must write to a throwaway record, never the demo record.
