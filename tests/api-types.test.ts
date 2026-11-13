// lib/api-types.ts is safe to import from client code and its types resolve to real shapes (R1 S-15).
// The expectTypeOf checks are compile-time: `npm run typecheck` fails if a type collapses to never or any.
import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AccessLogResponse,
  ApiError,
  CreateLinkResponse,
  CreateShareBody,
  CreateShareResponse,
  DocumentResponse,
  FactDTO,
  ReferralPreviewResponse,
  SharesResponse,
  TimelineResponse,
  ViewerRefusal,
} from "@/lib/api-types";

describe("lib/api-types.ts", () => {
  it("has no runtime import and no runtime statement", () => {
    const src = readFileSync("lib/api-types.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter(Boolean);
    const imports = src.filter((l) => /^import\b/.test(l));
    expect(imports.length).toBeGreaterThan(5);
    expect(imports.filter((l) => !/^import type\b/.test(l))).toEqual([]);
    // Top-level statements may only start type declarations (continuation lines are indented).
    const raw = readFileSync("lib/api-types.ts", "utf8").split(/\r?\n/);
    const topLevel = raw.filter((l) => /^\S/.test(l) && !/^(\/\/|\*|\/\*|\}|import type |export type |export interface |type |interface |\s)/.test(l));
    expect(topLevel).toEqual([]);
  });

  it("response types resolve to the real shapes, with dates as strings", () => {
    expectTypeOf<DocumentResponse["uploaded_at"]>().toEqualTypeOf<string>();
    expectTypeOf<DocumentResponse["facts"]>().toEqualTypeOf<FactDTO[]>();
    expectTypeOf<TimelineResponse["documents"][number]["uploaded_at"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateShareResponse["code"]>().toEqualTypeOf<string>();
    expectTypeOf<CreateLinkResponse["link_ref"]>().toEqualTypeOf<string>();
    expectTypeOf<SharesResponse["shares"][number]["status"]>().toEqualTypeOf<"valid" | "expired" | "revoked">();
    expectTypeOf<AccessLogResponse["entries"][number]["label"]>().toEqualTypeOf<string>();
    expectTypeOf<ReferralPreviewResponse["ai_notice"]>().toEqualTypeOf<string>();
    expectTypeOf<ReferralPreviewResponse["packet"]>().not.toBeNever();
    expectTypeOf<CreateShareBody>().toHaveProperty("record_id");
    expectTypeOf<ViewerRefusal>().toEqualTypeOf<"no_cookie" | "session_expired" | "share_expired" | "share_revoked">();
    expectTypeOf<ApiError["error"]["message"]>().toEqualTypeOf<string>();
  });
});
