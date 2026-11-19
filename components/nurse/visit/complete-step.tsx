"use client";

import { useEffect, useState } from "react";
import { sendVisitNotification } from "@/lib/push-client";
import { publishUpdate } from "@/lib/update-channel";
import { buildVisitUpdate } from "@/lib/visit-update";
import { BellRing, Check, Loader2, MapPin, MapPinOff } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { firstName, formatTime, nurseShortName } from "@/lib/format";
import { routes } from "@/lib/routes";
import { NURSE_CARE_STATUS_LABEL } from "@/lib/care-status";
import { careCheckBlocker, completeVisit, validateReport } from "@/lib/visit-flow";
import { ADHERENCE_LABEL } from "@/lib/vitals";
import { CareStatusChip } from "@/components/care/care-status-chip";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SuccessTick } from "@/components/ui/success-tick";
import { TextLink } from "@/components/ui/text-link";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";
import { VitalsInline } from "../vitals-inline";
import { VisitFrame, type VisitContext } from "./visit-frame";

// §4.3: report submission narrates both halves of what happens, ~1.5s in all.
const STAGES = ["Saving report…", "Sending family update…"] as const;
const STAGE_MS = 750;

export function CompleteVisitStep({ visitId }: { visitId: string }) {
  return (
    <VisitFrame visitId={visitId} step="Check out">
      {(ctx) => <Complete {...ctx} />}
    </VisitFrame>
  );
}

function Complete(ctx: VisitContext) {
  const { visit, workflow } = ctx;

  if (visit.status === "complete") return <Summary {...ctx} />;

  // A Monitoring / Needs-attention suggestion must be confirmed or changed first,
  // otherwise check-out would be refused and this page would never finish.
  const blocker = careCheckBlocker(ctx.state, visit.id);
  const ready =
    visit.status === "in_progress" &&
    workflow &&
    !workflow.offline &&
    Object.keys(validateReport(workflow.report)).length === 0 &&
    !blocker;

  if (!ready) {
    return (
      <Card title="The report isn't ready to send">
        <p>
          {visit.status === "scheduled"
            ? "This visit hasn't started yet."
            : workflow?.offline
              ? "You're offline. Your report is saved on this phone and will send when you're back online."
              : (blocker ?? "Some checklist answers are still missing.")}
        </p>
        <ButtonLink
          href={visit.status === "scheduled" ? routes.nurseVisitStart(visit.id) : routes.nurseVisitChecklist(visit.id)}
          className="mt-4 w-full"
        >
          {visit.status === "scheduled" ? "Go to check-in" : "Back to the checklist"}
        </ButtonLink>
      </Card>
    );
  }

  return <Submitting visitId={visit.id} />;
}

function Submitting({ visitId }: { visitId: string }) {
  const { update } = useDemo();
  const [stage, setStage] = useState(0);
  const done = stage >= STAGES.length;

  useEffect(() => {
    if (done) return;
    const id = window.setTimeout(() => setStage((s) => s + 1), STAGE_MS);
    return () => window.clearTimeout(id);
  }, [stage, done]);

  // Once both stages have shown, write the check-out onto the visit.
  useEffect(() => {
    if (done) update((prev) => completeVisit(prev, visitId));
  }, [done, update, visitId]);

  return (
    <div className="rounded-2xl bg-surface shadow-card p-5">
      <ol aria-label="Submitting" className="space-y-3">
        {STAGES.map((label, i) => (
          <li key={label} className={`flex items-center gap-3 ${i > stage ? "opacity-40" : ""}`}>
            <span
              aria-hidden
              className={`grid size-8 place-items-center rounded-full border-2 ${
                i < stage ? "border-teal bg-teal" : "border-line"
              } text-navy`}
            >
              {i < stage ? <Check className="size-4" strokeWidth={3} /> : i === stage && <Loader2 className="size-4 motion-safe:animate-spin" />}
            </span>
            <span className={i === stage ? "font-semibold text-navy" : "text-navy"}>{label}</span>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {STAGES[Math.min(stage, STAGES.length - 1)]}
      </p>
      <div className="mt-4 border-t border-line pt-2 text-right">
        <button
          type="button"
          onClick={() => setStage(STAGES.length)}
          className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-navy text-teal-deep decoration-2 underline-offset-4 hover:underline"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

type PushOutcome = { kind: "sent"; at: string; phones: number } | { kind: "none"; why: string };

function Summary({ state, visit, elder, nurse, workflow }: VisitContext) {
  const sentAt = workflow?.familyUpdateSentAt;
  const [push, setPush] = useState<PushOutcome | null>(null);

  // Push the update to the family's phone once per visit: to a real phone by
  // Web Push, and to the laptop's phone window. The key survives a refresh of
  // this page, so the family isn't notified twice.
  useEffect(() => {
    if (!sentAt) return;
    const key = `carecircle-published:${visit.id}:${visit.checkOutAt ?? ""}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: publishing twice is harmless, the phone ignores repeats.
    }
    const update = buildVisitUpdate(state, visit.id);
    if (!update) return;
    publishUpdate(update);
    void sendVisitNotification(update).then((r) =>
      setPush(
        r.sent > 0
          ? { kind: "sent", at: new Date().toISOString(), phones: r.sent }
          : { kind: "none", why: r.error ?? "No phone has turned on notifications yet." },
      ),
    );
  }, [sentAt, state, visit.id, visit.checkOutAt]);
  const who = firstName(elder.name);
  const bp = visit.vitals?.bloodPressure;
  const medication = visit.medicationAdherence && ADHERENCE_LABEL[visit.medicationAdherence].toLowerCase();

  return (
    <div className="space-y-6">
      <section aria-labelledby="done-heading" className="rounded-3xl border-2 border-teal bg-teal-tint p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <SuccessTick />
          <div>
            <h2 id="done-heading" className="text-h1 font-bold">
              Visit complete
            </h2>
            <p className="text-navy">Report submitted and saved to {who}&apos;s record.</p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-teal/40 pt-4 text-small sm:grid-cols-2">
          <Fact label="Checked in" time={visit.checkInAt} gps={visit.gpsConfirmed} />
          <Fact label="Checked out" time={visit.checkOutAt} gps={visit.checkOutGpsConfirmed ?? visit.gpsConfirmed} />
        </dl>
        {visit.vitals && (
          <div className="mt-4">
            <VitalsInline vitals={visit.vitals} />
          </div>
        )}
      </section>

      {visit.careCheck && <CareCheckSummary visit={visit} who={who} />}

      {sentAt && (
        <section aria-labelledby="family-heading" className="rounded-2xl bg-surface shadow-float p-5">
          <h2 id="family-heading" className="flex items-center gap-2 text-h2 font-semibold">
            <WhatsAppMark className="size-7" />
            The family&apos;s WhatsApp update was sent.
          </h2>
          <p className="mt-1 text-small">
            Sent to {who}&apos;s family at {formatTime(sentAt)}. They can also see it on their dashboard.
          </p>
          {push && (
            <p role="status" className="mt-2 flex items-start gap-2 text-small text-navy">
              <BellRing aria-hidden className="mt-0.5 size-4 shrink-0" />
              {push.kind === "sent"
                ? `Notification delivered to ${push.phones === 1 ? "the family's phone" : `${push.phones} family phones`} at ${formatTime(push.at)}.`
                : `No phone notification sent: ${push.why}`}
            </p>
          )}
          <blockquote className="mt-4 rounded-xl rounded-tl-sm bg-teal-tint p-4 text-small text-navy">
            <CareStatusChip status={elder.careStatus} />
            <p className="mt-2">
              {nurse ? nurseShortName(nurse.name) : "Your nurse"} has finished today&apos;s visit with {who}.
              {bp && ` Blood pressure ${bp} mmHg`}
              {medication && `, medication ${medication}`}.
              {!visit.gpsConfirmed && " Location wasn't recorded for this visit."}
            </p>
            {visit.nurseNotes && <p className="mt-2">&ldquo;{visit.nurseNotes}&rdquo;</p>}
          </blockquote>
          <p className="mt-4 text-small">
            Nurses can&apos;t read a family&apos;s messages. For this demo only, you can look at the thread from
            the family&apos;s side.
          </p>
          <TextLink href={routes.familyWhatsApp}>Preview what the family sees</TextLink>
        </section>
      )}

      <ButtonLink href={routes.nurseDashboard} className="w-full">
        Back to today&apos;s visits
      </ButtonLink>
    </div>
  );
}

function CareCheckSummary({ visit, who }: { visit: NonNullable<VisitContext["visit"]>; who: string }) {
  const check = visit.careCheck;
  if (!check) return null;
  const { decision } = check;
  const changed = decision.finalStatus !== check.suggestedStatus;
  return (
    <section aria-labelledby="check-heading" className="rounded-2xl bg-surface shadow-card p-5">
      <h2 id="check-heading" className="text-h2 font-semibold">
        Care check
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <CareStatusChip status={decision.finalStatus} />
        <p className="text-small text-navy">
          {changed
            ? `The check suggested ${NURSE_CARE_STATUS_LABEL[check.suggestedStatus]}. You changed it at ${formatTime(decision.decidedAt)}.`
            : `You confirmed the suggestion at ${formatTime(decision.decidedAt)}.`}
        </p>
      </div>
      {decision.reason && <p className="mt-2 text-navy">Your reason: {decision.reason}</p>}
      {check.findings.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-small">
          {check.findings.map((f) => (
            <li key={f.ruleId}>{f.reason}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-label text-ink">
        {who}&apos;s family sees this status and reason. Checked {check.source === "server" ? "on our server" : "on this phone"} · {check.modelVersion}.
      </p>
    </section>
  );
}

function Fact({ label, time, gps }: { label: string; time?: string; gps: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {gps ? <MapPin aria-hidden className="mt-0.5 size-4 text-navy" /> : <MapPinOff aria-hidden className="mt-0.5 size-4 text-navy" />}
      <div>
        <dt className="font-semibold text-navy">{label}</dt>
        <dd>
          {time ? formatTime(time) : "Not recorded"} · {gps ? "GPS confirmed" : "no GPS signal"}
        </dd>
      </div>
    </div>
  );
}
