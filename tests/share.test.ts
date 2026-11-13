// Share codes, expiry, rate limit, hidden filter, viewer sessions and the clinician summary (P8).
// NFR-05: the four share states; NFR-06: nothing reachable without a valid credential; FR-15: hidden never leaks.
import { describe, expect, it } from "vitest";
import { ALPHABET, formatCode, generateCode, generateLinkRef, hashCode, isPlausibleCode, normaliseCode } from "@/lib/share/codes";
import { evaluateShare } from "@/lib/share/evaluate";
import { clientIp, hashIp, isRateLimited } from "@/lib/share/ratelimit";
import { filterFactsForShare, isHiddenByShare } from "@/lib/share/filter";
import { cookieOptions, hashViewerToken, newViewerToken, readViewerCookie, resolveViewer, serializeCookie, sessionExpiry, type SessionRow, type SessionShare } from "@/lib/share/session";
import { buildSummary, PARTIAL_NOTICE, RECORDED_NOTICE } from "@/lib/share/summary";
import { describeLogEntry } from "@/lib/audit-labels";
import { expiryMinutes } from "@/lib/share/service";
import { can } from "@/lib/policy";
import type { FactDTO } from "@/lib/facts/dto";

const PEPPER = "test-pepper-0123456789abcdef";

describe("share codes (L8, L9)", () => {
  it("generates 10,000 valid, distinct 8-character codes from the Crockford alphabet", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const c = generateCode();
      expect(c).toHaveLength(8);
      expect([...c].every((ch) => ALPHABET.includes(ch))).toBe(true);
      expect(isPlausibleCode(c)).toBe(true);
      seen.add(c);
    }
    expect(seen.size).toBe(10_000);
  });
  it("the alphabet has 32 symbols and no I, L, O, U (so `byte & 31` is unbiased)", () => {
    expect(ALPHABET).toHaveLength(32);
    for (const bad of "ILOU") expect(ALPHABET).not.toContain(bad);
  });
  it("every symbol appears in a large sample (no dead symbols)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const ch of generateCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(32);
  });
  it("formats as XXXX-XXXX", () => {
    expect(formatCode("ABCD1234")).toBe("ABCD-1234");
  });
  it.each([
    ["abcd-1234", "ABCD1234"],
    ["ab cd 1234", "ABCD1234"],
    ["ABCD-12O4", "ABCD1204"], // O -> 0
    ["ABCD-I234", "ABCD1234"], // I -> 1
    ["ABCD-l234", "ABCD1234"], // l -> 1
    ["  abcd1234  ", "ABCD1234"],
  ])("normalises %j to %j", (input, expected) => {
    expect(normaliseCode(input)).toBe(expected);
  });
  it("rejects implausible input before any lookup", () => {
    for (const bad of ["", "ABC", "ABCD12345", "ABCDEFG!", "ABCDUUUU"]) expect(isPlausibleCode(normaliseCode(bad))).toBe(false);
  });
  it("hashing: deterministic, 64 hex, depends on the pepper, and is never the code", () => {
    const h = hashCode("ABCD1234", PEPPER);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCode("ABCD1234", PEPPER)).toBe(h);
    expect(hashCode("ABCD1234", PEPPER + "x")).not.toBe(h);
    expect(hashCode("ABCD1235", PEPPER)).not.toBe(h);
    expect(h).not.toContain("ABCD1234");
  });
  it("link references are ITN-LNK- plus 8 symbols", () => {
    expect(generateLinkRef()).toMatch(new RegExp(`^ITN-LNK-[${ALPHABET}]{8}$`));
  });
});

describe("evaluateShare: the four states of NFR-05", () => {
  const t = (iso: string) => new Date(iso);
  const share = { expires_at: t("2026-11-13T12:00:00Z"), revoked_at: null as Date | null };
  it("valid before expiry", () => expect(evaluateShare(share, t("2026-11-13T11:59:59Z"))).toBe("valid"));
  it("expired at the expiry instant and after", () => {
    expect(evaluateShare(share, t("2026-11-13T12:00:00Z"))).toBe("expired");
    expect(evaluateShare(share, t("2026-11-14T00:00:00Z"))).toBe("expired");
  });
  it("revoked, even while unexpired", () => expect(evaluateShare({ ...share, revoked_at: t("2026-11-13T10:00:00Z") }, t("2026-11-13T10:30:00Z"))).toBe("revoked"));
  it("revoked wins over expired", () => expect(evaluateShare({ ...share, revoked_at: t("2026-11-13T10:00:00Z") }, t("2026-11-14T00:00:00Z"))).toBe("revoked"));
});

describe("rate limit (L10)", () => {
  it("limits at the fifth failure, not before", () => {
    expect([0, 1, 4].map(isRateLimited)).toEqual([false, false, false]);
    expect([5, 6, 100].map(isRateLimited)).toEqual([true, true, true]);
  });
  it("client ip: first x-forwarded-for entry, else x-real-ip, else unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
  it("the raw IP is never stored: it is HMAC'd with the pepper", () => {
    const h = hashIp("1.2.3.4", PEPPER);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("1.2.3.4");
    expect(hashIp("1.2.3.4", "other-pepper-0123456789")).not.toBe(h);
  });
});

describe("share expiry limits (L13)", () => {
  it("defaults to 60 minutes", () => expect(expiryMinutes("general", undefined)).toBe(60));
  it.each([[15, 15], [1440, 1440]])("general %i is allowed", (m, ok) => expect(expiryMinutes("general", m)).toBe(ok));
  it.each([5, 14, 1441, 10080])("general %i is refused", (m) => expect(expiryMinutes("general", m)).toBeNull());
  it("referral shares may last up to 7 days", () => {
    expect(expiryMinutes("referral", 7 * 24 * 60)).toBe(10080);
    expect(expiryMinutes("referral", 7 * 24 * 60 + 1)).toBeNull();
  });
});

// ---- hidden filter

const fact = (over: Partial<FactDTO> = {}): FactDTO => ({
  id: crypto.randomUUID(), record_id: "r1", document_id: "d1", origin: "ai_read", state: "confirmed", kind: "lab",
  label_as_printed: "Haemoglobin", value_as_printed: "9.8", unit_as_printed: "g/dL", range_as_printed: "12.0 - 16.0", flag_as_printed: null,
  value_num: 9.8, range_low: 12, range_high: 16, unreadable: false, check_carefully: false, confidence: "high", source_quote: "q",
  source_box: null, source_page: 1, fact_date: "2026-11-03", fact_date_as_printed: "03/11/2026", test_key: "haemoglobin",
  sensitive_category: null, facility_name: null, extra: {}, superseded_by: null, has_image: true, created_at: "2026-11-13T00:00:00.000Z", ...over,
});
const none = { hiddenCategories: [], hiddenDocumentIds: [] };

describe("hidden filter (FR-15)", () => {
  it("hides a category", () => {
    const a = fact({ sensitive_category: "mental_health" });
    const b = fact();
    const r = filterFactsForShare([a, b], { hiddenCategories: ["mental_health"], hiddenDocumentIds: [] });
    expect(r.visible).toEqual([b]);
    expect(r.hiddenAny).toBe(true);
  });
  it("hides a whole document", () => {
    const a = fact({ document_id: "dX" });
    const b = fact({ document_id: "d1" });
    expect(filterFactsForShare([a, b], { hiddenCategories: [], hiddenDocumentIds: ["dX"] }).visible).toEqual([b]);
  });
  it("a fact with no document is unaffected by a document hide", () => {
    const a = fact({ document_id: null });
    expect(filterFactsForShare([a], { hiddenCategories: [], hiddenDocumentIds: ["dX"] }).visible).toEqual([a]);
  });
  it("removed and superseded facts are always excluded, hiddenAny only when the patient hid something", () => {
    const removed = { ...fact(), removed_at: "2026-11-13T00:00:00Z" };
    const superseded = fact({ superseded_by: "x" });
    const ok = fact();
    const r = filterFactsForShare([removed, superseded, ok], none);
    expect(r.visible).toEqual([ok]);
    expect(r.hiddenAny).toBe(false);
  });
  it("hiddenAny is true if the patient hid something, even when nothing matched", () => {
    expect(filterFactsForShare([fact()], { hiddenCategories: ["substance_use"], hiddenDocumentIds: [] }).hiddenAny).toBe(true);
  });
  it("isHiddenByShare agrees with the policy decision for the image route", () => {
    const hides = { hiddenCategories: ["mental_health"], hiddenDocumentIds: [] };
    const f = fact({ sensitive_category: "mental_health" });
    expect(isHiddenByShare(f, hides)).toBe(true);
    const clinician = { kind: "clinician", viewerSessionId: "v", shareId: "s", recordId: "r1", shareValid: true, purpose: "general" } as const;
    const d = can(clinician, "see_source_image", { recordId: "r1", fact: { origin: "ai_read", sensitiveCategory: "mental_health", documentId: "d1" }, share: hides });
    expect(d.allowed).toBe(false);
  });
});

// ---- viewer sessions

const t0 = new Date("2026-11-13T10:00:00Z");
const sess = (over: Partial<SessionRow> = {}): SessionRow => ({ token_hash: "th", viewer_name: "Dr A", practice_no: "MDCN 12345", expires_at: new Date(t0.getTime() + 30 * 60_000), ...over });
const shr = (over: Partial<SessionShare> = {}): SessionShare => ({
  id: "s1", record_id: "r1", purpose: "general", referral_id: null, expires_at: new Date(t0.getTime() + 60 * 60_000), revoked_at: null,
  hiddenCategories: [], hiddenDocumentIds: [], ...over,
});

describe("viewer session (L8, L11)", () => {
  it("token: 32 random bytes base64url; only its sha256 is stored", () => {
    const tok = newViewerToken();
    expect(tok).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newViewerToken()).not.toBe(tok);
    expect(hashViewerToken(tok)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashViewerToken(tok)).not.toContain(tok);
  });
  it("lifetime is the earlier of 30 minutes and the share expiry", () => {
    expect(sessionExpiry(t0, new Date(t0.getTime() + 60 * 60_000)).getTime()).toBe(t0.getTime() + 30 * 60_000);
    expect(sessionExpiry(t0, new Date(t0.getTime() + 5 * 60_000)).getTime()).toBe(t0.getTime() + 5 * 60_000);
  });
  it("cookie: HttpOnly, SameSite=Lax, Path=/, Max-Age capped at the share expiry", () => {
    const exp = sessionExpiry(t0, new Date(t0.getTime() + 5 * 60_000));
    const c = serializeCookie("TOKEN", cookieOptions(exp, t0));
    expect(c).toContain("itan_v=TOKEN");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
    expect(c).toContain("Max-Age=300");
  });
  it("reads the cookie among others, and ignores look-alikes", () => {
    expect(readViewerCookie("a=1; itan_v=abc123; b=2")).toBe("abc123");
    expect(readViewerCookie("xitan_v=nope")).toBeNull();
    expect(readViewerCookie(null)).toBeNull();
    expect(readViewerCookie("itan_v=")).toBeNull();
  });
  it("a valid session resolves to a clinician actor with the share's hides", () => {
    const r = resolveViewer(sess(), shr({ hiddenCategories: ["mental_health"] }), t0);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.actor).toMatchObject({ kind: "clinician", shareValid: true, recordId: "r1", purpose: "general" });
      expect(r.share.hiddenCategories).toEqual(["mental_health"]);
    }
  });
  it("no session or no share means no_cookie", () => {
    expect(resolveViewer(null, shr(), t0)).toEqual({ ok: false, reason: "no_cookie" });
    expect(resolveViewer(sess(), null, t0)).toEqual({ ok: false, reason: "no_cookie" });
  });
  it("the share is re-checked on every call: revoke stops the session at once (FR-11)", () => {
    expect(resolveViewer(sess(), shr(), t0).ok).toBe(true);
    expect(resolveViewer(sess(), shr({ revoked_at: new Date(t0.getTime() + 1000) }), new Date(t0.getTime() + 2000))).toEqual({ ok: false, reason: "share_revoked" });
  });
  it("an expired share stops the session even if the session itself is unexpired", () => {
    expect(resolveViewer(sess(), shr(), new Date(t0.getTime() + 61 * 60_000))).toEqual({ ok: false, reason: "share_expired" });
  });
  it("an expired session is refused even if the share is still valid", () => {
    expect(resolveViewer(sess(), shr(), new Date(t0.getTime() + 31 * 60_000))).toEqual({ ok: false, reason: "session_expired" });
  });
  it("revoked beats everything else", () => {
    expect(resolveViewer(sess(), shr({ revoked_at: t0 }), new Date(t0.getTime() + 99 * 60_000))).toEqual({ ok: false, reason: "share_revoked" });
  });
});

// ---- summary

describe("clinician summary (FR-12, FR-24, NFR-16)", () => {
  const ctx = {
    viewer: { name: "Dr A", practiceNo: "MDCN 12345", sessionId: "th" },
    share: { id: "s1", expiresAt: new Date("2026-11-13T12:00:00Z"), hiddenCategories: ["mental_health"], hiddenDocumentIds: [], referralId: null },
  };
  const record = { display_name: "Demo Patient (SYNTHETIC)", birth_year: 1972, is_self: true };
  const old = fact({ test_key: "hba1c", label_as_printed: "HbA1c", value_as_printed: "8.1", value_num: 8.1, unit_as_printed: "%", fact_date: "2026-05-14" });
  const latest = fact({ test_key: "hba1c", label_as_printed: "HbA1c", value_as_printed: "7.4", value_num: 7.4, unit_as_printed: "%", fact_date: "2026-11-03" });
  const med = fact({ kind: "medication", label_as_printed: "Amoxicillin 500 mg", test_key: null, state: "unverified" });
  const allergy = fact({ kind: "allergy", label_as_printed: "Penicillin", test_key: null });
  const dx = fact({ kind: "diagnosis", label_as_printed: "Type 2 diabetes mellitus", test_key: null });
  const hidden = fact({ kind: "diagnosis", label_as_printed: "Anxiety disorder, on review", test_key: null, sensitive_category: "mental_health" });
  const referral = fact({ kind: "referral", label_as_printed: "Referral letter", test_key: null });
  const s = buildSummary(ctx, record, [old, latest, med, allergy, dx, hidden, referral]);

  it("groups into medicines, allergies, diagnoses and recent results", () => {
    expect(s.sections.medicines.map((f) => f.id)).toEqual([med.id]);
    expect(s.sections.allergies.map((f) => f.id)).toEqual([allergy.id]);
    expect(s.sections.diagnoses.map((f) => f.id)).toEqual([dx.id]);
    expect(s.sections.recent_results.map((f) => f.id)).toEqual([latest.id]);
  });
  it("a hidden-category fact appears nowhere in the payload, not even its id or label", () => {
    const json = JSON.stringify(s);
    expect(json).not.toContain(hidden.id);
    expect(json).not.toContain("Anxiety");
  });
  it("tells the clinician the record is partial without saying what was hidden", () => {
    expect(s.partial_notice).toBe(PARTIAL_NOTICE);
    expect(JSON.stringify(s)).not.toContain("mental_health");
  });
  it("no partial notice when nothing was hidden", () => {
    expect(buildSummary({ ...ctx, share: { ...ctx.share, hiddenCategories: [] } }, record, [latest]).partial_notice).toBeNull();
  });
  it("recent results carry the previous value (FR-24) and unverified facts are shown, flagged by state", () => {
    expect(s.sections.recent_results[0].previous?.value_as_printed).toBe("8.1");
    expect(s.sections.medicines[0].state).toBe("unverified");
  });
  it("states that name and practice number are unverified, and carries the caregiver flag", () => {
    expect(s.recorded_notice).toBe(RECORDED_NOTICE);
    expect(buildSummary(ctx, { ...record, is_self: false }, []).record.held_by_caregiver).toBe(true);
  });
  it("shows at most 12 recent results", () => {
    const many = Array.from({ length: 20 }, (_, i) => fact({ test_key: null, label_as_printed: `Test ${i}`, fact_date: `2026-10-${String(i + 1).padStart(2, "0")}` }));
    expect(buildSummary(ctx, record, many).sections.recent_results).toHaveLength(12);
  });
  it("the payload carries no secrets or hashes", () => {
    expect(JSON.stringify(s)).not.toMatch(/code_hash|token_hash|pepper|password/i);
  });
});

describe("access-log labels", () => {
  it("describes entries in plain English", () => {
    const e = { actor_type: "clinician", actor_label: "Dr A · MDCN 12345 (unverified)", outcome: "allowed", reason: null };
    expect(describeLogEntry({ ...e, action: "viewer_opened" })).toBe("Dr A · MDCN 12345 (unverified) opened your record");
    expect(describeLogEntry({ ...e, action: "viewer_open_refused", outcome: "refused", reason: "revoked" })).toContain("revoked");
    expect(describeLogEntry({ ...e, actor_type: "patient", actor_label: "patient", action: "share_created" })).toBe("You created a share code");
    expect(describeLogEntry({ ...e, action: "something_new" })).toContain("something_new");
  });
});
