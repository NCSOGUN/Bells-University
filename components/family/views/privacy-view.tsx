"use client";

import { useState, type ReactNode } from "react";
import { Download, Lock } from "lucide-react";
import { buildDataExport, requestDeletion, setPersonalisedCheck } from "@/lib/consent";
import { useDemo } from "@/lib/demo-context";
import { familyTermFor, formatLongDate, formatShortDate, formatTime, nurseShortName } from "@/lib/format";
import { routes } from "@/lib/routes";
import { findElder, findNurse } from "@/lib/selectors";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";

export function PrivacyView() {
  const { state, hydrated, update } = useDemo();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saved, setSaved] = useState("");
  if (!hydrated) return <PageSkeleton />;

  const account = state.familyAccount;
  const elder = findElder(state, account.elderIds[0]);
  const consent = elder?.consent;
  if (!elder || !consent) {
    return <RecordNotFound title="No consent record yet" message="Add a relative and agree to share their readings to see this page." />;
  }

  const term = familyTermFor(elder.relationship, elder.name);
  const nurse = findNurse(state, elder.assignedNurseId);
  const personalised = consent.choices.personalisedCheck;

  const toggle = (on: boolean) => {
    update((prev) => setPersonalisedCheck(prev, elder.id, on, account.name));
    setSaved(`Saved at ${formatTime(new Date().toISOString())}. ${on ? "The Care Check can now compare with" : "The Care Check no longer looks at"} ${term}'s earlier visits.`);
  };

  const download = () => {
    const data = buildDataExport(state, elder.id);
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${elder.name.split(" ")[0].toLowerCase()}-carecircle-data.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="space-y-6">
      <TextLink href={routes.familyDashboard} direction="back" className="-mt-2">
        Back to dashboard
      </TextLink>
      <header>
        <p className="text-small">{term}&apos;s information · {elder.name}</p>
        <h1 className="mt-1 text-display font-bold">Privacy and consent</h1>
      </header>

      <Card title={`Who can see ${term}'s readings`}>
        <ul className="list-disc space-y-1 pl-5 text-navy">
          {nurse && <li>{nurse.name}, {term}&apos;s nurse</li>}
          <li>{account.name} (you)</li>
          {account.sponsor && <li>{account.sponsor.name}, who sponsors the care plan</li>}
        </ul>
        <p className="mt-3 text-small">
          No one else can see it. At each visit we record blood pressure, pulse, temperature, weight, medicines taken, the nurse&apos;s
          notes, and when and where the visit happened.
        </p>
      </Card>

      <Card title="Your choices">
        <div className="space-y-4">
          <Row
            title={`Share ${term}'s readings with their nurse and care circle`}
            detail={`Needed for the service. Agreed by ${consent.representative.name} on ${formatLongDate(consent.givenAt)}.`}
            control={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1 text-small font-semibold text-navy">
                <Lock aria-hidden className="size-3.5" />
                Required
              </span>
            }
          />
          <Row
            title={`Compare with ${term}'s own earlier visits`}
            detail={
              personalised
                ? `On. The Care Check can spot when a reading is unusual for ${term}.`
                : `Off. The Care Check only uses general limits and doesn't look at earlier visits.`
            }
            control={
              <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-navy">
                <span>{personalised ? "On" : "Off"}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={personalised}
                  onChange={(e) => toggle(e.target.checked)}
                  className="size-6 accent-teal"
                  aria-label={`Compare with ${term}'s own earlier visits`}
                />
              </label>
            }
          />
        </div>
        <p role="status" className="mt-3 text-small font-medium text-navy">
          {saved}
        </p>
      </Card>

      <Card title={`${term}'s own consent`}>
        {consent.inPerson ? (
          <p className="text-navy">
            {elder.name.split(" ")[0]} said yes in person to {nurse ? nurseShortName(nurse.name) : "their nurse"} on{" "}
            {formatLongDate(consent.inPerson.at)}.
          </p>
        ) : (
          <p className="text-navy">
            Not recorded yet. The nurse asks {elder.name.split(" ")[0]} in person at the first visit, before taking any readings.
          </p>
        )}
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-navy">History of changes</summary>
          <ul className="space-y-1 pt-1 text-small">
            {[...consent.log].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`}>
                {formatShortDate(e.at)}, {formatTime(e.at)} · {e.by}: {e.change}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card title="Your data">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={download}>
            <Download aria-hidden className="size-4" />
            Download a copy
          </Button>
          {!consent.deletionRequestedAt && !confirmingDelete && (
            <Button variant="secondary" onClick={() => setConfirmingDelete(true)}>
              Ask us to delete {term}&apos;s data
            </Button>
          )}
        </div>
        {confirmingDelete && !consent.deletionRequestedAt && (
          <div role="alert" className="mt-4 rounded-xl border-2 border-coral bg-coral/10 p-4">
            <p className="font-semibold text-navy">
              This asks us to delete {term}&apos;s records and end the care service. Are you sure?
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  update((prev) => requestDeletion(prev, elder.id, account.name));
                  setConfirmingDelete(false);
                }}
              >
                Yes, send the request
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {consent.deletionRequestedAt && (
          <p role="status" className="mt-4 rounded-xl border-2 border-teal bg-teal-tint p-3 font-medium text-navy">
            Request sent on {formatLongDate(consent.deletionRequestedAt)}. In this demo nothing is actually deleted.
          </p>
        )}
      </Card>

      <p className="text-small">
        This is a prototype with fictional people. The consent steps are real in the screens; the secure storage behind them
        is the next step.
      </p>
    </article>
  );
}

function Row({ title, detail, control }: { title: string; detail: string; control: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
      <div className="min-w-0 flex-1 basis-60">
        <p className="font-semibold text-navy">{title}</p>
        <p className="mt-0.5 text-small">{detail}</p>
      </div>
      {control}
    </div>
  );
}
