// One Drizzle client over postgres-js (C02).
// `prepare: false` is required by Supabase's transaction pooler (port 6543), which does not keep
// prepared statements across transactions. UNVERIFIED against a live pooler until db:migrate runs (section 18).
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/config";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run a query: the client or an open transaction. */
export type Executor = Db | Tx;

// Survive Next.js hot reloads in dev without opening a new pool each time.
const globalForDb = globalThis as unknown as { __itanDb?: { db: Db; sql: postgres.Sql } };

export function getDb(): Db {
  if (!globalForDb.__itanDb) {
    const sql = postgres(env().DATABASE_URL, {
      prepare: false,
      max: 5, // serverless: keep the pool small
      idle_timeout: 20,
      connect_timeout: 10,
    });
    globalForDb.__itanDb = { db: drizzle(sql, { schema }), sql };
  }
  return globalForDb.__itanDb.db;
}

/** Run `fn` in one transaction. Throwing inside rolls everything back (no partial writes). */
export function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}

/** Close the pool (scripts only). */
export async function closeDb(): Promise<void> {
  await globalForDb.__itanDb?.sql.end({ timeout: 5 });
  globalForDb.__itanDb = undefined;
}
