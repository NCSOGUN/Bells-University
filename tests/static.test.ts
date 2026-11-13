// P12 static checks (NFR-01, NFR-06, NFR-13, FR-13; freeze item 9). They read source files; nothing runs.
// These are heuristics over text, not a type-level proof. Limits are noted on each check.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = path.join(dir, n);
        if (n === "node_modules" || n === ".next") return [];
        return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      })
    : [];
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => f.split(path.sep).join("/");
const SERVER_CODE = [...walk("app"), ...walk("lib")].filter((f) => !rel(f).includes("/migrations/"));

describe("(a) access_log is append-only in code (FR-13, NFR-24)", () => {
  it("no Drizzle update or delete on access_log", () => {
    for (const f of SERVER_CODE) expect(read(f), f).not.toMatch(/\.(update|delete)\(\s*access_log\b/);
  });
  it("no raw SQL UPDATE or DELETE on access_log", () => {
    // Limit: catches SQL written in template strings; a table name built at runtime would not be caught.
    for (const f of SERVER_CODE) expect(read(f), f).not.toMatch(/\b(update|delete\s+from|truncate)\s+"?access_log\b/i);
  });
  it("the only writes to access_log are inserts in lib/audit.ts", () => {
    const writers = SERVER_CODE.filter((f) => /\.insert\(\s*access_log\b/.test(read(f))).map(rel);
    expect(writers).toEqual(["lib/audit.ts"]);
  });
});

describe("(b) logging never carries secrets or content (L31)", () => {
  // lib/db/seed.ts is an operator CLI (`npm run db:seed`), not server code: it prints the new hospital key ONCE
  // to the operator's terminal by design (docs/DEVIATIONS.md D-018). Nothing else may call console.log.
  const CLI_ALLOWLIST = ["lib/db/seed.ts"];

  it("no console.log in app/ or lib/", () => {
    const offenders = SERVER_CODE.filter((f) => !CLI_ALLOWLIST.includes(rel(f)) && /console\.log\s*\(/.test(read(f))).map(rel);
    expect(offenders).toEqual([]);
  });

  it("console.error and console.warn never receive a variable named code, token, key, bundle, body or file", () => {
    // Heuristic: a bare identifier with one of those names inside the call. Property reads such as `e.code`
    // (the Postgres error code) and type annotations such as `{ code?: string }` are allowed. Multi-line calls
    // are read up to the first closing parenthesis at the end of a line.
    const bare = /(?<![.\w"'`])(code|token|key|bundle|body|file)\b(?!\s*\??:)/;
    const bad: string[] = [];
    for (const f of SERVER_CODE) {
      for (const m of read(f).matchAll(/console\.(error|warn)\s*\(([\s\S]*?)\);?\s*$/gm)) {
        if (bare.test(m[2])) bad.push(`${rel(f)}: ${m[0].slice(0, 80)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("(c) every route in docs/api.md has a handler (freeze item 9)", () => {
  // Parse the route table at the top of docs/api.md: "| GET /api/x, POST /api/y | Caller | ... |".
  const routes: { method: string; route: string }[] = [];
  for (const line of read(path.join("docs", "api.md")).split(/\r?\n/)) {
    const first = /^\|\s*((?:GET|POST|PUT|PATCH|DELETE)\b[^|]*)\|/.exec(line)?.[1];
    if (!first) continue;
    let last = "";
    for (const part of first.replace(/\*\*\(added\)\*\*/g, "").split(/,|\band\b/)) {
      const m = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)?/.exec(part.trim());
      if (!m) continue;
      const route = m[2] ?? last; // "DELETE the same"
      last = route;
      routes.push({ method: m[1], route });
    }
  }
  const toDir = (route: string) => path.join("app", ...route.split("/").filter(Boolean).map((s) => s.replace(/^\{(\w+)\}$/, "[$1]")));
  const exportsMethod = (src: string, method: string) => new RegExp(`export\\s+(const|async\\s+function|function)\\s+${method}\\b`).test(src);

  it("parsed the table", () => {
    expect(routes.length).toBeGreaterThan(30);
  });

  it("every /api route and the /v image route has a route.ts exporting that method", () => {
    const missing: string[] = [];
    for (const r of routes.filter((x) => x.route.startsWith("/api/") || x.route.startsWith("/v/facts/"))) {
      const file = path.join(toDir(r.route), "route.ts");
      if (!existsSync(file) || !exportsMethod(read(file), r.method)) missing.push(`${r.method} ${r.route}`);
    }
    expect(missing).toEqual([]);
  });

  // The /v and /v/referral PAGES belong to Dev A. Until they exist this reports them as skipped, by name,
  // instead of failing the Dev B suite. It becomes a real assertion the moment either page file exists.
  const pages = routes.filter((x) => x.method === "GET" && /^\/v(\/referral)?$/.test(x.route));
  const missingPages = pages.filter((p) => !existsSync(path.join(toDir(p.route), "page.tsx")));
  it.skipIf(missingPages.length === pages.length)("Dev A pages /v and /v/referral exist", () => {
    expect(missingPages.map((p) => p.route)).toEqual([]);
  });
  if (missingPages.length === pages.length) it.todo(`Dev A pages not built yet: ${missingPages.map((p) => p.route).join(", ")}`);
});

describe("NFR-13 disclosures travel with AI-read content", () => {
  it("both notices say read by AI, may contain errors, and not medical advice, with no advice language", async () => {
    const { AI_NOTICE_CLINICIAN, AI_NOTICE_PATIENT } = await import("@/lib/notices");
    const { findAdviceLanguage } = await import("@/lib/explain/lint");
    for (const n of [AI_NOTICE_PATIENT, AI_NOTICE_CLINICIAN]) {
      expect(n).toMatch(/read .*by an AI service/);
      expect(n).toContain("may contain errors");
      expect(n).toContain("This is not medical advice.");
      expect(findAdviceLanguage(n)).toEqual([]);
    }
  });

  it("every response builder that returns facts includes ai_notice", () => {
    // The timeline route, the document view and extraction, the clinician summary and the referral packet.
    for (const f of ["app/api/records/[id]/facts/route.ts", "lib/documents/service.ts", "lib/share/summary.ts", "lib/referral/service.ts"]) {
      expect(read(f), f).toMatch(/ai_notice:\s*AI_NOTICE_(PATIENT|CLINICIAN)/);
    }
  });
});

describe("(d) no secret is exposed to the browser (NFR-01)", () => {
  it("no NEXT_PUBLIC_ variable is named like a secret", () => {
    const files = [...SERVER_CODE, ...walk("components"), "next.config.ts"].filter(existsSync);
    for (const f of files) expect(read(f), f).not.toMatch(/NEXT_PUBLIC_\w*(SECRET|KEY|PEPPER|TOKEN|PASSWORD|SERVICE_ROLE)/);
  });
});

describe("(e) no route is accidentally unauthenticated (NFR-06)", () => {
  // Each handler must establish who is calling through one of these, or be on the explicit public list.
  const AUTH_CALLS = /\b(getAccountId|getHolderActor|requireHolder|loadFactForAction|getViewerFromRequest|handleFeedPost|handleFeedReadAttempt)\s*\(/;
  const PUBLIC = new Map([
    ["app/api/health/route.ts", "region probe, no data"],
    ["app/api/view/open/route.ts", "the share code IS the credential; rate limited (NFR-05)"],
  ]);

  it("every route handler authenticates or is on the public allowlist", () => {
    const handlers = walk("app").filter((f) => /[\\/]route\.ts$/.test(f));
    expect(handlers.length).toBeGreaterThan(25);
    const unauth = handlers.map(rel).filter((f) => !PUBLIC.has(f) && !AUTH_CALLS.test(read(f)));
    expect(unauth).toEqual([]);
  });

  it("the public allowlist is still accurate (each entry exists)", () => {
    for (const f of PUBLIC.keys()) expect(existsSync(f), f).toBe(true);
  });
});
