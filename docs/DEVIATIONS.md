# Deviations and judgement calls

Every place the build differs from the design, or where the design was silent. Format: id, what, why, the alternative.

## D-001 Cache Components turned off (P0)
- **What:** `create-next-app` (Next.js 16.4.6) set `cacheComponents: true` and `partialPrefetching: true` in `next.config.ts`. Both were removed.
- **Why:** the bundled Next docs say Cache Components "does not support the `runtime` route segment config" and that any `runtime` export must be removed. Locked decision L32 requires `export const runtime = 'nodejs'` on route handlers. The product is dynamic and authenticated, so prerendering gains little.
- **Alternative:** keep Cache Components and drop the `runtime` export (Node is the default runtime). Choose this if Dev A wants Partial Prerendering for `/v`. Tell Dev B before the freeze.

## D-002 `@types/node` 24 instead of 20 (P0)
- **What:** scaffold pinned `@types/node@^20`; installed 24.19.2.
- **Why:** vitest 5.1.0 declares an optional peer of `@types/node` 22 or 24+, which made `npm install` fail with ERESOLVE. The machine runs Node 24.
- **Alternative:** vitest 4 with `@types/node` 20.

## D-003 Project root is `C:\Users\USER\Music\Itan` (P0)
- **What:** the design pack arrived in `itan-design-pack/`; its contents were moved to the repo root.
- **Why:** the owner asked for the repo at that path.

## D-004 Model pinned to gemini-3.6-flash (P0 follow-up, freeze item 6)
- **What:** `GEMINI_MODEL=gemini-3.6-flash`, chosen 13 Nov 2026 from the models page (badge "Stable") and a live call on the team key.
- **Why:** `gemini-2.5-flash` is deprecated (routes to 3.5 Flash-Lite from 1 Dec 2026). `gemini-3.8-flash` is Stable but returned 503 "high demand" on three calls. `gemini-3.5-flash-lite` is Stable and faster but is the smaller model, which is a worse choice for reading documents. `-latest` aliases and previews were excluded.
- **Watch:** one text-only call took 79 s and one harness run on a tiny PDF hit the 60 s timeout (13 Nov) (transient; the next ones took 1.6 s). `gemini-3.6-flash` spends "thinking" tokens even on trivial prompts, which costs latency. P2 should set the lowest thinking level the installed SDK allows, and Prep B must report real latency against NFR-10.
- **Alternative:** `gemini-3.5-flash-lite` if latency or quota is a problem; `gemini-3.8-flash` once demand settles. Change only `GEMINI_MODEL`.

## D-005 Prompt held as a TS constant as well as the .md (P2)
- **What:** `lib/extract/prompt-v1.md` is the readable source; `lib/extract/prompt.ts` holds an identical copy. A test fails if they differ.
- **Why:** reading a file at runtime inside a Vercel function depends on output file tracing (unverified).
- **Alternative:** `fs.readFileSync` with `outputFileTracingIncludes`.

## D-006 Guard details the design did not spell out (P2)
- G3 respects digit boundaries: "9.8" does not count as appearing in "19.8" or "9.85". Stricter than plain substring.
- An item without its own printed date takes the document's printed date as `fact_date_as_printed`.
- Referral reason, urgency, clinician and date are dropped (null, so the packet says "Not stated") when their text does not appear in their own source quote. This enforces hard rule 7 on the model's output.
- A printed range may carry a unit after it ("12.0 - 16.0 g/dL"); the bounds still parse. A reversed range ("16 - 12") keeps only the text.
- Two-digit years ("03/11/26") give a null date (ambiguous).
- The Prep B scorer also counts a confident wrong UNIT as a critical error (NFR-18), in addition to value, name and allergy.

## D-007 P1 fixtures skipped for now (owner's call, 13 Nov)
- The Prep B harness is built but has no fixtures to score, so NFR-15 is NOT RUN. Freeze item 12 stays open.
- The pipeline was checked once live on a hand-built synthetic PDF (three invented lab lines): schema accepted by Gemini, `ThinkingLevel.MINIMAL` accepted, 8.3 s, values and dates correct.

## D-008 ERD gaps filled (P3)
- **What:** columns the ERD does not draw were added exactly as listed in Locked decision L5, plus `document.started_at` (L22), `document.storage_path/mime/byte_size`, `fact.flag_as_printed`, `fact.created_at`, `viewer_session.created_at`, `hospital_credential.hospital_id`, `facility.created_at`, `glossary.display_name`, and `drug_allergy_rule.rule_key` (a natural key so the seed can upsert). `access_log.actor_type` has a CHECK (patient, clinician, partner, system); `fact_event.actor_type` has a CHECK (system, patient, partner). Patch the design doc at the freeze.
- **Why:** the design requires these and the ERD omits them.

## D-009 Glossary lookup reads the seed content, not the database (P3)
- **What:** `lookupTestKey` and `getGlossaryRow` in `lib/glossary.ts` use `lib/db/seed-data.ts`, the same rows `db:seed` writes. The `glossary` table still exists and is seeded.
- **Why:** the guards call the lookup synchronously inside extraction; no database round trip, and the explanation engine stays a pure function.
- **Alternative:** load from the table once and cache. Needed only if someone edits glossary rows in the database directly.
- **Consequence:** after editing `seed-data.ts`, run `npm run db:seed` so the table matches.

## D-010 Verified on the live project (P3, 13 Nov)
- Drizzle over the Supabase **transaction pooler** with `prepare: false` applied the migrations to an empty database (design section 18 item: now verified). `MIGRATION_DATABASE_URL` was not needed.
- supabase-js 2.119 accepts the new `sb_secret_` key for Storage and the Auth admin API.
- CHECK values are inlined as SQL literals (DDL cannot take bind parameters); `oneOf()` in the schema refuses anything but `[a-z0-9_/+.-]`.

## D-011 Policy details (P4)
- Matrix row "Confirm or correct an AI-read fact" is the action `confirm_or_correct_fact`. The holder may also correct their own `patient_added` facts (lifecycle: confirmed to confirmed, not provider_entered); provider_entered is denied `provider_entered_immutable`.
- `tag_sensitive_category` was added now rather than in P6 (allowed for a holder on any origin; denied for every other actor). It is the patient's privacy tag, not a clinical edit.
- A clinician whose share is for a different record gets 404 `wrong_record`, the same as a holder (NFR-06). A clinician viewing the source image of a fact hidden by the share gets 404 `hidden_category` (P8 says a hidden fact's image is 404).
- "—" cells (holder: hidden category via share, write through the feed) are denied `not_applicable`.
- Added routes `GET /api/records` and `GET /api/consent` so Dev A can load the record list and the consent state.

## D-012 Commit author placeholder
- Commits use the author `Itan Dev B <devb@itan.invalid>` because no git identity was set on this machine. Set `git config user.name` / `user.email` to change it for future commits.

## D-013 Model latency has a long tail; timeout policy changed (P5/P6 testing, 13 Nov)
- **Measured** (gemini-3.6-flash, one-page synthetic PDF, 8 sequential calls): 3.2 to 6.2 s for seven, 24 s for one. Elsewhere in the same session: a 64 s timeout and a 79 s reply. The average is fine; the tail is not (NFR-10 target 30 s).
- **Change:** per-attempt timeout 25 s (was 60 s) and one retry after a timeout. A request now fails only if two attempts both stall; worst case about 55 s, inside `maxDuration = 120`.
- **Failure path verified:** a timed-out extraction returned 502 `extraction_failed`, marked the document `failed`, wrote no facts, and the route can simply be called again.
- **Open:** if the tail stays bad on demo day, switch `GEMINI_MODEL` to `gemini-3.5-flash-lite` (stable, smaller) and re-run Prep B. Report the slowest time, not the median, as the NFR-10 result.

## D-014 Database normalisation and integrity triggers (owner request, 13 Nov)
- **Normalised to first normal form:** the array columns `share.hidden_categories`, `share.hidden_document_ids`, `glossary.aliases`, `glossary.questions`, `drug_allergy_rule.allergy_aliases/medicine_aliases` became child tables `share_hidden_category`, `share_hidden_document`, `glossary_alias`, `glossary_question`, `drug_allergy_alias` (migration 0002). A test fails if any table has an array column.
- **Deliberate denormalisation, kept:** `fact.facility_name` and the `referral.*_as_written` strings are snapshots of what a source said, as printed or as sent. They must not change if a hospital is renamed or a facility row edited, so they are data, not duplicates. `access_log.actor_label` is a snapshot for the same reason. `fact_event.before/after` are JSON diffs.
- **Atomicity (ACID):** every multi-row write runs in one transaction (record + holder; extraction facts + events + document status; fact change + event; seed reference data). Extraction claims use one atomic UPDATE.
- **Consistency:** foreign keys, CHECK constraints, unique constraints, and migration 0003 triggers: `access_log` and `fact_event` reject UPDATE, DELETE and TRUNCATE; a `provider_entered` fact rejects any change except state (confirmed or disputed) and the patient's category tag; non-AI facts cannot be stored `unverified`. Verified against the live database.
- **Isolation:** Postgres default (read committed). Races that matter are handled by atomic statements (extraction claim, upload idempotency via a unique key). Nothing relies on serialisable isolation.
- **Cost of append-only:** test rows written to audit tables cannot be deleted, so scripts must write to a throwaway record, not the demo record (smoke does). A one-off cleanup of earlier smoke rows was run on the synthetic dev database inside one transaction, with the triggers re-enabled and checked afterwards.
- **Layering (separation of concerns), enforced by tests/architecture.test.ts:** routes (`app/api`) do HTTP only and never import the database; services and queries own SQL and transactions; pure rule modules (policy, lifecycle, correct, compare, extract guards and parsers, glossary, crypto) import no database, storage, network client or environment.

## D-015 Model switched to gemini-3.5-flash-lite (13 Nov, supersedes D-004)
- **What:** `GEMINI_MODEL=gemini-3.5-flash-lite` (badge "Stable" on the models page).
- **Why:** measured the same afternoon on the same synthetic one-page PDF: `gemini-3.6-flash` failed 2 of 6 calls with provider errors even after our retries and had stalls of 24, 56 and 64 s; `gemini-3.5-flash-lite` completed 12 of 12 calls in 1.9 to 3.1 s and read the document identically (every value, unit, range, the date, and the blank result left empty). It is also the smaller, cheaper model, which fits the "lightweight" goal.
- **Not yet known:** accuracy on phone photos, blur, and the prescription and referral layouts. Run Prep B (`npm run extract-test`) on real fixtures before the freeze. If NFR-15 fails on this model, set `GEMINI_MODEL=gemini-3.6-flash` (or `gemini-3.8-flash`) and re-run: only the env var changes.
- Vercel needs the same `GEMINI_MODEL` value in its environment variables.

## D-016 P8 file layout and small calls (13 Nov)
- **Layout:** to keep SQL out of pure files, the rate-limit queries are in `lib/share/queries.ts` (not `ratelimit.ts`), `session.ts` holds only pure helpers, and `getViewerFromRequest` / `getViewerSummary` live in `lib/share/service.ts`. Dev A imports them from there.
- **Referral shares need a `referral_id`** (the prompt left it optional). Without one there is nothing to acknowledge or build a packet from.
- **Refused-open log entries carry the typed name and practice number** so the patient can see who tried an expired or revoked code. An unknown code is recorded only in `code_attempt` (L10).
- **Cookie `Secure`:** set when `NODE_ENV === "production"`, not on local http development (browsers would refuse to store it there).
- **The `/c` page is Dev A's.** It must read the code from `location.hash` and POST it to `/api/view/open`; the server never sees the fragment.

## D-017 P10 feed and link judgement calls (13 Nov)
- **415 for a wrong Content-Type.** L29 names the accepted types but the check order (L26) has no step for it. Placed after the size check and before JSON as 415 `unsupported_media_type` (refused receipt written). Alternative: fold it into 422.
- **Unit with `valueString`.** FHIR `valueString` has no unit, but L28 says the simulated hospital sends "valueString plus a unit". The unit is taken from `referenceRange[0].low.unit` or `high.unit` (valid FHIR SimpleQuantity). Alternative: a custom extension, which is less standard.
- **A different hospital patient number gets the same 403** as unknown, revoked and other-hospital links (L25 says it is refused; the identical-body rule then applies). The link is re-checked under a row lock (`SELECT … FOR UPDATE`) inside the write transaction, so a revoke that lands mid-request wins.
- **Idempotency-Key must be a UUID** (the contract says `<uuid>`); anything else is 400 `idempotency_key_required`.
- **A bundle needs at least one Observation or ServiceRequest.** A Patient-only bundle is 422, since it would write nothing.
- **Partial FHIR dates** (`2026`, `2026-11`) are 422: `fact_date` needs a full date and guessing a day is not allowed.
- **Feed referral facts** have `label_as_printed = "Referral"` and `fact_date = null` (the subset carries no `authoredOn`).
- **The catch-all is `app/api/feed/[[...path]]`** (optional catch-all), so `/api/feed` itself is also 405. The specific `v1/bundles` route takes precedence.
- **A patient may create several links to the same hospital.** Nothing in the design limits it; each is listed and revocable.
- **Refusal logging is best effort.** If writing the refused receipt fails, the refusal is still returned, and `console.error` logs the reason code only.
- **Known cost:** every unauthenticated 405 or 401 writes one `feed_receipt` row, so a flood would grow the table. Acceptable for the contest. Rate limiting the feed is future work, alongside signed requests (design section 14).
- **The simulated hospital CLI uses `process.exitCode`**, not `process.exit()`. The latter crashed Node on Windows (`UV_HANDLE_CLOSING` assertion) while fetch sockets were closing.
- **Superseding was verified live, not by a unit test** (P12's smoke now repeats it on every run). It is SQL inside the transaction, and L30 leaves no in-memory Postgres here. Live run on 13 Nov: three haemoglobin deliveries left two superseded rows kept and one current; the provider-fact trigger allowed only the `superseded_by` change. P12's smoke should repeat it.

## D-019 P1 fixtures: judgement calls (13 Nov, supersedes D-007)
- **Photo fixtures are JPEG, not PNG.** The prompt said PNG at 500 KB or less. A phone photo is a JPEG and the app's device-side re-encoding sends JPEG, so the "photo" fixtures are `.jpg` (26 to 99 KB). The size and long-edge limits are enforced in `tests/fixtures.test.ts`. PDFs are PDFs.
- **Installed Chrome, no browser download.** Playwright 1.65 and sharp 0.35 are dev-only, installed with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. `npm run fixtures` launches the installed Chrome (or Edge). If neither exists it prints `npx playwright install chromium` and exits 1. Only the npm packages (about 35 MB) were downloaded.
- **One spec generates both document and key** (`tools/fixtures/specs.ts`), so a key cannot drift from its page. The test checks every readable key string appears in the HTML verbatim.
- **Keys use the page's exact words**, because the scorer compares text exactly (whitespace collapsed). The referral reason and urgency have no trailing full stop on the page, so a model that adds one is not unfairly marked wrong or right on punctuation.
- **The referral letter prints no diagnosis**, so a diagnosis the model reports from it is a "not in key" item. That is deliberate: a reason for referral is not a diagnosis.
- **All ten fixtures were built**, not the seven-document cut. Dates: dd/mm/yyyy in eight, ISO in one, none in the blurred sheet.
- **Not real photographs.** These have a printed-photo look made by code. Two should still be printed and photographed with a real phone (README).

## D-021 Browser sign-in uses Supabase directly, with two public variables (13 Nov)
- **Decision (owner): option 1.** The browser signs up, signs in and signs out against Supabase Auth with `createBrowserClient` (`@supabase/ssr`). The alternative, server-side `/api/auth/*` routes (option 2), was not built. This changes hard rule 9 in the working rules, which used to forbid every `NEXT_PUBLIC_` name. The design was frozen at 12:00 on 13 Nov; this is a recorded owner decision, not a drift.
- **What is allowed now:** exactly `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Any other `NEXT_PUBLIC_` name fails `tests/static.test.ts` (d), and so does any `NEXT_PUBLIC_` name containing `SERVICE_ROLE`, `PEPPER`, `GEMINI`, `HOSPITAL`, `SECRET` or `TOKEN`, even if someone adds it to the allowlist. A negative-control test proves the checker flags those names.
- **The browser client is for auth only.** `tests/static.test.ts` (f) fails any client file (starts with `"use client"`, lives under `components/`, or calls `createBrowserClient`) that uses `.from(`, `.rpc(` or `.storage`. Limit: it is a text check on source files. Today there are **no client files at all**, so it passes without checking anything real yet; it starts to bite when Dev A's pages land. A client component that imports a helper which touches data would not be caught.
- **RLS and the bucket are now the only barrier** between the public key and the data, so they are checked against the live database: `npm run rls:check` (also run first thing in `npm run smoke`). Result on 13 Nov: all 24 tables in `public` have RLS enabled; no policy in `public` applies to anon or authenticated; the `documents` bucket exists, is private, and no policy on `storage.objects` reaches it. The check is read-only and prints names only. It checks the current state, so run it again after any migration or dashboard change.
- **`getAccountId` verified.** It reads the `@supabase/ssr` session cookie and verifies the token with Supabase on every call; the `Authorization: Bearer` fallback is kept and takes precedence. `tests/auth-cookie.test.ts` proves this offline against a cookie produced by the real library (Supabase stubbed). `npm run smoke` repeats it live (`SMOKE_ONLY=auth npm run smoke` runs just these checks and the RLS ones, with no uploads or model calls; passed on 13 Nov against the local server and the real Supabase project): a real sign-in, the cookie alone gives 200, a bad Bearer gives 401, a tampered cookie gives 401.
- **Accepted: the anon key can sign anyone up.** The key is public, so anyone can call Supabase's sign-up endpoint and create an account without using our UI. Such an account can only reach its own, empty data: every route checks record membership (`can()`), and nothing grants access by being signed in. The cost is junk accounts, bounded by Supabase's own rate limits. Not mitigated for the contest. If it matters later: turn sign-up off after the demo accounts exist, or add CAPTCHA.
- **Accepted: the session cookie is readable by page JavaScript.** That is how `createBrowserClient` stores it. A script injected into the app could read it. Mitigation is to ship no third-party scripts and no `dangerouslySetInnerHTML` of untrusted text. The clinician side is unaffected: `itan_v` is still HttpOnly.
- **Email confirmation is OFF in Supabase (stated by the owner, 13 Nov).** Built-in Supabase email is heavily rate limited, so with confirmation on a live sign-up could stall on "check your email". Not verified from here: no live sign-up has been run, so `signUp` returning a session straight away is untested. If it is ever turned back on, `signUp` returns no session and Dev A's screen must say "check your email"; the pre-created demo account (`npm run db:seed:demo`) also works either way.
- **Vercel (project `itan`, 13 Nov).** Both `NEXT_PUBLIC_` variables are set for Production, Preview and Development. The server variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SHARE_PEPPER`, `DEMO_PASSWORD`) are set for Production and Preview (Development uses `.env.local`); secrets are stored as sensitive. `MIGRATION_DATABASE_URL` is deliberately not on Vercel. Before this the project had **no** variables, and any route that read them returned 500. The values went from `.env.local` to the Vercel CLI by pipe, never printed.
- **Deployed checks, 13 Nov (`https://itan-five.vercel.app`, commit `b746e64`).** Region `lhr1`. RLS, bucket and cookie-session checks pass. The full smoke gave 126 PASS and 7 FAIL, and the 7 are a **test-harness artefact, not an app defect**: the smoke fakes five client IPs with `x-forwarded-for`, Vercel overwrites that header with the real client IP, so every attempt counted against one IP, the rate limiter correctly returned 429, and the referral-share and acknowledgement checks after it never ran for real. Confirmed by sending two different spoofed headers to `/api/view/open` (both 429). **Consequence: the referral share and acknowledgement path has not been verified on the deployed site** (it passed locally, 13 Nov). The smoke was not changed. Side effect worth knowing: the limiter cannot be dodged by forging `x-forwarded-for` on Vercel. Several clinicians behind one NAT (a hospital) share one limit.

## D-020 Prep B first results, and the unit-comparison rule that followed (13 Nov)
- **What happened, in order (so it can be explained plainly):**
  1. The first Prep B run was scored strictly and gave NFR-15 FAIL, 2 critical errors. Both were one finding: on `lab-chem-photo` the model returned `μmol/L` (U+03BC, Greek mu) where the key has `µmol/L` (U+00B5, micro sign).
  2. The owner then decided the unit comparison rule should be refined. **The rule was written after seeing this result**, and it was applied to the SAVED results, not to a new run. Why: the two characters are identical to a reader and are not a wrong value, medicine, dose or allergy, and the same difference silently removed the previous-value comparison (FR-24).
- **Both numbers, always reported together.** Scored strictly: **2 critical errors**. Under this rule: **0 critical; 2 glyph variants in 1 document, reclassified.** The report states both ("Critical errors: 0 as reported; 2 if unit glyph variants were counted as critical").
- **Verdict as saved:** `NFR-15: INCOMPLETE (0 critical errors in 19 scored; 2 glyph variants, reclassified, see D-020; 1 failed to extract, not scored)`. It is INCOMPLETE, not PASS, because 1 of the 20 calls in that run failed with a provider error. Every one of the 10 documents still has at least one scored run. The scorer was **not** changed to turn this into a PASS. A clean PASS needs a run with no failed calls.
- **The rule (`lib/facts/units.ts`, one shared `unitsEqual()`):** Unicode NFKC, collapse whitespace, trim, applied to the **unit string only**, **for comparison only**.
  - No case folding and no other character mapping: `mmol/L` vs `µmol/L`, `g/dL` vs `g/L` and `mmol/L` vs `mmol/l` are all different.
  - Never applied to labels, values, ranges, medicines or allergies.
  - **The stored text is kept as the model returned it.** We do not rewrite it, and we do not claim it is "as printed" at the character level, because we cannot verify the glyph.
  - The strict unit hit-rate still counts a variant as a miss (unchanged in the report).
  - Known consequence of NFKC, accepted: superscript digits fold to plain digits, so `10⁹/L` equals `109/L`. Pinned by a test; do not widen the rule.
- **Rescoring:** `npm run extract-test -- --rescore` re-applies the rule to the saved `tools/prepb-results.json` and rewrites the report. It makes **no model calls** and needs no key. It changed only the `critical` and `glyph_variants` fields; every hit-rate is unchanged. No other scoring was tuned on any other finding (for example the clinician line below).
- **Where units are compared (reviewed):** `lib/facts/compare.ts` (previous value, FR-24) and the scorer. `compare.ts` takes facts of any origin, so a hospital-feed result versus an AI-read result goes through the same shared helper. The rest only print, store or null a unit (`explain/engine.ts`, `extract/guards.ts`, `feed/map.ts`, `extract/numbers.ts`). `facts/correct.ts` compares the patient's old and new text to record an edit, and is deliberately raw: changing a character is an edit.
- **Call counts, stated plainly.** First run: 10 calls (9 scored, 1 failed). Second run, the one in `tools/prepb-report.md`: 20 calls = 10 documents x 2 runs (19 scored, 1 failed). 30 calls in total, 2 provider failures (`model_unavailable`, after retries), on different documents. The saved report and results cover the second run only.
- **Latency of the 19 scored calls (unthrottled, server-side):** median 11.2 s, p90 35.1 s, p95 37.9 s (nearest rank; with n=19 that is the maximum), max 37.9 s; 4 calls over 25 s, 2 over 30 s. Failed calls have no recorded time. This excludes 3G transfer, which is not measured (the throttle script is not built, D-018). **NFR-10 is at risk and NOT MEASURED.**
- **Model pin.** The model tested was `gemini-3.5-flash-lite` (`GEMINI_MODEL` in `.env.local`, D-015). **The demo must run on exactly that model.** Set the same value in Vercel, and if it is ever changed, re-run Prep B first.
- **Update, 13 Nov evening: a later clean run.** `npm run extract-test` again, same model and prompt, one run per document: 10 calls, all 10 scored, none failed, 0 critical errors, **`NFR-15: PASS`**, no glyph variants in that run. `tools/prepb-report.md` and `tools/prepb-results.json` now hold **this** run; the earlier two-run results are in git history (commit `1902e89`). Totals: 40 calls, 2 provider failures. The INCOMPLETE verdict above is not erased: it described that run, and this is a different run with one run per document. Latency this run: median 4.8 s, max 8.1 s (earlier: median 11.2 s, max 37.9 s); the variation is unexplained, so quote both.
- **Not tuned, noted only:** on the referral letter the referring clinician came back as the clinician line plus the next line ("Medical Officer"). That field is not scored.

## D-018 P12 hardening changes and judgement calls (13 Nov)
- **Auth outage is 503, not 401 (lib/auth.ts, lib/http.ts; P4 code changed).**
  - **Found live:** Supabase Auth `getUser` stalled for 10 to 45 s from Nigeria, and `getAccountId` returned null, so signed-in calls got 401. In the app that would look like being signed out.
  - **Now:** a rejected token is still 401. A retryable Auth error (network failure or 5xx) or no answer within `AUTH_TIMEOUT_MS = 8000` throws `ServiceUnavailableError`, which `withErrors` turns into 503 `service_unavailable` with `Retry-After: 5`.
  - The timeout races the auth call only, so slow Storage uploads through the same client are not cut off.
  - **Alternative, not done:** verify the JWT locally (Supabase signing keys / `getClaims`) to remove the network round trip. That is faster, but it changes how identity is checked and needs the key setup confirmed.
- **NFR-13 notice added to API responses (additive field `ai_notice`).**
  - Only the per-fact explanation said "read by AI / may contain errors / not medical advice".
  - The timeline, the document view, the extraction response, the clinician summary and the referral packet now carry `ai_notice`. The text is in `lib/notices.ts`, with patient and clinician wordings.
  - This touches P5, P6, P8 and P9 response shapes, without breaking anything.
- **Allowed `console.log`: `lib/db/seed.ts` only.** It is an operator CLI that prints a new hospital key once by design. The P12 static rule otherwise bans `console.log` in app/ and lib/.
- **Dev A pages in the api.md check.** `/v` and `/v/referral` are listed in `docs/api.md` but are Dev A's pages and not built. `tests/static.test.ts` (c) checks every `/api` route strictly. It reports the two pages as a named `todo`, and the check becomes a real assertion as soon as either page file exists. The test was not weakened: the Dev B part is strict.
- **Smoke now covers:** region (deployed only), security headers, two throwaway accounts (created and deleted through the admin API, with their `account` rows deleted), the Secure cookie (https only), the feed suite as a child process (node plus tsx's entry, no shell), live superseding, and the AI notices.
- **Throttle script (P12 item 3):** first left unbuilt because it needs Playwright, a new dev dependency. Playwright and sharp were then approved and installed (D-019), and `scripts/throttle.ts` (`npm run throttle`) is built. Its pure part is unit-tested (`tests/throttle.test.ts`). **A live run has not been done yet**, so NFR-10 is still NOT MEASURED on 3G; the machine had about 1 GB free, too little for a production build, the server and Chrome together.

## D-022 R1 backend review: judgement calls (13 Nov)
- **Corrections to earlier entries (doc drift found in review, N-13).** D-020's "the throttle script is not built (D-018)" and D-018's "a live run has not been done yet" are out of date: `scripts/throttle.ts` exists and one deployed Fast 3G run is in `docs/evidence/throttle.md` (NFR-10 WITHIN, slowest 6.2 s of 5; NFR-11 SKIPPED, `/v` not built). The original lines are left as written, as a log.
- **Upload sniffing (S-02).** A file whose first bytes are not the JPEG, PNG or PDF it declares is 400 `unsupported_type` (the existing code, a new reason). A PDF header is accepted anywhere in the first 1024 bytes. Alternative: re-encode images on the server (rejected: the device does it, and it costs CPU).
- **Storage deadline 20 s (S-06)** on the service client's `fetch`, combined with any caller signal. Chosen above the 8 s auth race and far inside the 120 s extraction budget. Alternative: a per-call timeout in `lib/storage.ts` only (rejected: the Auth admin calls would stay unbounded).
- **Structured logs (S-09)** are `console.warn` / `console.error` lines of JSON from `lib/log.ts` (`event`, `route`, `request_id`, ids, statuses, codes). `request_id` is `x-vercel-id` when present. The static no-secrets-in-logs heuristic now also covers `logEvent(...)` calls. A `ConfigError` message (variable names only) is logged; no other error message is.
- **`ai_notice` added to `GET /api/referrals/{id}` (S-07)**, patient wording, additive.
- **New routes in the api.md table, checked both ways.** The static test now also fails a `route.ts` (or exported method) missing from the table. The feed catch-all and the feed route's non-POST methods are exempt: they are the documented 405s.
- **`lib/api-types.ts` (S-15)** is type-only by rule (tested). Records, consent, dispute and category body types are written out by hand because their schemas live in route files; the rest are derived from the schemas and builders.
- **Migration 0004 (two indexes)** was generated offline, then applied to the team database with `npm run db:migrate` on 13 Nov; both indexes confirmed in `pg_indexes`.
- **Not done in R1, on purpose:** see "open" and "needs decision" in `docs/BACKEND-REVIEW.md`. In particular, B-02 (source image shows category-hidden items), S-03 (upload retry race), S-04 (fact transition race), S-05 (rate-limit race), S-10 (optional env vars), S-16 (CSP) and S-17 (demo account data).

## D-023 Two-step sign-in (FR-28), added after the design freeze (14 Nov)
- **Change request, approved by the team lead on 14 Nov.** Not in the frozen design. Authenticator-app codes (TOTP) through Supabase Auth; no SMS (cost and delivery in Nigeria).
- **Rule.** An account with a verified TOTP factor must have a session at assurance level `aal2` before `POST /api/shares` and `POST /api/links`. Otherwise 403 `mfa_required`. Accounts with no factor are unaffected. `revoke` and `unlink` never need the code, so ending access stays easy.
- **Where.** `requireStepUp` in `lib/auth.ts`, called after the permission check in the two routes. The level is read from the `aal` claim of an access token that `getUser` has just verified; enrolment is read with the Supabase Auth admin API, and only when the session is not already `aal2`.
- **Fail closed.** An unreadable level on an enrolled account asks for the code. A failed or slow factor lookup is 503 `service_unavailable`, never a silent pass.
- **Tests.** `tests/mfa.test.ts` (rule matrix, fail-closed cases, and the two routes that must and must not require it). **Not verified live:** enable MFA (TOTP) in the Supabase project, enrol a throwaway account, and check that `POST /api/shares` answers 403 at `aal1` and 201 after the code. Do not enrol `demo@itan.example`: the smoke and throttle scripts create shares with it and would hit `mfa_required`.
- **Recovery.** None in this version. The team resets a factor in the Supabase dashboard.
