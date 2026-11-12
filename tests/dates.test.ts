import { describe, expect, it } from "vitest";
import { parseDate } from "@/lib/extract/dates";

describe("parseDate (Locked decision L18)", () => {
  it.each([
    ["03/11/2026", "2026-11-03"], // day first
    ["3/11/2026", "2026-11-03"],
    ["03-11-2026", "2026-11-03"],
    ["03.11.2026", "2026-11-03"],
    ["13/02/2026", "2026-02-13"],
    ["2026-11-03", "2026-11-03"],
    ["3 Nov 2026", "2026-11-03"],
    ["03 November 2026", "2026-11-03"],
    ["3rd Nov, 2026", "2026-11-03"],
    ["  03/11/2026  ", "2026-11-03"],
  ])("%j -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it.each(["", "garbage", "sometime last week", "31/02/2026", "00/11/2026", "03/13/2026", "03/11/26", "3 Foo 2026", "2026-13-01"])(
    "%j -> null",
    (input) => {
      expect(parseDate(input)).toBeNull();
    },
  );

  it("null and undefined give null", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});
