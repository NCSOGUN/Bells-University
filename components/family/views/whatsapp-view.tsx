"use client";

import type { ReactNode } from "react";
import { Bell, CheckCheck, ClipboardCheck, DoorOpen, MapPin, MapPinOff } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { familyTermFor, formatRelativeDay, formatShortDate, formatTime, nurseShortName } from "@/lib/format";
import type { Elder, Nurse, Visit } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { followedUpVisit, completedVisits, visitsForElder } from "@/lib/selectors";
import { ADHERENCE_LABEL } from "@/lib/vitals";
import { buildFamilyThread, type ThreadMessage } from "@/lib/whatsapp";
import { CareStatusChip } from "@/components/care/care-status-chip";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";

const WHEN_WE_MESSAGE = [
  { icon: DoorOpen, title: "The nurse arrives", body: "With the time and, where there is a signal, GPS confirmation." },
  { icon: ClipboardCheck, title: "The visit is finished", body: "Readings, medication, and the nurse's note in their own words." },
  { icon: Bell, title: "A reading needs attention", body: "Straight away, with what the nurse did about it." },
];

export function WhatsAppView() {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <PageSkeleton />;

  const thread = buildFamilyThread(state);
  if (!thread) {
    return (
      <RecordNotFound
        title="No updates yet"
        message="Once a relative is added, their visit updates appear here."
        fallback={{ href: routes.familyDashboard, label: "Go to your dashboard" }}
      />
    );
  }

  const { elder, nurse, latest, messages } = thread;
  const familyTerm = familyTermFor(elder.relationship, elder.name);
  const completed = completedVisits(visitsForElder(state, elder.id));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <TextLink href={routes.familyDashboard} direction="back" className="-mt-2">
        Back to dashboard
      </TextLink>

      <header>
        <p className="text-small">The messages we send you</p>
        <h1 className="mt-1 text-display font-bold">{familyTerm}&apos;s updates on WhatsApp</h1>
        <p className="mt-2">
          After every visit we message you the readings and a note from the nurse, so you know how{" "}
          {familyTerm} is without having to ask.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      {/* Phone frame: a picture of the messages, not a working chat. */}
      <div className="mx-auto w-full max-w-sm rounded-[2rem] border-4 border-navy bg-navy p-1.5 shadow-lg shadow-navy/20">
        <div className="overflow-hidden rounded-[1.6rem] bg-bg">
          <div className="flex items-center gap-3 bg-navy px-4 pt-1 pb-3 text-white">
            <WhatsAppMark className="size-8" />
            <div className="min-w-0">
              <p className="font-semibold">CareCircle</p>
              <p className="text-small text-white/80">
                {nurse ? `${nurseShortName(nurse.name)} · ${elder.city}` : elder.city}
              </p>
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="space-y-3 p-4">
              <Bubble from="carecircle" hideTime>
                <p>
                  Updates will appear here after {familyTerm}&apos;s first visit: the readings, how they seemed,
                  and a note from the nurse.
                </p>
              </Bubble>
            </div>
          ) : (
            <ol className="space-y-3 p-3 sm:p-4">
              {messages.map((message, i) => (
                <li
                  key={message.id}
                  className="motion-safe:animate-reveal"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {showDaySeparator(messages, i) && (
                    <p className="mb-3 text-center">
                      <span className="rounded-full bg-surface px-3 py-1 text-label font-semibold text-ink capitalize">
                        {formatRelativeDay(message.at).replace(/^on /, "")}
                      </span>
                    </p>
                  )}
                  <Message
                    message={message}
                    elder={elder}
                    nurse={nurse}
                    familyTerm={familyTerm}
                    completed={completed}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <section aria-labelledby="when-heading" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="when-heading" className="text-h2 font-semibold">
            When we message you
          </h2>
          <ul className="mt-3 space-y-3">
            {WHEN_WE_MESSAGE.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-tint text-navy">
                  <Icon aria-hidden className="size-4" />
                </span>
                <div>
                  <p className="font-semibold text-navy">{title}</p>
                  <p className="text-small">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-small">
          {latest
            ? `The last update went out after ${familyTerm}'s visit on ${formatShortDate(latest.scheduledAt)}.`
            : "Updates start after the first visit."}{" "}
          No WhatsApp signal? Everything is on your dashboard too.
        </p>
        <TextLink href={routes.familyDashboard}>Open {familyTerm}&apos;s dashboard</TextLink>
      </div>
      </div>
    </div>
  );
}

function showDaySeparator(messages: ThreadMessage[], index: number): boolean {
  if (index === 0) return true;
  return formatShortDate(messages[index - 1].at) !== formatShortDate(messages[index].at);
}

interface MessageProps {
  message: ThreadMessage;
  elder: Elder;
  nurse?: Nurse;
  familyTerm: string;
  completed: Visit[];
}

function Message({ message, elder, nurse, familyTerm, completed }: MessageProps) {
  const visit = message.visit;
  const nurseName = nurse ? nurseShortName(nurse.name) : "Your nurse";

  if (message.kind === "arrival" && visit) {
    return (
      <Bubble from="carecircle" at={message.at}>
        <p>
          {nurseName} has arrived for {familyTerm}&apos;s visit.
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-small">
          {visit.gpsConfirmed ? (
            <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <MapPinOff aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          )}
          {visit.gpsConfirmed
            ? `Arrival confirmed at ${visit.gpsAddress ?? elder.address}`
            : "Arrival recorded without a location this time"}
        </p>
      </Bubble>
    );
  }

  if (message.kind === "summary" && visit) {
    const followedUp = followedUpVisit(completed, visit.id);
    return (
      <Bubble from="carecircle" at={message.at}>
        <CareStatusChip status={elder.careStatus} />
        <p className="mt-2 font-semibold text-navy">{familyTerm}&apos;s visit is done.</p>
        <p className="mt-1">
          <span className="font-semibold text-navy">Where things stand: </span>
          {elder.careStatusMessage}
        </p>
        {visit.vitals && (
          <p className="mt-2">
            Blood pressure {visit.vitals.bloodPressure} mmHg, pulse {visit.vitals.pulse} bpm, temperature{" "}
            {visit.vitals.temperature.toFixed(1)} °C.
          </p>
        )}
        {visit.medicationAdherence && (
          <p className="mt-1">Medication: {ADHERENCE_LABEL[visit.medicationAdherence].toLowerCase()}.</p>
        )}
        {visit.flagged && visit.flagReason && (
          <p className="mt-2 border-l-4 border-coral pl-2 font-medium text-navy">{visit.flagReason}</p>
        )}
        {followedUp?.vitals && (
          <p className="mt-2 text-small">
            This visit rechecked the higher reading of {followedUp.vitals.bloodPressure} mmHg from{" "}
            {formatShortDate(followedUp.scheduledAt)}.
          </p>
        )}
        {visit.nurseNotes && <p className="mt-2">&ldquo;{visit.nurseNotes}&rdquo;</p>}
        <p className="mt-2 text-small">
          Recorded by {nurseName}
          {visit.checkOutAt && ` at ${formatTime(visit.checkOutAt)}`}.
        </p>
      </Bubble>
    );
  }

  if (message.kind === "next" && visit) {
    return (
      <Bubble from="carecircle" at={message.at}>
        <p>
          {familyTerm}&apos;s next visit is {formatRelativeDay(visit.scheduledAt)} at{" "}
          {formatTime(visit.scheduledAt)}. We&apos;ll message you when {nurseName} arrives.
        </p>
      </Bubble>
    );
  }

  return (
    <Bubble from="family" at={message.at}>
      <p>Thank you. Please tell {familyTerm} we&apos;ll call this evening.</p>
    </Bubble>
  );
}

function Bubble({
  from,
  at,
  hideTime,
  children,
}: {
  from: "carecircle" | "family";
  at?: string;
  hideTime?: boolean;
  children: ReactNode;
}) {
  const fromFamily = from === "family";
  return (
    <div className={`flex ${fromFamily ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3 py-2 text-small text-navy ${
          fromFamily ? "rounded-br-sm bg-teal-tint" : "rounded-tl-sm bg-surface"
        }`}
      >
        {children}
        {!hideTime && at && (
          <p className={`mt-1 flex items-center justify-end gap-1 text-label ${fromFamily ? "text-ink" : "text-muted"}`}>
            {formatTime(at)}
            {fromFamily && <CheckCheck aria-hidden className="size-3.5 text-teal" />}
          </p>
        )}
      </div>
    </div>
  );
}
