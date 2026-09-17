"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, Loader2, MapPin, Undo2 } from "lucide-react";
import { DECLINE_REASONS, type DeclineReason } from "@/lib/assignments";
import { formatRelativeDay, formatTime, formatVisitsPerWeek } from "@/lib/format";
import type { AssignmentRequest, Elder, Plan } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { TextLink } from "@/components/ui/text-link";

export interface AssignmentView {
  request: AssignmentRequest;
  elder: Elder;
  plan?: Plan;
}

interface AssignmentRequestsProps {
  assignments: AssignmentView[];
  /** The request just acted on, and whether the accept has been confirmed yet. */
  recent?: { id: string; confirmed: boolean };
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string, reason: string) => void;
}

export function AssignmentRequests({ assignments, recent, onAccept, onDecline }: AssignmentRequestsProps) {
  const pending = assignments.filter((a) => a.request.status === "pending");
  const answered = assignments.filter((a) => a.request.status !== "pending");

  return (
    <Card
      title="Assignment requests"
      description={pending.length > 0 ? `${pending.length} waiting for your answer` : undefined}
    >
      <div className="space-y-4">
        {pending.length === 0 && (
          <p>No new requests right now. When a family near you needs a nurse, it will appear here.</p>
        )}
        {pending.map((a) => (
          <PendingRequest key={a.request.id} assignment={a} onAccept={onAccept} onDecline={onDecline} />
        ))}
        {answered.map((a) => (
          <AnsweredRequest
            key={a.request.id}
            assignment={a}
            fresh={recent?.id === a.request.id}
            confirming={recent?.id === a.request.id && !recent.confirmed}
          />
        ))}
      </div>
    </Card>
  );
}

function PendingRequest({
  assignment: { request, elder, plan },
  onAccept,
  onDecline,
}: {
  assignment: AssignmentView;
  onAccept: AssignmentRequestsProps["onAccept"];
  onDecline: AssignmentRequestsProps["onDecline"];
}) {
  const [declining, setDeclining] = useState(false);
  const headingId = useId();

  return (
    <article aria-labelledby={headingId} className="rounded-2xl border-2 border-amber bg-amber/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip tone="amber" className="bg-surface">
          Awaiting your answer
        </Chip>
        <p className="text-small">Requested {formatRelativeDay(request.requestedAt)} at {formatTime(request.requestedAt)}</p>
      </div>

      <h3 id={headingId} className="mt-3 text-h2 font-semibold">
        {elder.name}, {elder.age}
      </h3>
      <p className="mt-1 flex items-start gap-1.5 text-small">
        <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
        {elder.address}
      </p>

      <dl className="mt-3 space-y-2 text-small">
        <div>
          <dt className="font-semibold text-navy">What the family asked for</dt>
          <dd>{elder.careNeeds}</dd>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="font-semibold text-navy">Conditions</dt>
            <dd>{elder.conditions.join(", ")}</dd>
          </div>
          {plan && (
            <div>
              <dt className="font-semibold text-navy">Plan</dt>
              <dd>
                {plan.name}, {formatVisitsPerWeek(plan.visitsPerWeek)}
              </dd>
            </div>
          )}
        </div>
      </dl>

      {declining ? (
        <DeclineForm
          clientName={elder.name}
          onCancel={() => setDeclining(false)}
          onConfirm={(reason) => onDecline(request.id, reason)}
        />
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAccept(request.id)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal px-5 font-semibold text-navy transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-teal-light sm:flex-none"
          >
            <Check aria-hidden className="size-4" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-5 font-semibold text-navy transition-colors duration-150 hover:border-navy sm:flex-none"
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );
}

function DeclineForm({
  clientName,
  onCancel,
  onConfirm,
}: {
  clientName: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const legendRef = useRef<HTMLLegendElement>(null);
  const errorId = useId();
  const noteId = useId();

  useEffect(() => legendRef.current?.focus(), []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reason) {
      setError("Choose a reason so the coordinator can find the right nurse.");
      legendRef.current?.focus();
      return;
    }
    if (reason === "Other" && !note.trim()) {
      setError("Tell the coordinator why in a few words.");
      return;
    }
    onConfirm(reason === "Other" ? note : note.trim() ? `${reason}: ${note.trim()}` : reason);
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 rounded-xl border border-line bg-surface p-4">
      <fieldset aria-describedby={error ? errorId : undefined}>
        <legend ref={legendRef} tabIndex={-1} className="font-semibold text-navy">
          Why are you declining {clientName}?
        </legend>
        <p className="text-small">
          The request goes back to the coordinator&apos;s queue and is offered to another nurse.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DECLINE_REASONS.map((option) => (
            <label
              key={option}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-navy transition-colors duration-150 ${
                reason === option ? "border-teal bg-teal-tint" : "border-line hover:border-teal"
              }`}
            >
              <input
                type="radio"
                name="decline-reason"
                value={option}
                checked={reason === option}
                onChange={() => {
                  setReason(option);
                  setError(null);
                }}
                className="size-4 accent-teal"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={noteId} className="mt-3 block text-label font-semibold text-navy">
        {reason === "Other" ? "Tell the coordinator why" : "Anything else the coordinator should know (optional)"}
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setError(null);
        }}
        rows={2}
        aria-invalid={Boolean(error && reason === "Other")}
        aria-describedby={error ? errorId : undefined}
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-navy"
      />

      {error && (
        <p id={errorId} role="alert" className="mt-2 border-l-4 border-coral pl-2 text-small font-medium text-navy">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-navy px-5 font-semibold text-white transition-colors duration-150 hover:bg-navy-mid sm:flex-none"
        >
          Decline and return to queue
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line px-5 font-semibold text-navy transition-colors duration-150 hover:border-navy sm:flex-none"
        >
          Keep request
        </button>
      </div>
    </form>
  );
}

function AnsweredRequest({
  assignment: { request, elder },
  fresh,
  confirming,
}: {
  assignment: AssignmentView;
  fresh: boolean;
  confirming: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Move focus here after the button that triggered it disappears.
  useEffect(() => {
    if (fresh) ref.current?.focus();
  }, [fresh]);

  const accepted = request.status === "accepted";

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className={`rounded-2xl border p-4 ${accepted ? "border-teal bg-teal-tint" : "border-line bg-bg"}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            accepted ? "bg-teal text-navy" : "bg-line text-navy"
          } ${fresh && !confirming ? "motion-safe:animate-tick-in" : ""}`}
        >
          {confirming ? (
            <Loader2 className="size-5 motion-safe:animate-spin" />
          ) : accepted ? (
            <Check className="size-5" strokeWidth={3} />
          ) : (
            <Undo2 className="size-5" />
          )}
        </span>
        <div className="min-w-0">
          {accepted ? (
            confirming ? (
              <p className="font-semibold text-navy">Accepting {elder.name}… confirming with the coordinator</p>
            ) : (
              <>
                <p className="font-semibold text-navy">Accepted: {elder.name} is now your client</p>
                <p className="mt-1 text-small">
                  Added to today&apos;s work and your client list. The coordinator will book the first
                  visit with the family.
                </p>
                <TextLink href={routes.nurseClient(elder.id)}>Open client record</TextLink>
              </>
            )
          ) : (
            <>
              <p className="font-semibold text-navy">Declined: {elder.name} returned to the queue</p>
              <p className="mt-1 text-small">
                The coordinator will offer this client to another nurse. Nothing else is needed from you.
              </p>
              {request.declineReason && (
                <p className="mt-2 text-small">
                  <span className="font-semibold text-navy">Your reason:</span> {request.declineReason}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
