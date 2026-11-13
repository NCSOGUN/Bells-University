// Fact lifecycle (design section 6, FR-06, FR-07, FR-27, NFR-24). PURE.
//   ai_read -> unverified; patient_added -> confirmed; provider_entered -> confirmed.
//   unverified -> confirmed (confirm or correct); confirmed -> confirmed (correct, not provider_entered);
//   confirmed -> disputed (provider_entered only); disputed -> confirmed (withdraw);
//   unverified|confirmed -> removed (never provider_entered).
export type Origin = "ai_read" | "patient_added" | "provider_entered";
export type State = "unverified" | "confirmed" | "disputed";
export type LifecycleAction = "confirm" | "correct" | "remove" | "dispute" | "withdraw_dispute";

export type Transition =
  | { ok: true; newState: State; removed: boolean }
  | { ok: false; code: "provider_entered_immutable" | "invalid_transition" | "already_removed" };

export function initialState(origin: Origin): State {
  return origin === "ai_read" ? "unverified" : "confirmed";
}

export function applyTransition(fact: { origin: Origin; state: State; removedAt: Date | string | null }, action: LifecycleAction): Transition {
  if (fact.removedAt) return { ok: false, code: "already_removed" };
  const provider = fact.origin === "provider_entered";

  switch (action) {
    case "confirm":
      return fact.state === "unverified" ? { ok: true, newState: "confirmed", removed: false } : { ok: false, code: "invalid_transition" };
    case "correct":
      if (provider) return { ok: false, code: "provider_entered_immutable" };
      return fact.state === "disputed" ? { ok: false, code: "invalid_transition" } : { ok: true, newState: "confirmed", removed: false };
    case "remove":
      if (provider) return { ok: false, code: "provider_entered_immutable" };
      return { ok: true, newState: fact.state, removed: true };
    case "dispute":
      if (!provider) return { ok: false, code: "invalid_transition" };
      return fact.state === "confirmed" ? { ok: true, newState: "disputed", removed: false } : { ok: false, code: "invalid_transition" };
    case "withdraw_dispute":
      if (!provider) return { ok: false, code: "invalid_transition" };
      return fact.state === "disputed" ? { ok: true, newState: "confirmed", removed: false } : { ok: false, code: "invalid_transition" };
  }
}
