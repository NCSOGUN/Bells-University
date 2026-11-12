// `npm run db:migrate`: apply lib/db/migrations to the database. Works on an empty database (freeze item 8).
// Uses MIGRATION_DATABASE_URL (Supabase direct connection) if set, because the transaction pooler can
// reject some DDL; otherwise DATABASE_URL.
import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }
  const using = process.env.MIGRATION_DATABASE_URL ? "MIGRATION_DATABASE_URL" : "DATABASE_URL";
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "lib/db/migrations" });
    console.log(`Migrations applied (via ${using}).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  // Postgres error codes and messages carry no secrets; the URL is never printed.
  console.error("Migration failed:", (e as { code?: string }).code ?? "", (e as Error).message);
  process.exit(1);
});
