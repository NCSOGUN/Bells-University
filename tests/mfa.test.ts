// FR-28: two-step sign-in. An account with a verified authenticator must pass the code (aal2) before it creates a share
// code or links a hospital. Ending access never needs it. Fail closed when the level cannot be read.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { aalFromJwt, hasVerifiedTotp, stepUpNeeded } from "@/lib/auth";
import { mfaRequired, ServiceUnavailableError } from "@/lib/http";

const jwtWith = (payload: unknown) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const factors = (...f: { factor_type: string; status: string }[]) => async () => ({ data: { factors: f }, error: null });
const verifiedTotp = { factor_type: "totp", status: "verified" };

describe("aalFromJwt", () => {
  it("reads aal1 and aal2", () => {
    expect(aalFromJwt(jwtWith({ aal: "aal2" }))).toBe("aal2");
    expect(aalFromJwt(jwtWith({ aal: "aal1" }))).toBe("aal1");
  });
  it("anything else is null, never aal2", () => {
    expect(aalFromJwt(jwtWith({ aal: "aal3" }))).toBeNull();
    expect(aalFromJwt(jwtWith({}))).toBeNull();
    expect(aalFromJwt("not-a-jwt")).toBeNull();
    expect(aalFromJwt("a.%%%.c")).toBeNull();
    expect(aalFromJwt("")).toBeNull();
  });
});

describe("hasVerifiedTotp", () => {
  it("true only for a verified totp factor", async () => {
    await expect(hasVerifiedTotp(factors(verifiedTotp))).resolves.toBe(true);
    await expect(hasVerifiedTotp(factors({ factor_type: "totp", status: "unverified" }))).resolves.toBe(false);
    await expect(hasVerifiedTotp(factors({ factor_type: "phone", status: "verified" }))).resolves.toBe(false);
    await expect(hasVerifiedTotp(factors())).resolves.toBe(false);
    await expect(hasVerifiedTotp(async () => ({ data: null, error: null }))).resolves.toBe(false);
  });
  it("a failed or slow factor lookup is a 503, never a silent no", async () => {
    await expect(hasVerifiedTotp(async () => ({ data: null, error: new Error("x") }))).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(hasVerifiedTotp(() => new Promise(() => {}), 20)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("stepUpNeeded", () => {
  it("an aal2 session never needs the code and does not even look up factors", async () => {
    const list = vi.fn(factors(verifiedTotp));
    await expect(stepUpNeeded({ userId: "u", aal: "aal2" }, list)).resolves.toBe(false);
    expect(list).not.toHaveBeenCalled();
  });
  it("an enrolled account at aal1 needs the code", async () => {
    await expect(stepUpNeeded({ userId: "u", aal: "aal1" }, factors(verifiedTotp))).resolves.toBe(true);
  });
  it("an account with no authenticator is unaffected", async () => {
    await expect(stepUpNeeded({ userId: "u", aal: "aal1" }, factors())).resolves.toBe(false);
    await expect(stepUpNeeded({ userId: "u", aal: null }, factors())).resolves.toBe(false);
  });
  it("fails closed: an unreadable level on an enrolled account needs the code", async () => {
    await expect(stepUpNeeded({ userId: "u", aal: null }, factors(verifiedTotp))).resolves.toBe(true);
  });
});

describe("mfaRequired", () => {
  it("is a 403 with the mfa_required code and no detail", async () => {
    const r = mfaRequired();
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("mfa_required");
  });
});

describe("where the rule applies", () => {
  const read = (f: string) => readFileSync(f, "utf8");
  it("creating a share and linking a hospital require the step-up", () => {
    for (const f of ["app/api/shares/route.ts", "app/api/links/route.ts"]) expect(read(f), f).toMatch(/requireStepUp\(request\)/);
  });
  it("ending access never does: revoking a share or unlinking a hospital stays easy", () => {
    for (const f of ["app/api/shares/[id]/revoke/route.ts", "app/api/links/[id]/revoke/route.ts"]) expect(read(f), f).not.toMatch(/requireStepUp/);
  });
});
