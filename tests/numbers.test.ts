import { describe, expect, it } from "vitest";
import { parseRange, parseValueNum } from "@/lib/extract/numbers";

describe("parseValueNum (L17)", () => {
  it.each([
    ["9.8", 9.8],
    ["98", 98],
    ["-1.5", -1.5],
    ["+3", 3],
    [" 7.4 ", 7.4],
    [".5", 0.5],
  ])("%j -> %s", (input, expected) => {
    expect(parseValueNum(input)).toBe(expected);
  });
  it.each(["<0.5", ">3", "Positive", "1,200", "9.8 g/dL", "9.8.1", "", "  ", "1e3", "NaN", "Infinity"])("%j -> null", (input) => {
    expect(parseValueNum(input)).toBeNull();
  });
  it("null gives null", () => {
    expect(parseValueNum(null)).toBeNull();
  });
});

describe("parseRange (L17)", () => {
  it.each([
    ["12.0 - 16.0", { low: 12, high: 16 }],
    ["12.0–16.0", { low: 12, high: 16 }],
    ["12.0—16.0", { low: 12, high: 16 }],
    ["12-16", { low: 12, high: 16 }],
    ["120 - 160 g/L", { low: 120, high: 160 }],
    ["4.0 - 11.0 x10^9/L", { low: 4, high: 11 }],
    ["< 5.7", { low: null, high: 5.7 }],
    ["<5.7 %", { low: null, high: 5.7 }],
    ["> 3", { low: 3, high: null }],
  ])("%j", (input, expected) => {
    expect(parseRange(input)).toEqual(expected);
  });
  it.each(["", "see note", "16 - 12", "12 to 16", "Negative", "12 - 16 - 20", "12-", null])("%j gives nulls", (input) => {
    expect(parseRange(input)).toEqual({ low: null, high: null });
  });
});
