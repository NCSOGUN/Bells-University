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
      // logEvent (lib/log.ts, R1) is the structured wrapper around console: its call sites are held to the same rule.
      for (const m of read(f).matchAll(/(?:console\.(?:error|warn)|logEvent)\s*\(([\s\S]*?)\);?\s*$/gm)) {
        if (bare.test(m[1])) bad.push(`${rel(f)}: ${m[0].slice(0, 80)}`);
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

describe("(d) no secret is exposed to the browser (NFR-01, D-021)", () => {
  // D-021: the browser signs in against Supabase directly, so exactly these two names may be public. The anon
  // (publishable) key is public by design and RLS is deny-all. Anything else with NEXT_PUBLIC_ fails.
  const PUBLIC_ALLOWLIST = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const FORBIDDEN_IN_PUBLIC_NAME = /SERVICE_ROLE|PEPPER|GEMINI|HOSPITAL|SECRET|TOKEN/;
  const publicNamesIn = (src: string) => [...src.matchAll(/NEXT_PUBLIC_\w+/g)].map((m) => m[0]);
  // Limit: this reads names written as source text. A name built at runtime would not be seen; Next.js only
  // inlines literal `process.env.NEXT_PUBLIC_X` reads anyway.
  const files = [...SERVER_CODE, ...walk("components"), ...walk("scripts"), "next.config.ts", "vercel.json", ".env.example"].filter(existsSync);

  it("every NEXT_PUBLIC_ name in the repo is on the two-name allowlist", () => {
    for (const f of files) {
      const bad = publicNamesIn(read(f)).filter((n) => !PUBLIC_ALLOWLIST.includes(n));
      expect(bad, f).toEqual([]);
    }
  });

  it("no NEXT_PUBLIC_ name contains SERVICE_ROLE, PEPPER, GEMINI, HOSPITAL, SECRET or TOKEN", () => {
    for (const f of files) expect(publicNamesIn(read(f)).filter((n) => FORBIDDEN_IN_PUBLIC_NAME.test(n)), f).toEqual([]);
    expect(PUBLIC_ALLOWLIST.filter((n) => FORBIDDEN_IN_PUBLIC_NAME.test(n))).toEqual([]); // the allowlist itself
  });

  it("negative control: secret-looking and unlisted names are flagged", () => {
    // Negative control: the checker must flag these, so a silent regex mistake cannot make the test vacuous.
    for (const n of ["NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SHARE_PEPPER", "NEXT_PUBLIC_GEMINI_API_KEY", "NEXT_PUBLIC_HOSPITAL_KEY", "NEXT_PUBLIC_API_SECRET", "NEXT_PUBLIC_ACCESS_TOKEN", "NEXT_PUBLIC_ANYTHING"]) {
      expect(publicNamesIn(`const x = process.env.${n};`).filter((x) => !PUBLIC_ALLOWLIST.includes(x)), n).toEqual([n]);
    }
    expect(publicNamesIn("process.env.NEXT_PUBLIC_SUPABASE_URL + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY").every((n) => PUBLIC_ALLOWLIST.includes(n))).toBe(true);
  });

  it(".env.example lists both public names and nothing else public", () => {
    expect(publicNamesIn(read(".env.example")).filter((n, i, a) => a.indexOf(n) === i).sort()).toEqual([...PUBLIC_ALLOWLIST].sort());
  });
});

describe("(f) the browser Supabase client is for auth only (NFR-01, D-021)", () => {
  // Client code = a file that starts with "use client", anything under components/, and any file that creates
  // the browser client. Server components and route handlers legitimately use serviceClient().from/.storage.
  const USE_CLIENT = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/;
  const BROWSER_CLIENT = /\bcreateBrowserClient\b/;
  const isClientFile = (f: string, src: string) => rel(f).startsWith("components/") || USE_CLIENT.test(src) || BROWSER_CLIENT.test(src);
  // `.from(` as data access, not Array.from / Buffer.from / Object.from-style helpers.
  const DATA_ACCESS = /(?<!\b(?:Array|Buffer|Uint8Array|Uint16Array|Uint32Array|Int8Array|Float32Array|Float64Array|Object|Date|String|Set|Map|Promise)\s*)\.from\s*\(|(?<!\bnavigator)\.storage\b|\.rpc\s*\(/;

  const clientFiles = [...walk("app"), ...walk("components"), ...walk("lib")].filter((f) => isClientFile(f, read(f)));

  it("no client file calls supabase .from(, .rpc( or .storage (all data goes through /api/*)", () => {
    for (const f of clientFiles) expect(read(f), f).not.toMatch(DATA_ACCESS);
  });

  it("the detector recognises client files and data access (negative control)", () => {
    expect(isClientFile("app/x.tsx", '"use client";\nimport x from "y";')).toBe(true);
    expect(isClientFile("app/x.tsx", "// header\n'use client'\nexport {}")).toBe(true);
    expect(isClientFile("lib/b.ts", 'import { createBrowserClient } from "@supabase/ssr";')).toBe(true);
    expect(isClientFile("components/a.tsx", "export {}")).toBe(true);
    expect(isClientFile("app/page.tsx", "export default function P() {}")).toBe(false);
    for (const s of ["supabase.from('fact').select()", "sb\n  .from(\"x\")", "supabase.storage.from('documents')", "client.rpc('f')"]) expect(s, s).toMatch(DATA_ACCESS);
    for (const s of ["navigator.storage.estimate()", "Array.from(x)", "Buffer.from(b)", "Uint8Array.from(a)", "Object.fromEntries(e)"]) expect(s, s).not.toMatch(DATA_ACCESS);
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
