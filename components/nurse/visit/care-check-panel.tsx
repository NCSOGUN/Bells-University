"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Smartphone, Server } from "lucide-react";
import { CARE_CHECK_LIMITS, describeRules, runCareCheck, type CheckStatus, type FindingSeverity } from "@/lib/care-check";
import { personalisedCheckAllowed } from "@/lib/consent";
import { requestCareCheck } from "@/lib/care-check-client";
import { NURSE_CARE_STATUS_LABEL } from "@/lib/care-status";
import { useDemo } from "@/lib/demo-context";
import { firstName, formatTime } from "@/lib/format";
import { careCheckInput, careCheckKey, decideCareCheck, historyForVisit, setCareCheck } from "@/lib/visit-flow";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { CareStatusChip } from "../care-status-chip";
import type { VisitContext } from "./visit-frame";

const SEVERITY_LABEL: Record<FindingSeverity, string> = { urgent: "Urgent", watch: "Watch", info: "Note" };
const STATUSES: CheckStatus[] = ["green", "yellow", "red"];

/**
 * The Care Check on the nurse's checklist: runs as the vitals are completed,
 * shows why it suggests what it does, and requires the nurse to confirm or
 * change a Monitoring/Needs-attention result before the report can be sent.
 */
export function CareCheckPanel({ state, visit, elder, workflow }: Required<Pick<VisitContext, "state" | "visit" | "elder" | "workflow">>) {
  const { update } = useDemo();
  const who = firstName(elder.name);
  const offline = workflow.offline;

  const history = useMemo(() => historyForVisit(state, visit.id), [state, visit.id]);
  const input = useMemo(() => careCheckInput(workflow.report, history), [workflow.report, history]);
  const key = input ? careCheckKey(input) : null;
  const storedKey = workflow.careCheck?.inputKey;
  const draft = key && storedKey === key ? workflow.careCheck : undefined;

  const [rejected, setRejected] = useState<{ key: string; errors: string[] } | null>(null);
  const [changing, setChanging] = useState(false);
  const [pick, setPick] = useState<CheckStatus>("yellow");
  const [reason, setReason] = useState("");

  // Run the check shortly after the nurse stops typing, on the server, or on
  // this phone when offline. A newer reading cancels the one in flight.
  useEffect(() => {
    if (!input || !key || storedKey === key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const outcome = await requestCareCheck(input, { offline, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (outcome.ok) update((prev) => setCareCheck(prev, visit.id, key, outcome.result));
        else setRejected({ key, errors: outcome.errors });
      } catch {
        // Cancelled by a newer reading: nothing to do.
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input, key, storedKey, offline, update, visit.id]);

  const checkHere = () => {
    if (!input || !key) return;
    update((prev) => setCareCheck(prev, visit.id, key, runCareCheck(input, "on-device")));
  };

  const decide = (finalStatus: CheckStatus, why?: string) => {
    update((prev) => decideCareCheck(prev, visit.id, { finalStatus, reason: why }));
    setChanging(false);
    setReason("");
  };

  const result = draft?.result;
  const decision = draft?.decision;
  const rejection = rejected && rejected.key === key ? rejected.errors : null;
  const needsDecision = result && result.suggestedStatus !== "green" && !decision;

  return (
    <section aria-labelledby="care-check-title" className="space-y-4 rounded-2xl border-2 border-navy bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="care-check-title" className="flex items-center gap-2 text-h2 font-semibold">
          <ShieldCheck aria-hidden className="size-5" />
          Care check
        </h2>
        {result && (
          <p className="flex items-center gap-1.5 text-small text-ink">
            {result.source === "server" ? <Server aria-hidden className="size-4" /> : <Smartphone aria-hidden className="size-4" />}
            {result.source === "server" ? "Checked on our server" : "Checked on this phone"} · {result.modelVersion}
          </p>
        )}
      </div>

      {!input && (
        <p className="text-small">
          Fill in the vital signs and medication above. {who}&apos;s readings are then compared with their own earlier
          visits, and you&apos;ll see the result here before you submit.
        </p>
      )}

      {input && !result && !rejection && (
        <div role="status" className="space-y-3">
          <p className="text-navy">Comparing with {who}&apos;s earlier visits…</p>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Button variant="ghost" onClick={checkHere} className="min-h-11">
            Check on this phone instead
          </Button>
        </div>
      )}

      {rejection && (
        <div role="alert" className="rounded-xl border-2 border-coral bg-coral/10 p-3 text-navy">
          <p className="font-semibold">The care check couldn&apos;t accept these readings.</p>
          <ul className="mt-1 list-disc pl-5 text-small">
            {rejection.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-small font-semibold text-navy">Suggested</span>
            <CareStatusChip status={result.suggestedStatus} />
          </div>

          <p className="text-small">
            {result.baseline
              ? `${who}'s usual: ${result.baseline.systolic}/${result.baseline.diastolic} mmHg, pulse ${result.baseline.pulse} bpm (the middle of their last ${result.baseline.basedOnVisits} visits).`
              : personalisedCheckAllowed(elder)
                ? `${who} doesn't have enough earlier visits for a personal usual yet, so only the fixed limits were used.`
                : `${who}'s family hasn't allowed comparison with earlier visits, so only the fixed limits were used.`}
          </p>

          {result.findings.length === 0 ? (
            <p className="font-medium text-navy">Nothing unusual compared with {who}&apos;s earlier visits or the fixed limits.</p>
          ) : (
            <ul className="space-y-2">
              {result.findings.map((f) => (
                <li key={f.ruleId} className="rounded-xl border border-line bg-bg p-3">
                  <p className="font-semibold text-navy">
                    <span className="mr-2 rounded border border-navy px-1.5 py-0.5 text-label uppercase">{SEVERITY_LABEL[f.severity]}</span>
                    {f.headline}
                  </p>
                  <p className="mt-1 text-small">{f.reason}</p>
                </li>
              ))}
            </ul>
          )}

          {needsDecision && (
            <p className="rounded-xl border-2 border-amber bg-amber/10 p-3 font-medium text-navy">
              This is a suggestion, not a decision. Confirm it, or change it if your own judgement says otherwise. The family
              only sees what you decide.
            </p>
          )}

          {decision ? (
            <div className="rounded-xl border-2 border-teal bg-teal-tint p-3 text-navy" role="status">
              <p className="font-semibold">
                {decision.finalStatus === result.suggestedStatus ? "You confirmed" : "You changed this to"}:{" "}
                {NURSE_CARE_STATUS_LABEL[decision.finalStatus]}
              </p>
              {decision.reason && <p className="mt-1 text-small">Your reason: {decision.reason}</p>}
              <Button variant="ghost" className="mt-1 min-h-11" onClick={() => { setChanging(true); setPick(decision.finalStatus); setReason(decision.reason ?? ""); }}>
                Change my decision
              </Button>
            </div>
          ) : (
            result.suggestedStatus === "green" && !changing && (
              <p className="text-small text-navy">No action needed. This will be recorded as Stable when you submit.</p>
            )
          )}

          {!decision && !changing && (
            <div className="flex flex-wrap gap-3">
              {needsDecision && (
                <Button onClick={() => decide(result.suggestedStatus)}>
                  Confirm: {NURSE_CARE_STATUS_LABEL[result.suggestedStatus]}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setChanging(true);
                  setPick(result.suggestedStatus === "green" ? "yellow" : "green");
                }}
              >
                {result.suggestedStatus === "green" ? "I'm concerned anyway" : "Change the status"}
              </Button>
            </div>
          )}

          {changing && (
            <fieldset className="space-y-3 rounded-xl border border-line bg-bg p-4">
              <legend className="px-1 font-semibold text-navy">Set the status yourself</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {STATUSES.map((s) => (
                  <label
                    key={s}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-navy ${pick === s ? "border-teal bg-teal-tint" : "border-muted bg-surface hover:border-navy"}`}
                  >
                    <input type="radio" name="care-status" checked={pick === s} onChange={() => setPick(s)} className="size-4 accent-teal" />
                    {NURSE_CARE_STATUS_LABEL[s]}
                  </label>
                ))}
              </div>
              {pick !== result.suggestedStatus && (
                <div>
                  <label htmlFor="override-reason" className="font-semibold text-navy">
                    Why? (this goes on the record with your name and the time)
                  </label>
                  <textarea
                    id="override-reason"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`${INPUT_CLASSES} mt-1 py-3`}
                    placeholder="For example: reported dizziness on standing."
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => decide(pick, reason)} disabled={pick !== result.suggestedStatus && !reason.trim()}>
                  Save my decision
                </Button>
                <Button variant="ghost" onClick={() => setChanging(false)}>
                  Cancel
                </Button>
              </div>
            </fieldset>
          )}

          <p className="text-label text-ink">
            Checked {formatTime(result.evaluatedAt)}
            {result.requestId ? ` · Check ID ${result.requestId.slice(0, 8)}` : ""} · This check sends numbers only, never {who}&apos;s name or address.
          </p>
        </>
      )}

      <HowItWorks />
    </section>
  );
}

/** The rules and the limits, in plain words, built from the same constants the check runs on. */
export function HowItWorks() {
  return (
    <details className="rounded-xl border border-line bg-bg p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-navy">How this check works, and what it can&apos;t do</summary>
      <div className="space-y-3 pt-2 text-small">
        <p>
          It compares today&apos;s readings with this person&apos;s own earlier visits and with fixed limits, then suggests a status
          and shows the rule behind each reason. It is rules-based, not artificial intelligence, so it can always explain itself.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {describeRules().map((r) => (
            <li key={r.id}>{r.text}</li>
          ))}
        </ul>
        <p className="font-semibold text-navy">What it can&apos;t do</p>
        <ul className="list-disc space-y-1 pl-5">
          {CARE_CHECK_LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
