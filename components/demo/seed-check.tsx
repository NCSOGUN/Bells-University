"use client";

import { useDemo } from "@/lib/demo-context";

// Session 1 placeholder: proves the provider, seed, and localStorage are wired.
export function SeedCheck() {
  const { state, hydrated, update } = useDemo();
  const elder = state.elders[0];
  const nurse = state.nurses.find((n) => n.id === elder.assignedNurseId);
  const completed = state.visits.filter((v) => v.elderId === elder.id && v.status === "complete");
  const flagged = completed.filter((v) => v.flagged).length;

  const markGreen = () =>
    update((prev) => ({
      ...prev,
      elders: prev.elders.map((e) =>
        e.id === elder.id ? { ...e, careStatus: "green", careStatusMessage: "All readings normal." } : e,
      ),
    }));

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-label font-semibold text-muted">
        Demo state {hydrated ? "loaded from this browser" : "loading…"}
      </p>
      <h2 className="mt-2 text-h2 font-semibold">
        {elder.name}, {elder.age} · {elder.city}
      </h2>
      <p className="mt-1">
        Care status <strong className="text-navy">{elder.careStatus}</strong>: {elder.careStatusMessage}
      </p>
      <p className="mt-1 text-small text-muted">
        {completed.length} completed visits ({flagged} flagged) with Nurse {nurse?.name} ·{" "}
        {state.plans.length} plans · {state.assignmentRequests.length} pending assignment
      </p>
      <button
        type="button"
        onClick={markGreen}
        className="mt-4 min-h-11 rounded-lg bg-teal px-4 font-semibold text-white transition-colors duration-150 hover:bg-navy"
      >
        Change status to test persistence
      </button>
      <p className="mt-2 text-small text-muted">Refresh to confirm it sticks, then use Reset demo.</p>
    </div>
  );
}
