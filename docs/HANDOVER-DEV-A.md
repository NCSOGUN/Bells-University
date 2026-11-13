# Handover: Dev B to Dev A

Everything Dev B owns is built and committed: all API routes, the library code under `lib/`, the partner feed and the SIMULATED hospital. This note is the short version of what you need to build the screens against it. The exact request and response shapes are in `docs/api.md`; this note says what to do with them and what you must not change.

**Not built, so you will not find it:** pages (`app/page.tsx` is a placeholder), components, the service worker, the device-side upload queue, and the browser sign-in screens (section 0).

## 0. Browser sign-in (decided: D-021, option 1)

The browser signs up and signs in **directly against Supabase Auth** (email and password, minimum 8 characters, NFR-04). To allow that, exactly two public variables exist: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as `SUPABASE_URL` and `SUPABASE_ANON_KEY`; see `.env.example`). The anon key is public by design and RLS is deny-all, so it grants nothing by itself. **No other `NEXT_PUBLIC_` variable is allowed**, and `tests/static.test.ts` fails the build if one appears. Never put the service-role key, the pepper or the Gemini key under a public name. In Vercel, add both in Project Settings, Environment Variables, then **redeploy** (they are inlined at build time).

**The browser client is for auth only. All data goes through `/api/*`.** Do not call `.from(`, `.rpc(` or `.storage` on it. `tests/static.test.ts` check (f) fails any client file (a file that starts with `"use client"`, anything under `components/`, any file that calls `createBrowserClient`) that does.

Create the client once, in a client-side file you own (for example `lib/supabase-browser.ts`):

```ts
import { createBrowserClient } from "@supabase/ssr";

// Write the two process.env reads out literally: Next.js only inlines literal NEXT_PUBLIC_ reads.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

Use `createBrowserClient` from `@supabase/ssr` (not `createClient` from `@supabase/supabase-js`): it stores the session in a cookie, which is what lets the server see who is calling.

```ts
// Sign up (min 8 characters). With "Confirm email" off this returns a session at once.
const { data, error } = await supabase.auth.signUp({ email, password });
// data.session is null if email confirmation is on: show "check your email" (see D-021 before the demo).

// Sign in
const { error } = await supabase.auth.signInWithPassword({ email, password });

// Sign out (clears the cookie)
await supabase.auth.signOut();
```

Then call the API with a plain same-origin `fetch("/api/records")`. The browser sends the session cookie by itself and the server (`getAccountId` in `lib/auth.ts`) reads it and **verifies it with Supabase on every request**. You do not need to add an `Authorization` header. The `Authorization: Bearer <access_token>` header is still accepted and wins over the cookie (the smoke script and the demo login use it).

Things to handle:
- **401 `unauthenticated`:** the access token may simply have expired and the browser client has not refreshed it yet. Call `await supabase.auth.refreshSession()` and retry **once**. Still 401: send the user to sign-in. There is no middleware, so the server never refreshes the cookie; the browser client does it.
- **503 `service_unavailable`:** Supabase Auth was slow or unreachable. **Do not sign the user out.** Retry after `Retry-After`.
- Sign-in and sign-up errors come from Supabase (`error.message`, `error.status`). Show a plain message; do not show the raw text if it names the project.
- The session cookie is readable by page JavaScript (that is how `createBrowserClient` works). Do not add third-party scripts, and do not log or send `supabase.auth.getSession()` output anywhere.

## 1. Run it
- Copy `.env.example` to `.env.local` and fill it in (never commit it). `npm run dev`. Seed: `npm run db:seed` then `npm run db:seed:demo`.
- Demo patient: `demo@itan.example`, password in `DEMO_PASSWORD`; record "Demo Patient (SYNTHETIC)". Everything is synthetic.
- Calls use `Authorization: Bearer <Supabase access token>` or the Supabase session cookie. `scripts/smoke.ts` shows a password sign-in over the Supabase REST API.
- Make hospital results appear for the demo: `npm run sim -- send-results --link <ITN-LNK ref> --mrn DEMO-00123` (create the link with `POST /api/links` first). Everything from it is labelled SIMULATED.
- `npm run smoke` runs the whole API end to end against a running server.

## 2. Screen to route map

| Screen | Calls |
|---|---|
| Consent (before first capture, NFR-03) | `GET/POST /api/consent`. The text must state the three NFR-03 facts: an AI service reads the document, where it is processed (Google, may be any country), and what is retained |
| Records | `GET/POST /api/records` |
| Capture and upload | `POST /api/documents` (multipart: `record_id`, `client_upload_id`, `file`). Same `client_upload_id` returns the same document, so retries are safe |
| Read the document | `POST /api/documents/{id}/extract`; poll `GET /api/documents/{id}` after a dropped connection |
| Review facts | `POST /api/facts/{id}/confirm`, `/correct`, `/remove`; `POST /api/facts` to add one; source image `GET /api/documents/{id}/image` (302) |
| Timeline and comparison | `GET /api/records/{id}/facts` (each lab carries `previous` when there is one) |
| Explanation | `GET /api/facts/{id}/explanation` |
| Dispute a hospital result | `POST` and `DELETE /api/facts/{id}/dispute` (note only; never an edit) |
| Hide a fact's category | `POST /api/facts/{id}/category` |
| Share | `POST /api/shares` (returns the code **once**), `POST /api/shares/{id}/revoke`, `GET /api/records/{id}/shares` |
| Access log | `GET /api/records/{id}/access-log` (show each `label`) |
| Hospital link | `GET /api/hospitals`, `POST /api/links`, `POST /api/links/{id}/revoke`, `GET /api/records/{id}/links` |
| Referral | `GET /api/facilities`, `POST /api/referrals`, `GET /api/referrals/{id}` |
| Drug-allergy flag | `GET /api/records/{id}/advisories` |
| Clinician, enter code (`/c`) | read the code from `location.hash`, `POST /api/view/open {code, name, practice_no}`, then go to the returned `next` |
| Clinician summary (`/v`) | server component: `getViewerFromRequest` then `getViewerSummary` (`@/lib/share/service`) |
| Clinician referral (`/v/referral`) | `getReferralPacketForViewer` (`@/lib/referral/service`); acknowledge with `POST /api/view/ack` |
| Clinician source image | `/v/facts/{id}/image` (302, logged) |

## 3. Strings you must show exactly (do not reword)
The wording is checked by tests for advice language, and rewording can turn a statement into advice (NFR-19). Show these as given:
- **`ai_notice`**, on every screen that shows facts: it comes back with the facts list, the document view and extraction response, the clinician summary and the referral packet (NFR-13).
- Each fact's **origin and state badge**: unverified, confirmed, disputed, "Sent by hospital". Hospital-sent facts have no edit or remove button, only dispute.
- The **explanation** text and its `notices`; the **advisory** `message`; the summary's **`recorded_notice`** and **`partial_notice`**; the referral **ack labels and `disclaimer`** ("This is not a statement that a bed is available."); and the packet's "Not stated by the referring clinician".
- Anything from the simulated hospital or the fictional facilities keeps its "(SIMULATED)" label.
- Do not add colour, severity, "normal", "high", "low", "improving" or "worse" anywhere. The API sends no direction word on purpose.

## 4. Errors the UI must handle

| Status and code | What to do |
|---|---|
| 401 `unauthenticated` | Send to sign-in. **The only "sign in again" signal.** |
| **503 `service_unavailable`** | Sign-in could not be checked (slow or unreachable Supabase Auth, from Nigeria it can stall for 10 to 45 s). **Do not sign the user out.** Show "please try again" and retry after `Retry-After` |
| 403 `consent_required` | Show the consent screen |
| 403 `provider_entered_immutable` | Offer dispute instead |
| 403 `code_not_valid` (`/api/view/open`) | One message for unknown, expired and revoked codes: "This code did not work." |
| 429 `too_many_attempts` | Show `Retry-After`; 5 wrong codes per IP per 10 minutes |
| 404 `not_found` | Not found, or not yours (the same on purpose) |
| 409 `extraction_in_progress` | Poll `GET /api/documents/{id}` |
| 413 `file_too_large` | Images over 1 MB, PDFs over 4 MB |
| 502 `extraction_failed` | Nothing was written; offer "try again" (it is safe to call extract again) |
| 502 `storage_failed` (upload) | Retry with the **same** `client_upload_id` |

## 5. Rules that affect your code
- **Share codes** are `XXXX-XXXX`. Accept lowercase, with or without the hyphen, and O or I typed for 0 or 1 (the server normalises). The code travels only in the URL fragment (`/c#CODE`) and in the `POST` body. Never put it in a query string, a log or analytics.
- **Uploads:** re-encode the photo on the device (this also strips EXIF/location), aim for 500 KB or less. Send a fresh `client_upload_id` per capture and reuse it on retry. The queue and resume behaviour (FR-16, NFR-12) is yours.
- **Extraction is slow:** unthrottled, the median was 11 s and the slowest call 38 s (Prep B, `docs/limitations.md`), before any mobile network time. Show progress, let the user leave and come back, and poll the document.
- **The clinician first screen** has a budget of 300 KB and 5 seconds on throttled 3G (NFR-11). Keep `/v` server-rendered and light. `npm run throttle` measures it once `app/v/page.tsx` exists.
- **Viewer cookie** `itan_v` is HttpOnly; the share is re-checked on every request, so a revoked share is refused on the doctor's very next click. `getViewerFromRequest` returns `{ ok: false, reason }`: show "This access is no longer valid." with a way to enter a new code.
- All `/api/*`, `/v/*` and `/c/*` responses are `Cache-Control: no-store` and every page sends `Referrer-Policy: no-referrer` (set in `next.config.ts`; there is no middleware).
- Never call an AI model from the browser, and never write medical wording of your own.

## 6. Where to look
`lib/api-types.ts` (every request, response and error code as TypeScript types; `import type` only, safe in client components), `docs/api.md` (every route), `docs/design-lab.html` (screens and flows), `docs/DEVIATIONS.md` (judgement calls, especially D-017 to D-021), `docs/progress/P*.md` (what each piece does), `docs/limitations.md` (what to say about accuracy).
