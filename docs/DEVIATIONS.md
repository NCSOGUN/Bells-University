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
- **Watch:** one text-only call took 79 s (transient; the next ones took 1.6 s). `gemini-3.6-flash` spends "thinking" tokens even on trivial prompts, which costs latency. P2 should set the lowest thinking level the installed SDK allows, and Prep B must report real latency against NFR-10.
- **Alternative:** `gemini-3.5-flash-lite` if latency or quota is a problem; `gemini-3.8-flash` once demand settles. Change only `GEMINI_MODEL`.
