# R1: backend engineering review (Dev B side)

Reviewed 13 Nov 2026 against commit `b1bd1eb`, for Dev B. Scope: everything under `app/api/**`, `app/v/facts/[id]/image`, `lib/**`, `scripts/**`, the migrations, the tests and the Dev B docs. Dev A's pages, components and service worker are not built yet and are out of scope.

Method: read every route and library file. Ran the checks below. Probed the running app read-only as the demo user (a production `next start` on the local machine against the real Supabase project; no writes except the idempotent `ensureAccount`). Every finding names a file and line, the failing input or concrete consequence, and a fix. Where I could not run something it says **NOT RUN** and why.

## Checks run

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 problems) |
| `npm test` | PASS: 23 files, 561 passed, 1 skipped, 1 todo (the skip and todo are Dev A's `/v` pages, by design) |
| `npm run build` | PASS (34 routes) |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npx knip` | 1 unused dependency (`idb-keyval`, Dev A's, keep), 25 unused exports, 11 unused exported types (see N-11) |
| `npx madge --circular lib app --extensions ts` | No circular dependency (90 files) |
| `npx depcheck` | NOT RUN: knip covers the same ground |
| `npx vitest run --coverage` | NOT RUN: `@vitest/coverage-v8` is not installed (only `@vitest/mocker` and `spy`) |
| Live read-only probe (`scratch/r1-probe.ts`, gitignored) | 24 calls, all as documented: see "Looks good" |
| CI workflow | NOT RUN: there is no CI (S-12); GitHub Actions cannot run from here |

Note for the team: the long-running `next dev` on port 3000 began returning 500 for `/api/records/[id]/facts` ("Jest worker encountered 2 child process exceptions") after `npm run build` wrote into `.next` while it was running. That is a dev-environment artefact, not an app defect: the same route returned 200 on a fresh `next start`. Restart `npm run dev` after any `npm run build` in the same folder.

## Summary

| Severity | Found | Fixed in R1 | Open | Needs decision |
|---|---|---|---|---|
| BLOCKER | 2 | 1 | 0 | 1 |
| SHOULD FIX | 17 | 10 | 5 | 2 |
| NICE TO HAVE | 19 | 7 | 12 | 0 |
| **Total** | **38** | **18** | **17** | **3** |

Phase 2 ended with typecheck, lint, test (27 files, 584 passed, 1 skipped, 1 todo) and build all passing. No fix had to be reverted.

---

## BLOCKER

### B-01 README is the create-next-app boilerplate
- **Area:** 8 developer experience. **File:** `README.md:1-36`.
- **Problem:** the README says "This is a Next.js project bootstrapped with create-next-app" and nothing else. It does not list the env vars, the scripts, the setup order, the demo login or who owns what.
- **Consequence:** a new person who clones the repo cannot get to a signed-in demo without reading `docs/HANDOVER-DEV-A.md`, `.env.example`, `package.json` and the seed scripts. Two steps they need are written nowhere in the README: `npm run storage:init`, without which the `documents` bucket does not exist and every upload returns 502 `storage_failed`, and the demo email `demo@itan.example`.
- **Fix:** a real README: prerequisites, the six setup commands in order, every env var with where it comes from, every script, the demo login, Dev A versus Dev B ownership, and pointers to `docs/api.md` and `lib/api-types.ts`.
- **Status:** fixed in `52fe225`

### B-02 A source image can show facts the patient hid by category
- **Area:** 4 security / FR-15 privacy. **Files:** `lib/share/service.ts:206-227`, `lib/share/filter.ts:15-20`, `lib/policy.ts:87-91`.
- **Problem:** hiding by **category** removes the tagged fact from the summary, but `GET /v/facts/{id}/image` for any *other* fact on the same document returns a signed URL to the **whole page**. Only hiding a whole document (`hidden_document_ids`) keeps that page away from the clinician.
- **Failing input:** one lab sheet holds Haemoglobin and an HIV result. The patient tags the HIV fact `infectious_disease` and shares with `hidden_categories: ["infectious_disease"]`. The clinician opens the Haemoglobin image and reads the HIV result on the same page. The summary's `partial_notice` promises the item is hidden; it is on the image.
- **Fix (needs a decision, not done in R1 because it changes share semantics):** in `getSharedFactImageUrl`, refuse (404, like any hidden item) when **any** non-removed fact on the same `document_id` is hidden by the share. Alternatively, when the patient tags a fact with a sensitive category, also hide its document in new shares, or show the patient a warning on the share screen. At the very least, say this in `docs/limitations.md` and on the share screen. **Dev A impact:** with the server-side fix, some "View source" links on the clinician summary return 404. Dev A should hide the link when `has_image` is true but the image is refused, or the server can add an `image_available: false` flag to the summary's fact DTOs (additive).
- **Status:** **needs decision** (privacy semantics of FR-15; Dev A impact noted above). Documented meanwhile in `docs/limitations.md` §3 (`782a963`).

---

## SHOULD FIX

### S-01 Three routes decide access without `can()` (hard rule 3)
- **Area:** 1 structure / 4 security. **Files:** `app/api/documents/[id]/route.ts:8-16` (no `can()` at all), `app/api/shares/[id]/revoke/route.ts:13-14` (membership checked inline in `revokeShare`, `lib/share/service.ts:101`), `app/api/referrals/[id]/route.ts:13` (inline in `getReferralForHolder`, `lib/referral/service.ts:94`).
- **Problem:** The design rule (hard rule 3) says every permission goes through `can(actor, action, resource)`. These three use `recordIds.includes(...)` instead.
- **Consequence:** today they give the same answers, because a holder is allowed these actions. But a change to the policy matrix (for example a read-only caregiver role, or a narrowed `see_whole_record`) would silently not apply to these three routes. No test catches the gap.
- **Fix:** resolve the record id, then call `can(actor, "see_whole_record" | "create_or_revoke_share", { recordId })`, the same as the link-revoke route. Add a static test that every holder route calls `can(` (directly or through `loadFactForAction`). Permission outcomes do not change.
- **Status:** fixed in `5e2cd25`

### S-02 Upload type is trusted from the client's header
- **Area:** 4 security. **Files:** `app/api/documents/route.ts:32` (`mime: file.type`), `lib/documents/service.ts:36`.
- **Problem:** `file.type` comes from the multipart part's `Content-Type`, which the client chooses. Nothing checks the bytes.
- **Failing input:** an HTML or SVG file sent with `Content-Type: image/png` is stored as `records/…/….png` with `contentType: image/png`, and then sent to Gemini as a PNG. The extraction fails, but the object stays in the bucket under a trusted name.
- **Fix:** check the magic bytes (`FF D8 FF` JPEG, `89 50 4E 47 0D 0A 1A 0A` PNG, `%PDF-` PDF). Refuse a mismatch with the existing 400 `unsupported_type`. Filenames are already never used (the storage path is `records/{record}/{uuid}.{ext}`).
- **Status:** fixed in `30d9842` (`lib/documents/sniff.ts`, `tests/upload.test.ts`)

### S-03 Concurrent upload retries can 500, and a crash mid-upload leaves a document that can never be read
- **Area:** 3 correctness / NFR-12. **File:** `lib/documents/service.ts:45-69`.
- **Problem 1 (read-then-write race):** the idempotency check is a `SELECT` followed by an `INSERT`. Two requests with the same `client_upload_id` (the device's queue retrying while the first is in flight) both see no row. The second `INSERT` hits `document_client_upload_id_uq` and the route answers 500 `internal_error`, not the 200 the contract promises.
- **Problem 2 (half-written state):** the row is inserted *before* the Storage `put`. If the function is killed between the two (timeout, deploy), the row stays as `uploaded` with no object. Every retry with the same `client_upload_id` returns 200 `uploaded`. `extract` then fails at `storage.get` with `extraction_error`, forever.
- **Fix:** `INSERT … ON CONFLICT (client_upload_id) DO NOTHING RETURNING`. On conflict, re-select and return it. When an existing row is still `uploaded`, repeat the `put` with `upsert: true` before answering, so a retry heals a missing object.
- **Why not fixed in R1:** this is the upload's retry semantics, and it can only be tested against a database (no in-memory Postgres here, L30). It needs a `scripts/smoke.ts` case with two parallel uploads.
- **Status:** open

### S-04 Fact changes are read-then-write without a state guard
- **Area:** 3 correctness / NFR-24. **Files:** `lib/facts/service.ts:72-87` (`transitionFact`), `:91-104` (`correctFact`), `:107-118` (`tagCategory`).
- **Problem:** the lifecycle is checked against the row loaded earlier in `loadFactForAction`. The `UPDATE … WHERE id = $1` does not repeat that check.
- **Failing input:** a double-tap on Confirm sends two requests. Both see `unverified`, both update, and two `confirmed` events are appended. Worse, a `correct` racing a `remove` can edit a fact that has just been removed, giving a removed fact a fresh `corrected` event.
- **Fix:** `UPDATE fact SET … WHERE id = $1 AND state = $prevState AND removed_at IS NULL RETURNING *`. When no row comes back, return 409 `invalid_transition`. **Why not fixed:** it touches lifecycle semantics and needs a database to test. **Dev A impact:** none. A lost race already gets a 409 code that Dev A handles.
- **Status:** open

### S-05 The code-guess rate limit is check-then-insert
- **Area:** 3 correctness / NFR-05. **File:** `lib/share/service.ts:147-157`, `lib/share/queries.ts:81-88`.
- **Problem:** `countRecentFailures` and `recordAttempt` are separate statements.
- **Failing input:** 100 simultaneous `POST /api/view/open` from one IP all read a count under 5, so all 100 codes get checked instead of 5. With 40-bit codes the success odds stay tiny (100 / 2^40 per live share), but the limit is not what L10 states.
- **Fix:** run the count and the insert in one transaction behind `pg_advisory_xact_lock(hashtext(ip_hash))`. **Not fixed:** share semantics are locked (L10), so this needs the team's agreement. No Dev A impact.
- **Status:** **needs decision** (L10 is locked)

### S-06 No timeout on Supabase Storage calls
- **Area:** 5 robustness. **Files:** `lib/supabase.ts:13-15`, `lib/storage.ts:19-35`.
- **Problem:** Gemini has a 25 s per-attempt timeout and a 100 s budget, and Auth has an 8 s race. Storage `upload`, `download` and `createSignedUrl` have none: supabase-js uses plain `fetch` with no signal.
- **Consequence:** a stalled Storage call holds the upload request until the platform kills it (300 s default on Vercel). Inside extraction, a stalled `download` eats the 120 s `maxDuration` before Gemini is even called. The document then stays `extracting` until the 120 s stale-claim window passes.
- **Fix:** give the service client `global.fetch` with `AbortSignal.timeout(20 s)`, combined with any caller signal. A timeout then becomes the existing 502 `storage_failed` / `extraction_failed` paths.
- **Status:** fixed in `dde365e` (`tests/timeouts.test.ts`)

### S-07 The referral preview carries facts but no `ai_notice`
- **Area:** 2 API consistency / NFR-13. **File:** `lib/referral/service.ts:96-109`.
- **Problem:** `docs/api.md:61` says every response that carries facts carries `ai_notice`. `GET /api/referrals/{id}` returns `packet.results/medicines/allergies` (FactDTOs, possibly AI-read) without it. The viewer version (`:125`) has it. `tests/static.test.ts` passes only because the viewer function is in the same file.
- **Fix:** add `ai_notice: AI_NOTICE_PATIENT` (additive field) and make the static test require it in both builders.
- **Status:** fixed in `637113e`

### S-08 A missing env var shows up only as "route error Error"
- **Area:** 9 operability. **Files:** `lib/config.ts:31-32`, `lib/http.ts:72`.
- **Problem:** `env()` throws a useful message naming the missing variables (never their values). But `withErrors` logs only `name` and `code`, so the operator sees `route error "Error" ""` and a 500, with nothing saying which variable is missing. Observed in `.next/dev/logs/next-development.log` (`00:08:23`).
- **Fix:** throw a named `ConfigError`, and let `withErrors` log its message: it holds variable names only, which L31 allows.
- **Status:** fixed in `401553a` (`tests/logging.test.ts`)

### S-09 No request id or route name in error logs; no feed event log
- **Area:** 9 observability. **Files:** `lib/http.ts:68-73`, `lib/feed/service.ts:22-29`, `lib/documents/service.ts:253`.
- **Problem:** a 500 logs `route error <name> <code>` with no route and no request id. Feed deliveries log nothing on success or refusal, apart from a failed refusal write. Extraction logs a JSON line, but under `console.warn` and with no route.
- **Consequence:** two simultaneous 500s on Vercel cannot be told apart or matched to a request. A refused feed burst is invisible in the function logs.
- **Fix:** one JSON log line `{event, route, request_id, …}` built from ids, statuses and codes only. The request id is `x-vercel-id` when present, else a random UUID. Add `feed_delivery` lines carrying the status and refusal reason.
- **Status:** fixed in `401553a`

### S-10 `env()` requires every variable on every route
- **Area:** 8 DX / 5 robustness. **File:** `lib/config.ts:6-16`.
- **Problem:** `DEMO_PASSWORD`, `GEMINI_API_KEY` and `GEMINI_MODEL` are required by the schema that every route uses, though only extraction and `db:seed:demo` read them.
- **Consequence:** Dev A, or any developer without a Gemini key, gets 500 on every route, including sign-in checks and the timeline.
- **Fix:** make those three optional in `envSchema` and check them at their point of use (`geminiEnv()` already does). **Not fixed:** a config-contract change (fail-closed to fail-late) that the team should agree. For now, Dev A must get all values from Dev B.
- **Status:** open

### S-11 The orchestration services have no automated test
- **Area:** 7 tests. **Files:** `lib/documents/service.ts` (upload rollback, claim, retry on invalid output, `markFailed`), `lib/facts/service.ts`, `lib/share/service.ts:137-185` (`openViewer`: rate limit then lookup then session), `lib/links/service.ts`, `lib/referral/service.ts:45-69`.
- **Problem:** `grep` finds no test that calls `uploadDocument`, `extractForDocument`, `transitionFact`, `openViewer`, `createShare` or `revokeShare`. They are covered only by `npm run smoke` against a live server and database. The pure rules underneath (policy, lifecycle, guards, evaluate, session, feed intake with fake deps) are well tested.
- **Consequence:** a refactor of these files is checked only when someone runs smoke against the real project.
- **Fix:** `extractForDocument` and `uploadDocument` already take `Deps`. Give them a fake `db` (a small in-memory object with the four methods they use) and test: claim lost, then 409; invalid output twice, then `failed` with nothing written; storage put fails, then the row is removed. Try `@electric-sql/pglite` again for the SQL-heavy ones (L30 allows it).
- **Status:** open

### S-12 No CI
- **Area:** 8 DX. **Path:** `.github/` does not exist.
- **Consequence:** nothing stops a red commit from landing on `main`, with two developers pushing to it during a 4-day build.
- **Fix:** `.github/workflows/ci.yml`: `npm ci`, typecheck, lint, test, build on push and pull request (Node 24; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; no secrets needed, because env is read lazily).
- **Status:** fixed in `52fe225`. The workflow has **NOT RUN** yet: it runs on the next push to GitHub. Linux-only issues (path case, native `sharp` install) are untested.

### S-13 `docs/api.md` and the route files disagree
- **Area:** 2 API consistency. **Files:** `docs/api.md:6-35`, `tests/static.test.ts:60-87`.
- **Mismatches:**
  1. `GET /api/records/{id}/shares` (route exists, documented at `:302`), `GET /api/records/{id}/advisories` (`:456`) and `POST /api/facts/{id}/category` (`:233`) are missing from the route table at the top.
  2. `GET /api/health` exists (`app/api/health/route.ts`) and is not in `api.md` at all.
  3. The static test checks api.md table to route file only. A route file that is not in the table passes, which is how items 1 and 2 got through.
  4. `GET /v` and `GET /v/referral` are in the table, but they are Dev A's pages and not built yet (the static test reports them as todo, as designed).
- **Fix:** add the four rows and a `GET /api/health` section, and add the reverse static check (every `route.ts` and every exported method appears in the table).
- **Status:** fixed in `b32df5a` (reverse check proven by a negative control: deleting the health row fails the test)

### S-14 Several `docs/api.md` examples are not what the routes return
- **Area:** 2 / 8. **File:** `docs/api.md`.
- **Mismatches (checked by the live probe and by reading the builders):**
  1. `ai_notice` is missing from the examples for `POST /api/documents/{id}/extract` (`:154`), `GET /api/documents/{id}` (`:162-167`), `GET /api/records/{id}/facts` (`:192-203`), `getViewerSummary` (`:353-365`) and `getReferralPacketForViewer` (`:444-451`). All five return it.
  2. The error table (`:49-59`) has no 502 row, though `storage_failed` and `extraction_failed` exist, and no 415 (feed). It does not list the viewer-session 403 codes `no_cookie`, `session_expired`, `share_expired` and `share_revoked`.
  3. The explanation example (`:242-262`) is described as "real output for the demo record's Haemoglobin 9.8". The engine produces exactly that for the seeded 9.8 fact. But the demo record's newest Haemoglobin is now a hospital-sent 11.6 (live probe), and its explanation has one notice, not two, because it is not AI-read.
- **Fix:** update the examples and the error table, and say which fact the explanation example comes from.
- **Status:** fixed in `b32df5a`

### S-15 No typed contract Dev A can import
- **Area:** 8 DX. **Path:** no `lib/api-types.ts`.
- **Problem:** the request and response shapes live in Zod schemas and return types spread over `lib/**/service.ts`. A client component cannot import those files without pulling `postgres` and `@google/genai` into the browser bundle.
- **Fix:** `lib/api-types.ts`, made of **type-only** imports and declarations: every request body (`z.input` of the route's schema), every response (`Jsonify<…>` of the builder's return type, so `Date` reads as `string`), the error body and the error-code union. A static test keeps it free of runtime imports.
- **Status:** fixed in `e6f600b` (`tests/api-types.test.ts`)

### S-16 No Content-Security-Policy
- **Area:** 4 security. **File:** `next.config.ts:18-29`.
- **Problem:** headers are `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options` and `Cache-Control`. There is no CSP. D-021 accepted that the Supabase session cookie is readable by page JavaScript, so any injected script can take the session.
- **Fix:** a CSP for pages at least (`default-src 'self'; connect-src 'self' <SUPABASE_URL>; img-src 'self' data: blob: <SUPABASE_URL>; frame-ancestors 'none'; object-src 'none'`, plus what Next needs for inline scripts, nonce or hash). **Not fixed:** it affects every Dev A page and needs testing with them. Whether Vercel adds HSTS on `*.vercel.app` was not checked (UNVERIFIED).
- **Status:** **needs decision** (affects every Dev A page)

### S-17 The demo account is not a stable demo record
- **Area:** 8 DX. **Evidence:** live `GET /api/records` as `demo@itan.example`.
- **Problem:** the demo account holds three records: "Demo Patient (SYNTHETIC)", "SMOKE TEST (SYNTHETIC)" and "THROTTLE TEST (SYNTHETIC)". The demo record also carries hospital-sent results from simulated-hospital runs, and it has two active links.
- **Consequence:** Dev A's record switcher and timeline show test data. Demo-day screens depend on whatever smoke and throttle last wrote. The audit tables are append-only, so these rows cannot be deleted.
- **Fix:** smoke and throttle should create their records under the throwaway accounts smoke already makes (D-018), not under the demo account. Decide whether to keep the demo record or create a fresh "Demo Patient" account before the demo. **Not fixed:** a script-behaviour change that needs a live run to verify.
- **Status:** open

---

## NICE TO HAVE

| ID | Area | File:line | Problem and consequence | Fix | Status |
|---|---|---|---|---|---|
| N-01 | 1 dead code | `lib/facts/correct.ts:51` | `unreadable: value === null && fact.kind === "lab" ? false : false`: both branches are `false`, so a reader has to work out that it is constant | `unreadable: false` | fixed `401553a` |
| N-02 | 2 errors | `lib/http.ts:44`, `lib/referral/service.ts:39` | An unknown key in a strict body reports `Invalid or missing fields: (body)` (live probe: `{display_name, is_self, origin}`), because Zod's `unrecognized_keys` issue has an empty path. The caller is not told which field. The two copies of the message builder also drift | One shared `fieldList(issues)` that names the unknown keys (field names, never values) | fixed `401553a` |
| N-03 | 5 cold start | `lib/documents/service.ts:7` | `GET /api/documents/{id}` and `/image` import the service, which imports `@google/genai` at the top, so read-only routes load the Gemini SDK | Move the read helpers to `lib/documents/queries.ts` | fixed `637113e` |
| N-04 | 1 duplication | `lib/http.ts:81` and `lib/feed/intake.ts:99` (UUID regex); `lib/facts/compare.ts:19` and `lib/share/summary.ts:30` (`newestFirst`); `Result`/`fail` defined in 5 services | Same rule written twice can drift | Share `isUuid` and `newestFirst`; a shared `ServiceResult` later | fixed `401553a` (UUID, newestFirst; the shared `ServiceResult` type is still open) |
| N-05 | 3 indexes | `lib/links/queries.ts:64-73`, `lib/referral/queries.ts:45-52` | `feed_receipt.link_id` (link list counts) and `referral_ack.referral_id` (ack list) have no index. Both are scans that grow with every delivery or ack | New migration `0004` with the two indexes | fixed `5c38e93` (migration 0004, **not applied**: run `npm run db:migrate`) |
| N-06 | 3 unbounded reads | `lib/facts/queries.ts:8-15`, `:17-30`; `lib/share/queries.ts:69`; `lib/links/queries.ts:47`; `lib/referral/queries.ts:45`; `lib/facts/compare.ts:22-43` | The timeline, documents, shares, links and acks have no limit, and `attachPrevious` is O(n²). Fine at demo size (12 facts), slow at thousands | A limit plus cursor on the timeline after the contest; group by `test_key` once in `attachPrevious` | open |
| N-07 | 3 growth | `lib/db/schema.ts:224-273` | `code_attempt` and `viewer_session` are never cleaned up | A periodic `DELETE … WHERE at < now() - interval '1 day'` (both are not audit tables) | open |
| N-08 | 3 correctness | `lib/referral/service.ts:119` | `current_acknowledgement` matches by typed name and practice number, not by session. Two clinicians who type the same name see each other's ack | Match `viewer_session_id = ctx.viewer.sessionId` | open |
| N-09 | 3 audit | `lib/share/service.ts:217-226` | `viewer_image_viewed` is logged before the signed URL is created. If signing fails, the log says viewed and the clinician got 500 | Create the URL first, then log | open |
| N-10 | 5 half state | `lib/documents/service.ts:165-250` | A database error inside the final extraction transaction rolls back the facts but leaves the document `extracting`, so a retry within 120 s gets 409 | `try/catch` around the transaction, then `markFailed("db_error")` (best effort) | open |
| N-11 | 1 unused exports | knip output | 25 exports and 11 exported types are unused outside their file (constants such as `CODE_LENGTH`, internal helpers such as `readCapped`, `toResponse`, `getFact`). None is dead code: each is used in its own module | No action; drop `export` when touching those files | open (no action) |
| N-12 | 8 formatting | repo root | No `.editorconfig` and no Prettier config, so two editors can write different indentation and line endings | `.editorconfig` now; Prettier only if the team wants a new dev dependency | fixed `52fe225` (`.editorconfig`; Prettier open) |
| N-13 | 10 docs drift | `docs/limitations.md:8`; `docs/DEVIATIONS.md:146`, `:164` | limitations §1 says "the report covers the second run", but `tools/prepb-report.md` now holds the later 10-call run (D-020 update). D-020 says "the throttle script is not built" and D-018 says "a live run has not been done", but `docs/evidence/throttle.md` and limitations §2 report a Fast 3G run | Correct the three lines | fixed `782a963` |
| N-14 | 3 migration | `lib/db/migrations/0003_integrity_triggers.sql:62-63` | The comment says "a document and its facts always share a record:" and is followed by an unrelated CHECK. No such constraint exists | Do not edit an applied migration. If wanted, add a trigger in a new migration that checks `fact.record_id = document.record_id` | open |
| N-15 | 2 status codes | `app/api/view/ack/route.ts:11`, `app/v/facts/[id]/image/route.ts:12` | A missing or expired viewer session is 403 with `no_cookie`, `session_expired`, `share_expired` or `share_revoked`, not 401 as L7 maps "unauthenticated". It is consistent and documented | Keep; listed in the error table (S-14) | open (keep) |
| N-16 | 3 writes on read | `app/api/records/route.ts:19`, `app/api/consent/route.ts:12` | Each GET runs `ensureAccount` (an `INSERT … ON CONFLICT DO NOTHING`) | Only on POST, or once per session; cheap, so low priority | open |
| N-17 | 1 small | `app/api/records/route.ts:11` | The `birth_year` maximum is `new Date().getFullYear()` evaluated at module load, so a warm instance across New Year rejects the new year | Compute it inside a `refine` | open |
| N-18 | 6 duplicate query | `app/api/links/[id]/revoke/route.ts:14-19` | `linkRecordId` then `revokeLink` run the same lookup twice | Return the row from one lookup | open |
| N-19 | 2 feed | `lib/feed/intake.ts:238-239` | A replayed `Idempotency-Key` with a **different** body returns the first receipt (200) silently. Many APIs answer 422 for a changed body. L26 locks the current behaviour | Keep (locked); document "same key means same delivery" in api.md (already implied) | open (locked) |

---

## Phase 2: what was fixed

Each commit below ran `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` first, and all four passed. Nothing had to be reverted. No locked decision, permission outcome, guard, share/session/feed semantic, existing column or existing response field was changed. The only response changes are additive (`ai_notice` on the referral preview) or a refusal of input that was never valid (a mismatched upload type).

| Commit | Theme | Findings |
|---|---|---|
| `20f99eb` | Audit (this file, Phase 1) | none |
| `5e2cd25` | Every holder route decides through `can()`; static test | S-01 |
| `30d9842` | Upload bytes must match the declared type | S-02 |
| `dde365e` | 20 s deadline on Supabase Storage and admin calls | S-06 |
| `401553a` | Structured JSON logs with route and request id; ConfigError logged; field names for unknown keys; dedupe helpers; dead ternary | S-08, S-09, N-01, N-02, N-04 |
| `637113e` | `ai_notice` on the referral preview; document reads split from the Gemini import | S-07, N-03 |
| `5c38e93` | Migration 0004: two indexes (not applied) | N-05 |
| `e6f600b` | `lib/api-types.ts` | S-15 |
| `b32df5a` | `docs/api.md` matches the routes, checked both ways | S-13, S-14 |
| `52fe225` | README, `.editorconfig`, CI workflow | B-01, S-12, N-12 |
| `782a963` | limitations and DEVIATIONS corrections, D-022, statuses in this file | N-13, B-02 (documented) |

**What Dev A would have to change for the open items, if they are fixed later:** B-02 (some "View source" links on the clinician summary become 404, or a new `image_available` flag appears); S-16 (pages must work under a CSP: no inline scripts without a nonce, no third-party origins); S-17 (the demo account's record list changes). S-03, S-04, S-05, S-10 and S-11 change nothing for Dev A.

---

## Looks good (checked and found fine)

- **Policy matrix:** `tests/policy.test.ts` has the 56 cells (14 rows x 4 actors) as `it.each`, plus record scoping, hidden items, provider-entered and partner extras: 75 tests. `ACTIONS` has 16 entries and the test pins that.
- **Layering:** routes parse, authenticate, call `can()` and a service, and respond. `tests/architecture.test.ts` enforces that routes never import the DB, that pure modules import no I/O, and that lib never imports app. No route imports another route. No circular imports (madge).
- **Transactions:** every multi-row write is one transaction: record and holder (`lib/records.ts:18`), extraction facts, events and document status (`lib/documents/service.ts:165`), fact change and event (`lib/facts/service.ts`), share and hidden lists and log (`lib/share/service.ts:79`), viewer open (`:174`), revoke (`:102`), link (`lib/links/service.ts:25`), and the feed write with `SELECT … FOR UPDATE` on the link (`lib/feed/queries.ts:90-155`).
- **Idempotency backed by constraints:** `document_client_upload_id_uq`, `feed_receipt_hospital_idem_uq` (with the concurrent-duplicate path mapped back to a replay), `share_code_hash_uq`, `hospital_link_link_ref_uq`, `hospital_credential_key_hash_uq`. The extraction claim is one atomic `UPDATE … RETURNING` (L22).
- **Integrity in the database:** FKs on every reference; CHECKs on every enum-like text; append-only triggers on `access_log` and `fact_event`; the provider-entered immutability trigger; `fact_confirmed_only_for_non_ai_chk`; RLS deny-all on all 24 tables (D-021 live check).
- **Indexes for the real queries:** timeline `(record_id, test_key, fact_date)`, access log `(record_id, at desc)`, share lookup (unique `code_hash`), session (PK `token_hash`), rate limit `(ip_hash, at)`, feed key, link ref and receipt unique indexes, `fact_event(fact_id)`, `record_member` PK led by `account_id`. Two gaps are N-05.
- **Soft delete:** every patient and clinician read filters `removed_at` and `superseded_by` (`listActiveFacts`, `listDocumentFacts`, `filterFactsForShare`, `getSharedFactImageUrl`, `getReferralFactInRecord`, `getFactById`).
- **Types:** all timestamps are `timestamptz`; `fact_date` is `date`, returned as `yyyy-mm-dd`; JSON dates are ISO 8601 UTC (live probe). Numbers are only parsed from printed strings and only compared, never used in arithmetic.
- **DTOs:** no route returns a raw row. Facts go through `toFactDTO`; documents through `documentView`; shares, links, access log and referrals through explicit mappers. `raw_extraction` and every hash stay server-side.
- **Validation:** every JSON body goes through Zod `strictObject` (records, facts, correct, dispute, category, shares, links, referrals, view/open, view/ack). Multipart is checked by hand with `isUuid`. Path ids are checked with `isUuid` before any query (a non-UUID gives 404, live). Malformed JSON and an empty body give 400 `invalid_request` (live).
- **Errors:** the `{error:{code,message}}` shape everywhere, including the feed (`lib/feed/intake.ts:90`, plus `issues`); `withErrors` returns a 500 with no detail, stack or SQL; 503 for an Auth outage, never 401. Status codes follow L7 (live: 400, 401, 403, 404 as documented).
- **Secrets:** no secret, code, token or key in logs, errors or responses. The share code is returned once at creation only. `timingSafeEqual` is used for the hospital key hash (`lib/crypto.ts:15-19`, `lib/feed/intake.ts:155`). Lookups of the code, viewer token and key are by HMAC or SHA-256, so no plain-text comparison exists. The service-role key is read only in `lib/supabase.ts` (server). The `NEXT_PUBLIC_` allowlist is enforced by `tests/static.test.ts` (d).
- **Headers apply where claimed:** the live probe saw `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` on `/api/*` and `/v/facts/{id}/image`.
- **Client IP:** the first `x-forwarded-for` entry, HMAC-hashed. On Vercel it cannot be spoofed: D-021 observed Vercel overwriting the header.
- **Outbound Gemini call:** a 25 s per-attempt abort, one retry after a timeout, three retries on 429 and 5xx with backoff, and a 100 s total budget under `maxDuration = 120` (`lib/extract/gemini.ts:39-43`). The SDK's own retries are off. Invalid output is retried once, then the document is marked `failed` with nothing written.
- **Pooler:** `prepare: false`, `max: 5`, `idle_timeout: 20`, `connect_timeout: 10`, and a pool cached on `globalThis` (`lib/db/client.ts:19-24`). Verified live on the transaction pooler (D-010).
- **Feed:** the check order matches L26 plus the 415 step (D-017); one 403 body for unknown, revoked, other-hospital and changed-patient links; size capped while streaming; 405 on every other method and path; no read route. 40 tests in `tests/feed.test.ts`.
- **Extraction guards and parsers:** `tests/guards.test.ts` (20), `numbers`, `dates`, `units` (13) and `compare` (11). Share codes, evaluate, session and filter: `tests/share.test.ts` (41). Lifecycle table: `tests/lifecycle.test.ts`. Referral wording and the advice-language lint: `tests/referral.test.ts` (23), `tests/explain.test.ts` (19).
- **Ops:** `/api/health` works with no DB (live). Migrations are the only schema path (`scripts/migrate.ts`, drizzle journal 0000 to 0003). `db:seed` upserts by natural key and never rotates the hospital key unless asked. `db:seed:demo` is a no-op when the record exists.
- **Dependencies (production):** `@google/genai` (extraction adapter, the only model call); `@supabase/ssr` (cookie session read, L2, and Dev A's browser client); `@supabase/supabase-js` (Auth verification, Storage); `drizzle-orm` and `postgres` (the one ORM and its driver); `next`, `react` and `react-dom` (the app); `zod` (all validation); `qrcode` (share and link QR, server-side); `idb-keyval` (Dev A's offline upload queue, in the design stack, not used by Dev B yet). Nothing to remove; no queue, worker, second database or second ORM.
- **Not over-engineered:** each adapter (`DocumentStorage`, `FeedDeps`, `AdapterDeps`) exists so the code can be tested without a network, and the tests use it.

---

## Handoff to Dev A

- **Auth:** sign in with the browser Supabase client (`createBrowserClient` from `@supabase/ssr`), then call `/api/*` with plain same-origin `fetch`: the session cookie is enough, no header needed. 401 is the only "sign in again" signal: refresh the session and retry once first. **503 `service_unavailable` is not a sign-out:** retry after `Retry-After`. No CORS: everything is same-origin.
- **Errors:** every error is `{ "error": { "code", "message" } }`. Switch on `code`, never on `message`. The codes are listed in `docs/api.md` and as the `ApiErrorCode` type in `lib/api-types.ts`. 404 means "not found or not yours", on purpose.
- **The DTO shape:** every fact is a `FactDTO` (`lib/api-types.ts`). Show `*_as_printed` text; `value_num` and the range bounds are for our comparison only. `unreadable: true` means show "could not be read", never a value. `state` and `origin` decide the badge and the buttons: a `provider_entered` fact gets Dispute only. Import types with `import type { … } from "@/lib/api-types"`: that file has no runtime code, so it is safe in client components.
- **Fixed wording:** show `ai_notice`, explanation `sentences` and `notices`, advisory `message`, `recorded_notice`, `partial_notice`, the packet notes ("Not stated by the referring clinician"), the ack labels and `disclaimer` exactly as sent. Add no medical words of your own: no colour for high or low, no "normal", "improving" or "worse".
- **Viewer cookie flow:** `/c` reads the code from `location.hash` and `POST`s `{code, name, practice_no}` to `/api/view/open`. On 200 the server sets the HttpOnly `itan_v` cookie (30 min max, never past the share's expiry); navigate to the returned `next`. `/v` and `/v/referral` are server components that call `getViewerFromRequest` and then `getViewerSummary` or `getReferralPacketForViewer` directly. The share is re-checked on every request, so `{ ok: false, reason }` can appear at any click: show "This access is no longer valid." and the code entry. Never put the code in a query string or a log.
