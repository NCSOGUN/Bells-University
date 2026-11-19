"use client";

import { useState } from "react";
import { UserCheck } from "lucide-react";
import { recordInPersonConsent } from "@/lib/consent";
import { useDemo } from "@/lib/demo-context";
import { firstName } from "@/lib/format";
import { DEMO_NURSE_ID, type Elder } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

/**
 * Shown at the first visit, before any health data is taken: the family has
 * agreed, but the elder has not yet said yes themself. The nurse asks and records it.
 */
export function ConsentPanel({ elder }: { elder: Elder }) {
  const { update } = useDemo();
  const [agreed, setAgreed] = useState(false);
  const who = firstName(elder.name);
  const rep = elder.consent?.representative;

  return (
    <section aria-labelledby="consent-title" className="space-y-3 rounded-2xl border-2 border-amber bg-amber/10 p-5">
      <h2 id="consent-title" className="flex items-center gap-2 text-h2 font-semibold">
        <UserCheck aria-hidden className="size-5" />
        Ask {who} first
      </h2>
      <p className="text-navy">
        {rep ? `${rep.name} (${rep.relationship.toLowerCase()}) agreed to share` : "The family agreed to share"} {who}&apos;s readings
        with you and the care circle. {who} hasn&apos;t said yes themself yet.
      </p>
      <p className="text-small text-navy">
        Explain what you&apos;ll record (blood pressure, pulse, temperature, weight, medicines and your notes) and who can see it. Then
        ask {who}.
      </p>
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-navy bg-surface px-3 font-semibold text-navy">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="size-5 accent-teal" />
        {who} agreed, in person.
      </label>
      <Button disabled={!agreed} onClick={() => update((prev) => recordInPersonConsent(prev, elder.id, DEMO_NURSE_ID))}>
        Record {who}&apos;s consent
      </Button>
      <p className="text-small">If {who} says no, don&apos;t start the visit. Let the coordinator know.</p>
    </section>
  );
}
