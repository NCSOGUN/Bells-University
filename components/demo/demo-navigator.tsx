"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Play, RotateCcw, SquareDashedMousePointer, X } from "lucide-react";
import { prepareReading, type DemoReading } from "@/lib/demo-scenarios";
import { useDemo } from "@/lib/demo-context";
import { DEMO_NURSE_ID, type DemoState } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { completedVisits, todaysVisits, visitsForElder } from "@/lib/selectors";

interface Screen {
  code: string;
  label: string;
  href: string;
}

/** Every screen, using the real routes and ids from demo state. */
function screens(state: DemoState): { family: Screen[]; nurse: Screen[] } {
  const elderId = state.familyAccount.elderIds[0] ?? "";
  const visits = visitsForElder(state, elderId);
  const completed = completedVisits(visits);
  // The flagged visit is the one worth showing on F10.
  const visitId = (completed.findLast((v) => v.flagged) ?? completed.at(-1) ?? visits[0])?.id ?? "";
  const today = todaysVisits(state, DEMO_NURSE_ID);
  const workVisitId = (today.find((v) => v.state !== "complete") ?? today.at(-1))?.visit.id ?? "";

  return {
    family: [
      { code: "F1", label: "Landing", href: routes.home },
      { code: "F2", label: "Choose a plan", href: routes.familyPlans },
      { code: "F3", label: "Sign up and code", href: routes.familySignup },
      { code: "F4", label: "Add a relative", href: routes.familyRelative },
      { code: "F5", label: "Matching", href: routes.familyMatching },
      { code: "F6", label: "Payment", href: routes.familyPayment },
      { code: "F7", label: "Confirmation", href: routes.familyConfirmed },
      { code: "F8", label: "Family dashboard", href: routes.familyDashboard },
      { code: "F9", label: "Profile and trend", href: routes.familyElder(elderId) },
      { code: "F10", label: "Flagged visit", href: routes.familyVisit(visitId) },
      { code: "F11", label: "WhatsApp updates", href: routes.familyWhatsApp },
      { code: "F12", label: "Privacy and consent", href: routes.familyPrivacy },
    ],
    nurse: [
      { code: "N1", label: "Join as a nurse", href: routes.nurseLanding },
      { code: "N2", label: "Apply", href: routes.nurseSignup },
      { code: "N3", label: "Documents", href: routes.nurseDocuments },
      { code: "N4", label: "Verification", href: routes.nursePending },
      { code: "N5", label: "Profile", href: routes.nurseProfile },
      { code: "N6", label: "Today's visits", href: routes.nurseDashboard },
      { code: "N7", label: "Clients", href: routes.nurseClients },
      { code: "N8", label: "Client record", href: routes.nurseClient(elderId) },
      { code: "N9", label: "Check in", href: routes.nurseVisitStart(workVisitId) },
      { code: "N10", label: "Checklist", href: routes.nurseVisitChecklist(workVisitId) },
      { code: "N11", label: "Check out", href: routes.nurseVisitComplete(workVisitId) },
      { code: "N12", label: "Earnings", href: routes.nurseEarnings },
    ],
  };
}

/**
 * A judge's way around the demo: every screen in one list, plus the reset.
 * Deliberately not styled like the product, and collapsed until asked for.
 */
export function DemoNavigator() {
  const { state, update, resetDemo } = useDemo();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const { family, nurse } = screens(state);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="fixed right-3 bottom-3 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-dashed border-muted bg-surface/90 px-4 font-mono text-label font-semibold text-ink backdrop-blur transition-colors duration-150 hover:border-navy hover:text-navy"
      >
        <SquareDashedMousePointer aria-hidden className="size-4" />
        Demo
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label="Demo navigator"
          className="fixed inset-x-2 bottom-2 z-50 max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border-2 border-dashed border-muted bg-surface p-4 shadow-xl shadow-navy/20 sm:inset-x-auto sm:right-3 sm:bottom-16 sm:max-h-[75vh] sm:w-[28rem]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-label font-semibold text-ink">Demo navigator</p>
              <p className="mt-0.5 text-small">Jump to any screen. Not part of the product.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="-mt-1 -mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors duration-150 hover:bg-bg hover:text-navy"
            >
              <X aria-hidden className="size-5" />
              <span className="sr-only">Close demo navigator</span>
            </button>
          </div>

          <JosephFlow
            state={state}
            onReset={() => {
              resetDemo();
              setOpen(false);
              router.push(routes.nurseDashboard);
            }}
            onFill={(visitId, reading) => {
              update((prev) => prepareReading(prev, visitId, reading));
              setOpen(false);
              router.push(routes.nurseVisitChecklist(visitId));
            }}
            onNavigate={() => setOpen(false)}
          />

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Group title="Family" screens={family} pathname={pathname} onNavigate={() => setOpen(false)} />
            <Group title="Nurse" screens={nurse} pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => {
                resetDemo();
                setOpen(false);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 font-semibold text-navy transition-colors duration-150 hover:border-navy"
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset demo
            </button>
            <p className="mt-1 text-small">Clears what you have done here and puts the seeded data back.</p>
          </div>
        </div>
      )}
    </>
  );
}

function Group({
  title,
  screens,
  pathname,
  onNavigate,
}: {
  title: string;
  screens: Screen[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <section aria-labelledby={`nav-${title}`}>
      <h2 id={`nav-${title}`} className="font-mono text-label font-semibold text-ink">
        {title}
      </h2>
      <ul className="mt-1">
        {screens.map((screen) => {
          const current = pathname === screen.href;
          return (
            <li key={screen.code}>
              <Link
                href={screen.href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-2 text-small transition-colors duration-150 hover:bg-bg ${
                  current ? "bg-bg font-semibold text-navy" : "text-navy"
                }`}
              >
                <span className="w-8 shrink-0 font-mono text-label text-ink">{screen.code}</span>
                {screen.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The Care Check story in order, for trying it end to end. */
function JosephFlow({
  state,
  onReset,
  onFill,
  onNavigate,
}: {
  state: DemoState;
  onReset: () => void;
  onFill: (visitId: string, reading: DemoReading) => void;
  onNavigate: () => void;
}) {
  const elderId = state.familyAccount.elderIds[0] ?? "";
  const first = state.elders.find((e) => e.id === elderId)?.name.split(" ")[0] ?? "Joseph";
  const visit = todaysVisits(state, DEMO_NURSE_ID).find((t) => t.visit.elderId === elderId)?.visit;
  const completed = completedVisits(visitsForElder(state, elderId));
  const latest = completed.at(-1);
  const done = visit?.status === "complete";

  const link = "flex min-h-11 items-center rounded-lg px-2 text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4 hover:bg-bg";
  const button =
    "inline-flex min-h-11 items-center justify-center rounded-xl border border-navy px-3 text-small font-semibold text-navy transition-colors duration-150 hover:bg-bg disabled:cursor-not-allowed disabled:border-line disabled:text-muted";

  return (
    <section aria-labelledby="nav-flow" className="mt-3 rounded-xl border border-teal bg-teal-tint p-3">
      <h2 id="nav-flow" className="flex items-center gap-2 font-mono text-label font-semibold text-navy">
        <Play aria-hidden className="size-3.5" />
        Test the Care Check: {first}&apos;s flow
      </h2>
      <ol className="mt-2 space-y-2 text-small text-navy">
        <li>
          <span className="font-semibold">1. Start clean.</span> Reset the demo and go to today&apos;s visits.
          <div className="mt-1">
            <button type="button" onClick={onReset} className={button}>
              Reset and start
            </button>
          </div>
        </li>
        <li>
          <span className="font-semibold">2. Nurse checks {first} in</span> (or skip: step 3 does it for you).
          {visit && (
            <Link href={routes.nurseVisitStart(visit.id)} onClick={onNavigate} className={link}>
              Open check-in
            </Link>
          )}
        </li>
        <li>
          <span className="font-semibold">3. Fill the checklist</span>, then confirm the Care Check and submit.
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" disabled={!visit || done} onClick={() => visit && onFill(visit.id, "flagged")} className={button}>
              Higher reading: 148/92, pulse 88
            </button>
            <button type="button" disabled={!visit || done} onClick={() => visit && onFill(visit.id, "normal")} className={button}>
              Normal reading
            </button>
          </div>
          {done && <p className="mt-1">This visit is already submitted. Use Reset and start to run it again.</p>}
        </li>
        <li>
          <span className="font-semibold">4. See what the family sees.</span>
          <div className="flex flex-col">
            <Link href={routes.familyDashboard} onClick={onNavigate} className={link}>
              Family dashboard (status and reason)
            </Link>
            {latest && (
              <Link href={routes.familyVisit(latest.id)} onClick={onNavigate} className={link}>
                Latest visit record (how it was checked)
              </Link>
            )}
            <Link href={routes.familyWhatsApp} onClick={onNavigate} className={link}>
              WhatsApp update
            </Link>
          </div>
        </li>
      </ol>
    </section>
  );
}
