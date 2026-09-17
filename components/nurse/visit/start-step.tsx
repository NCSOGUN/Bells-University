"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, MapPin, MapPinOff, RotateCw } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { firstName, formatShortDate, formatTime, nurseShortName } from "@/lib/format";
import { routes } from "@/lib/routes";
import { completedVisits, visitsForElder } from "@/lib/selectors";
import { checkIn, type GpsState } from "@/lib/visit-flow";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CareStatusChip } from "../care-status-chip";
import { VisitFrame, type VisitContext } from "./visit-frame";

// Long enough to read "Confirming your location…", short enough not to drag.
const GPS_MS = 1500;

export function StartVisitStep({ visitId }: { visitId: string }) {
  return (
    <VisitFrame visitId={visitId} step="Check in">
      {(ctx) => <StartVisit {...ctx} />}
    </VisitFrame>
  );
}

function StartVisit({ state, visit, elder }: VisitContext) {
  if (visit.status === "in_progress") {
    return (
      <Card title="Visit in progress">
        <p>
          You checked in at {visit.checkInAt ? formatTime(visit.checkInAt) : "the start of the visit"}
          {visit.gpsConfirmed ? " with GPS confirmed." : ", without a GPS fix."}
        </p>
        <ButtonLink href={routes.nurseVisitChecklist(visit.id)} className="mt-4 w-full">
          Continue the checklist
        </ButtonLink>
      </Card>
    );
  }
  if (visit.status === "complete") {
    return (
      <Card title="This visit is complete">
        <p>
          Checked out at {visit.checkOutAt ? formatTime(visit.checkOutAt) : "the end of the visit"}.
        </p>
        <ButtonLink href={routes.nurseVisitComplete(visit.id)} className="mt-4 w-full">
          See the visit summary
        </ButtonLink>
      </Card>
    );
  }

  const previous = completedVisits(visitsForElder(state, elder.id)).at(-1);

  return (
    <>
      <LastVisitNote state={state} elderId={elder.id} previous={previous} />
      <CheckIn visitId={visit.id} address={elder.address} />
    </>
  );
}

/** The "nurse already knows" moment: what the last visit left for this one. */
function LastVisitNote({
  state,
  elderId,
  previous,
}: {
  state: VisitContext["state"];
  elderId: string;
  previous?: VisitContext["visit"];
}) {
  const elder = state.elders.find((e) => e.id === elderId);
  if (!elder) return null;
  const author = previous && state.nurses.find((n) => n.id === previous.nurseId);

  return (
    <section aria-labelledby="before-heading" className="rounded-2xl border-2 border-navy bg-surface p-5">
      <h2 id="before-heading" className="text-h2 font-semibold">
        Before you go in
      </h2>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <CareStatusChip status={elder.careStatus} />
        <p className="min-w-0 flex-1 basis-56 text-navy">{elder.careStatusMessage}</p>
      </div>

      {previous ? (
        <div className={`mt-4 rounded-xl border-l-4 p-3 ${previous.flagged ? "border-coral bg-coral/10" : "border-teal bg-teal-tint"}`}>
          <p className="text-small font-semibold text-navy">
            From the last visit, {formatShortDate(previous.scheduledAt)}
            {author && ` · ${nurseShortName(author.name)}`}
            {previous.flagged && " · Flagged"}
          </p>
          {previous.flagReason && <p className="mt-1 font-medium text-navy">{previous.flagReason}</p>}
          {previous.nurseNotes && <p className="mt-1 text-navy">&ldquo;{previous.nurseNotes}&rdquo;</p>}
          {previous.vitals && (
            <p className="mt-1 text-small">Blood pressure then: {previous.vitals.bloodPressure} mmHg</p>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border-l-4 border-teal bg-teal-tint p-3">
          <p className="text-small font-semibold text-navy">First visit with {firstName(elder.name)}</p>
          <p className="mt-1 text-navy">
            No earlier notes yet. The family asked for: &ldquo;{elder.careNeeds}&rdquo;
          </p>
        </div>
      )}

      <dl className="mt-4 grid gap-3 text-small sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-navy">Conditions</dt>
          <dd>{elder.conditions.join(", ")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-navy">Medication</dt>
          <dd>{elder.medications.join("; ")}</dd>
        </div>
      </dl>
    </section>
  );
}

type GpsView = "locating" | GpsState;

function CheckIn({ visitId, address }: { visitId: string; address: string }) {
  const { update } = useDemo();
  const router = useRouter();
  const [gps, setGps] = useState<GpsView>("locating");
  const [noSignal, setNoSignal] = useState(false);

  useEffect(() => {
    if (gps !== "locating") return;
    const id = window.setTimeout(() => setGps(noSignal ? "unavailable" : "confirmed"), GPS_MS);
    return () => window.clearTimeout(id);
  }, [gps, noSignal]);

  const start = () => {
    if (gps === "locating") return;
    update((prev) => checkIn(prev, visitId, gps, address));
    router.push(routes.nurseVisitChecklist(visitId));
  };

  return (
    <section aria-labelledby="gps-heading" className="space-y-4">
      <div
        className={`rounded-2xl border-2 p-5 ${
          gps === "confirmed" ? "border-teal bg-teal-tint" : gps === "unavailable" ? "border-amber bg-amber/10" : "border-line bg-surface"
        }`}
      >
        <h2 id="gps-heading" className="sr-only">
          Location check-in
        </h2>
        <div className="flex items-start gap-4">
          <span className="relative grid size-12 shrink-0 place-items-center">
            {gps === "locating" && (
              <span aria-hidden className="absolute inset-0 rounded-full bg-teal/40 motion-safe:animate-ping" />
            )}
            <span
              className={`relative grid size-12 place-items-center rounded-full ${
                gps === "unavailable" ? "bg-amber" : "bg-teal"
              } text-navy`}
            >
              {gps === "unavailable" ? <MapPinOff aria-hidden className="size-6" /> : <MapPin aria-hidden className="size-6" />}
            </span>
          </span>
          <div role="status" className="min-w-0">
            {gps === "locating" && (
              <>
                <p className="font-semibold text-navy">Confirming your location…</p>
                <p className="mt-1 text-small">Checking you&apos;re at {address}</p>
              </>
            )}
            {gps === "confirmed" && (
              <>
                <p className="font-semibold text-navy">You&apos;re at the right address</p>
                <p className="mt-1 text-small">GPS confirmed: {address}</p>
              </>
            )}
            {gps === "unavailable" && (
              <>
                <p className="font-semibold text-navy">GPS is unavailable</p>
                <p className="mt-1 text-small text-navy">
                  You can still start. The visit will be recorded without a location, and the family&apos;s update
                  will say so.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          {gps === "locating" ? (
            <button
              type="button"
              onClick={() => setGps(noSignal ? "unavailable" : "confirmed")}
              className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4"
            >
              Skip
            </button>
          ) : (
            gps === "unavailable" && (
              <button
                type="button"
                onClick={() => setGps("locating")}
                className="inline-flex min-h-11 items-center gap-1.5 px-2 text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4"
              >
                <RotateCw aria-hidden className="size-4" />
                Try again
              </button>
            )
          )}
        </div>
      </div>

      <Button onClick={start} disabled={gps === "locating"} className="w-full">
        Start visit &amp; check in
      </Button>

      <div className="rounded-2xl border-2 border-dashed border-muted bg-bg p-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="flex items-center gap-2 text-small font-semibold text-navy">
              <FlaskConical aria-hidden className="size-4" />
              Demo control: simulate no GPS signal
            </span>
            <span className="block text-small">Shows what happens inside a building with no signal.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={noSignal}
            onChange={(e) => {
              setNoSignal(e.target.checked);
              setGps("locating");
            }}
            className="size-6 shrink-0 accent-teal"
          />
        </label>
      </div>
    </section>
  );
}
