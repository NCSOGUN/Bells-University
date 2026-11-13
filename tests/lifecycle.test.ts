import { describe, expect, it } from "vitest";
import { applyTransition, initialState, type LifecycleAction, type Origin, type State } from "@/lib/facts/lifecycle";

type Edge = [Origin, State, LifecycleAction, State, boolean];

// Every legal edge of the lifecycle diagram (design section 6): [origin, from, action, to, removed].
const LEGAL: Edge[] = [
  ["ai_read", "unverified", "confirm", "confirmed", false],
  ["ai_read", "unverified", "correct", "confirmed", false],
  ["ai_read", "confirmed", "correct", "confirmed", false],
  ["ai_read", "unverified", "remove", "unverified", true],
  ["ai_read", "confirmed", "remove", "confirmed", true],
  ["patient_added", "confirmed", "correct", "confirmed", false],
  ["patient_added", "confirmed", "remove", "confirmed", true],
  ["provider_entered", "confirmed", "dispute", "disputed", false],
  ["provider_entered", "disputed", "withdraw_dispute", "confirmed", false],
];

// States each origin can actually be in.
const REACHABLE: Record<Origin, State[]> = {
  ai_read: ["unverified", "confirmed"],
  patient_added: ["confirmed"],
  provider_entered: ["confirmed", "disputed"],
};
const ACTIONS: LifecycleAction[] = ["confirm", "correct", "remove", "dispute", "withdraw_dispute"];
const isLegal = (o: Origin, s: State, a: LifecycleAction) => LEGAL.some(([lo, ls, la]) => lo === o && ls === s && la === a);

const everyCell = (Object.keys(REACHABLE) as Origin[]).flatMap((o) => REACHABLE[o].flatMap((s) => ACTIONS.map((a) => ({ o, s, a }))));

describe("fact lifecycle", () => {
  it.each(LEGAL)("%s %s --%s--> %s (removed=%s)", (origin, state, action, to, removed) => {
    expect(applyTransition({ origin, state, removedAt: null }, action)).toEqual({ ok: true, newState: to, removed });
  });

  it.each(everyCell.filter((c) => !isLegal(c.o, c.s, c.a)))("$o/$s/$a is refused", ({ o, s, a }) => {
    const r = applyTransition({ origin: o, state: s, removedAt: null }, a);
    expect(r.ok).toBe(false);
  });

  it("provider-entered facts report provider_entered_immutable for correct and remove", () => {
    for (const a of ["correct", "remove"] as const) {
      expect(applyTransition({ origin: "provider_entered", state: "confirmed", removedAt: null }, a)).toEqual({ ok: false, code: "provider_entered_immutable" });
    }
  });

  it("a removed fact allows nothing", () => {
    for (const a of ACTIONS) {
      expect(applyTransition({ origin: "ai_read", state: "unverified", removedAt: new Date() }, a)).toEqual({ ok: false, code: "already_removed" });
    }
  });

  it("initial states: ai_read unverified; patient_added and provider_entered confirmed", () => {
    expect(initialState("ai_read")).toBe("unverified");
    expect(initialState("patient_added")).toBe("confirmed");
    expect(initialState("provider_entered")).toBe("confirmed");
  });
});
