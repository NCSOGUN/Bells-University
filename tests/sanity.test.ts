import { describe, expect, it, afterEach } from "vitest";
import { SENSITIVE_CATEGORIES } from "@/lib/categories";
import { env, resetEnvCache, DEFAULT_SHARE_MINUTES } from "@/lib/config";

describe("sanity", () => {
  afterEach(() => resetEnvCache());

  it("runs tests with the @ alias", () => {
    expect(SENSITIVE_CATEGORIES).toHaveLength(5);
    expect(DEFAULT_SHARE_MINUTES).toBe(60);
  });

  it("env() is lazy and names missing variables without values", () => {
    const saved = { ...process.env };
    process.env.DATABASE_URL = "";
    try {
      expect(() => env()).toThrowError(/DATABASE_URL/);
    } finally {
      process.env = saved;
    }
  });
});
