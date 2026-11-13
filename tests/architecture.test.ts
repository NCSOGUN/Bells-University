// Architecture rules as tests: separation of concerns, schema completeness, audit append-only.
//   routes (app/api)  : HTTP only. They call services; they never touch the database or SQL directly.
//   services (lib/**/service.ts, lib/records.ts): business rules, transactions.
//   queries/db (lib/db, lib/**/queries.ts): SQL.
//   pure rules (policy, lifecycle, correct, compare, extract, glossary, crypto): no database, no network.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (n === "node_modules" || n === ".next") return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

const read = (f: string) => readFileSync(f, "utf8");
const imports = (src: string) => [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);

describe("separation of concerns", () => {
  it("route handlers never import the database client, schema or drizzle", () => {
    const offenders = walk("app").filter((f) => imports(read(f)).some((i) => /(^|\/)db\/(client|schema)$|drizzle-orm|^postgres$/.test(i)));
    expect(offenders).toEqual([]);
  });

  it("pure rule modules import no database, storage, network client or env", () => {
    const pure = [
      "lib/policy.ts", "lib/facts/lifecycle.ts", "lib/facts/correct.ts", "lib/facts/compare.ts", "lib/facts/units.ts", "lib/facts/dto.ts",
      "lib/glossary.ts", "lib/crypto.ts", "lib/extract/guards.ts", "lib/extract/numbers.ts", "lib/extract/dates.ts", "lib/extract/schema.ts",
      "lib/documents/sniff.ts",
    ];
    const bad = /(^|\/)db\/(client|schema)$|drizzle-orm|^postgres$|supabase|@google\/genai|\/storage$|\/config$|\/audit$/;
    for (const f of pure) {
      const offending = imports(read(f)).filter((i) => bad.test(i) && !(f.endsWith("dto.ts") && /db\/schema$/.test(i)));
      expect(offending, f).toEqual([]);
    }
  });

  it("pure share, explain and label modules touch no database, storage or network client", () => {
    const pure = [
      "lib/share/codes.ts", "lib/share/evaluate.ts", "lib/share/ratelimit.ts", "lib/share/filter.ts", "lib/share/session.ts",
      "lib/share/summary.ts", "lib/audit-labels.ts", "lib/explain/engine.ts", "lib/explain/lint.ts",
      "lib/referral/packet.ts", "lib/referral/wording.ts", "lib/advisory/types.ts",
      // Feed: the intake takes its database through injected deps, so it stays testable without one.
      "lib/feed/fhir-subset.ts", "lib/feed/map.ts", "lib/feed/intake.ts",
    ];
    // @/lib/config is allowed here: these files read constants (limits, lifetimes) from it, never secrets.
    const bad = /(^|\/)db\/(client|schema)$|drizzle-orm|^postgres$|supabase|@google\/genai|\/storage$|\/audit$|\.\/queries$|\.\/service$/;
    for (const f of pure) expect(imports(read(f)).filter((i) => bad.test(i)), f).toEqual([]);
  });

  it("every route that loads a holder decides through can() (hard rule 3)", () => {
    // A route that builds a holder actor must call can() itself or go through loadFactForAction, which does.
    // Routes that only need "signed in" (records list/create, consent, facilities, hospitals) use getAccountId.
    const routes = walk("app").filter((f) => f.endsWith("route.ts"));
    const offenders = routes.filter((f) => {
      const src = read(f);
      const loadsHolder = /\b(getHolderActor|requireHolder)\(/.test(src);
      return loadsHolder && !/\bcan\(/.test(src);
    });
    expect(routes.length).toBeGreaterThan(30);
    expect(offenders).toEqual([]);
  });

  it("library code never imports from app/ (dependencies point one way)", () => {
    const offenders = walk("lib").filter((f) => imports(read(f)).some((i) => /^(@\/)?app\//.test(i) || i.startsWith("../app")));
    expect(offenders).toEqual([]);
  });

  it("only lib/db, services, queries, audit and records talk to the database", () => {
    const allowed = /^lib[\\/](db[\\/]|audit\.ts|records\.ts|auth\.ts|.*[\\/]service\.ts|.*[\\/]queries\.ts)/;
    const offenders = walk("lib")
      .filter((f) => imports(read(f)).some((i) => /(^|\/)db\/client$/.test(i)))
      .filter((f) => !allowed.test(f));
    expect(offenders).toEqual([]);
  });
});

describe("audit trail is append-only in code", () => {
  it("nothing updates or deletes access_log or fact_event", () => {
    const files = [...walk("lib"), ...walk("app")].filter((f) => !f.includes(`${path.sep}migrations${path.sep}`));
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\.(update|delete)\(\s*(access_log|fact_event)\s*\)/);
    }
  });
});

describe("schema", () => {
  it("exports every table in the design ERD plus the supporting and child tables", () => {
    const expected = [
      "account", "patient_record", "record_member", "document", "fact", "fact_event", "share", "viewer_session",
      "access_log", "referral", "referral_ack", "hospital", "hospital_credential", "hospital_link", "feed_receipt",
      "facility", "glossary", "drug_allergy_rule", "code_attempt",
      "share_hidden_category", "share_hidden_document", "glossary_alias", "glossary_question", "drug_allergy_alias",
    ];
    for (const t of expected) expect(schema, `missing table ${t}`).toHaveProperty(t);
  });
  it("lists are child tables, not array columns (first normal form)", async () => {
    const { getTableColumns } = await import("drizzle-orm");
    for (const [name, table] of Object.entries(schema)) {
      if (typeof table !== "object" || table === null || !("getSQL" in table)) continue;
      let cols: Record<string, { columnType: string }>;
      try {
        cols = getTableColumns(table as never) as never;
      } catch {
        continue;
      }
      for (const [col, def] of Object.entries(cols)) {
        expect(def.columnType, `${name}.${col} is an array column`).not.toBe("PgArray");
      }
    }
  });
});
