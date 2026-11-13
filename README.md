# Itan

A patient-held medical record. Patients photograph their own lab reports, prescriptions and letters; an AI service **only reads** them; the patient confirms each fact; a doctor sees a one-screen summary through a short share code; a (SIMULATED) partner hospital can push results through a write-only FHIR R4-aligned feed.

Built for the NCS Ogun State IT Development Contest (healthcare theme). **All data is synthetic.** Read `docs/SYSTEM-DESIGN.md` for the design.

## Quick start

Prerequisites: Node 24 (`node -v`), npm, and the team's `.env.local` values (ask Dev B; never commit them).

**Joining the existing team project** (the Supabase database, bucket and demo user already exist):

```bash
git clone https://github.com/OLAMIDEOLADIPUPO/Itan.git && cd Itan
npm ci
cp .env.example .env.local     # then paste in the team values
npm run dev                    # http://localhost:3000
```

Sign in as the demo patient: **`demo@itan.example`**, password = `DEMO_PASSWORD` from `.env.local`. The record is "Demo Patient (SYNTHETIC)".

**Setting up a fresh Supabase project** (only once per project; these write to the database named in `.env.local`):

```bash
npm run db:migrate      # apply lib/db/migrations (works on an empty database)
npm run db:seed         # facilities, the SIMULATED hospital + its key, glossary, drug-allergy rules (idempotent)
npm run storage:init    # create the private `documents` bucket (idempotent); without it every upload is 502
npm run db:seed:demo    # the demo auth user, its account and the synthetic demo record (idempotent)
npm run rls:check       # confirm RLS is deny-all and the bucket is private (read-only)
```

After `npm run build`, restart any running `npm run dev` in the same folder: a build writes into `.next` and can leave the dev server returning 500s.

## Environment variables

All live in `.env.local` (local) and Vercel project settings (deployed). See `.env.example`.

| Name | Used by | What it is |
| --- | --- | --- |
| `DATABASE_URL` | server, scripts | Supabase Postgres **transaction pooler** URL (port 6543). The client uses `prepare: false`. |
| `MIGRATION_DATABASE_URL` | `db:migrate` only (optional) | Direct connection, if the pooler ever refuses DDL. Not set on Vercel. |
| `SUPABASE_URL` | server | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | server | Publishable key, used to read the session cookie. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Secret key for Storage and Auth admin. **Never** `NEXT_PUBLIC_`. |
| `GEMINI_API_KEY` | extraction | Google Gemini API key. |
| `GEMINI_MODEL` | extraction | Pinned stable model (see D-015/D-020); Prep B results are for this exact value. |
| `SHARE_PEPPER` | server | ≥ 16 characters; HMAC key for share codes and IP hashes. Changing it invalidates every share code. |
| `DEMO_PASSWORD` | `db:seed:demo`, smoke | Password of `demo@itan.example` (≥ 8 characters). |
| `NEXT_PUBLIC_SUPABASE_URL` | browser sign-in | Same value as `SUPABASE_URL`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser sign-in | Same value as `SUPABASE_ANON_KEY`. |

Exactly those two `NEXT_PUBLIC_` names are allowed (D-021); `tests/static.test.ts` fails on any other. Today every route validates the whole server set on first use, so a missing value (including the Gemini ones) gives 500s; the server log line `config_error` names the missing variable.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run typecheck` / `lint` / `test` | `tsc --noEmit`, ESLint, Vitest (no database or network needed). Run all three before saying something is done. |
| `npm run db:generate` | `drizzle-kit generate` after editing `lib/db/schema.ts` (writes a new migration; never edit an applied one) |
| `npm run db:migrate` / `db:seed` / `db:seed:demo` / `storage:init` | Set up a project (above) |
| `npm run rls:check` | Live read-only check of RLS and the bucket |
| `npm run smoke` | End-to-end API checks against `BASE_URL` (default `http://localhost:3000`). **Writes** throwaway records and audit rows to the real database. |
| `npm run sim -- <command>` | The SIMULATED partner hospital (`send-results`, `send-referral`, `correct-result`, `refusals`) |
| `npm run extract-test` | Prep B: extract the synthetic fixtures with the real model and score them (calls Gemini) |
| `npm run fixtures` | Rebuild the synthetic fixtures (needs an installed Chrome or Edge) |
| `npm run throttle` | NFR-10/NFR-11 measurement on approximate Fast 3G (needs Chrome and a running server) |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, test and build on every push and pull request.

## Who owns what

| Dev A (UI) | Dev B (server) |
| --- | --- |
| `app/(patient)/**`, `app/c/**`, `app/v/**` **pages**, `components/**`, `public/**`, the service worker, the device upload queue, the browser Supabase client and sign-in screens | Every handler under `app/api/**` and `app/v/facts/[id]/image`, everything in `lib/**`, `scripts/**`, `tools/**`, the migrations and the tests |

Change a file the other person owns only to fix a build break, keep it minimal, and say so in the commit.

## Calling the API (Dev A)

- Contract: `docs/api.md` (every route, request, response and error code) and **`lib/api-types.ts`** (the same as TypeScript types; `import type` only, safe in client components).
- Same-origin `fetch("/api/…")`; the Supabase session cookie identifies the patient. No CORS.
- Errors are always `{ "error": { "code", "message" } }`. 401 means sign in again; 503 means retry, not sign-out.
- The clinician pages `/v` and `/v/referral` are server components that call `getViewerFromRequest`, `getViewerSummary` and `getReferralPacketForViewer` directly.
- Full handover notes: `docs/HANDOVER-DEV-A.md`. Review notes: `docs/BACKEND-REVIEW.md`.

## Rules worth repeating

- No real patient data, anywhere. The simulated hospital and fictional facilities are always labelled SIMULATED.
- The AI only reads documents. Explanations are fixed templates (`lib/explain`), never model output.
- Every permission goes through `can()` in `lib/policy.ts`.
- Itan is FHIR R4-aligned at the partner interface only. It is not FHIR-compliant.
