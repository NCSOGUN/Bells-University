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
