// `npm run rls:check`: the deny-all backstop (NFR-01, D-021). The browser holds the public anon key, so the
// only thing between that key and the data is RLS. This checks the LIVE database, read-only:
//   1. every table in the public schema has RLS enabled;
//   2. no policy in public (or on storage.objects touching the documents bucket) applies to anon or authenticated;
//   3. the documents bucket exists and is private.
// Needs DATABASE_URL. Prints table and policy NAMES only, never row contents. scripts/smoke.ts runs it too.
import "./load-env";
import postgres from "postgres";
import { DOCUMENTS_BUCKET } from "../lib/supabase";

export type RlsCheck = { name: string; ok: boolean; detail: string };

type Sql = ReturnType<typeof postgres>;
type Policy = { tablename: string; policyname: string; roles: string[]; qual: string | null; with_check: string | null };

const BROWSER_ROLES = ["anon", "authenticated", "public"]; // "public" = a policy with no TO clause applies to everyone
const appliesToBrowser = (roles: string[]) => roles.some((r) => BROWSER_ROLES.includes(r));

/** A storage.objects policy that reaches the documents bucket: it names the bucket, or it names no bucket at all. */
export function touchesBucket(p: Pick<Policy, "qual" | "with_check">, bucket: string): boolean {
  const text = `${p.qual ?? ""} ${p.with_check ?? ""}`;
  return text.includes(`'${bucket}'`) || !/\bbucket_id\b/.test(text);
}

export async function rlsChecks(sql: Sql): Promise<RlsCheck[]> {
  const out: RlsCheck[] = [];

  const tables = await sql<{ relname: string; relrowsecurity: boolean }[]>`
    select c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname`;
  const noRls = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname);
  out.push({ name: "every table in the public schema has RLS enabled", ok: tables.length > 0 && noRls.length === 0, detail: noRls.length ? `RLS off: ${noRls.join(", ")}` : `${tables.length} tables` });

  const pubPolicies = await sql<Policy[]>`select tablename, policyname, roles::text[] as roles, qual, with_check from pg_policies where schemaname = 'public'`;
  const badPub = pubPolicies.filter((p) => appliesToBrowser(p.roles)).map((p) => `${p.tablename}.${p.policyname}`);
  out.push({ name: "no public-schema policy applies to anon or authenticated (deny-all)", ok: badPub.length === 0, detail: badPub.length ? badPub.join(", ") : "none" });

  const [bucket] = await sql<{ public: boolean }[]>`select public from storage.buckets where id = ${DOCUMENTS_BUCKET}`;
  out.push({ name: `the "${DOCUMENTS_BUCKET}" bucket exists and is private`, ok: !!bucket && bucket.public === false, detail: bucket ? `public=${bucket.public}` : "bucket not found (run npm run storage:init)" });

  const [objs] = await sql<{ relrowsecurity: boolean }[]>`
    select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'objects'`;
  out.push({ name: "storage.objects has RLS enabled", ok: !!objs?.relrowsecurity, detail: objs ? `relrowsecurity=${objs.relrowsecurity}` : "table not found" });

  const stPolicies = await sql<Policy[]>`select tablename, policyname, roles::text[] as roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects'`;
  const badSt = stPolicies.filter((p) => appliesToBrowser(p.roles) && touchesBucket(p, DOCUMENTS_BUCKET)).map((p) => p.policyname);
  out.push({ name: `no storage policy for anon or authenticated reaches the "${DOCUMENTS_BUCKET}" bucket`, ok: badSt.length === 0, detail: badSt.length ? badSt.join(", ") : `${stPolicies.length} policies on storage.objects, none reach it` });

  return out;
}

// Run directly: `npm run rls:check`.
if (process.argv[1] && /rls-check\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) {
  (async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");
    const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
    try {
      const results = await rlsChecks(sql);
      for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
      process.exitCode = results.every((r) => r.ok) ? 0 : 1;
    } finally {
      await sql.end({ timeout: 5 });
    }
  })().catch((e) => {
    console.error("rls:check aborted:", (e as Error).message);
    process.exitCode = 1;
  });
}
