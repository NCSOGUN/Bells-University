"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Wifi } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatPhone } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { subscribeUpdates } from "@/lib/update-channel";
import { applyVisitUpdate, type VisitUpdate } from "@/lib/visit-update";
import { Button } from "@/components/ui/button";

const LAGOS = "Africa/Lagos";
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-GB", { timeZone: LAGOS, weekday: "long", day: "numeric", month: "long" });

type Screen = "locked" | "signin";

/**
 * The family's phone, for the second laptop in the demo. It waits on the lock
 * screen; when the nurse submits a visit, a notification slides in showing
 * only the status. Tapping it asks the family member to sign in before any
 * health details are shown.
 */
export function PhoneView() {
  const { state, update } = useDemo();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [incoming, setIncoming] = useState<VisitUpdate | null>(null);
  const [screen, setScreen] = useState<Screen>("locked");
  const [code, setCode] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(
    () =>
      subscribeUpdates((u) => {
        // The record arrives with the notification but stays behind sign-in.
        update((prev) => applyVisitUpdate(prev, u));
        setIncoming(u);
        setScreen("locked");
      }),
    [update],
  );

  const signIn = (e: FormEvent) => {
    e.preventDefault();
    if (!incoming || code.length !== 6) return;
    router.push(routes.familyVisit(incoming.visit.id));
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#e9edf1] px-4 py-6">
      {/* Scales to the window's height so it fits beside the nurse screen on a laptop. */}
      <div className="relative aspect-[380/780] h-[min(780px,calc(100dvh-5rem))] overflow-hidden rounded-[3.2rem] border-[10px] border-[#0b1c28] bg-[#0b1c28] shadow-[0_30px_80px_rgb(10_46_69/0.35)]">
        <div aria-hidden className="absolute top-2.5 left-1/2 z-20 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />

        {screen === "locked" ? (
          <div className="relative h-full bg-[radial-gradient(120%_80%_at_20%_0%,#1ba9a0_0%,#0d7a73_30%,#0a2e45_75%)] px-4 text-white">
            <div className="flex justify-between px-5 pt-3.5 text-[13px] font-semibold">
              <span>{clock.format(now)}</span>
              <Wifi className="size-3.5" aria-hidden />
            </div>
            <div className="mt-14 text-center">
              <Lock aria-hidden className="mx-auto size-4 opacity-80" />
              <p className="mt-2 text-[15px] font-medium opacity-90">{day.format(now)}</p>
              <p className="text-[84px] leading-none font-semibold tracking-tight">{clock.format(now)}</p>
            </div>

            <div className="mt-10" aria-live="polite">
              {incoming ? (
                <button
                  type="button"
                  onClick={() => setScreen("signin")}
                  className="block w-full rounded-[1.4rem] bg-white/85 p-3.5 text-left text-navy shadow-lg backdrop-blur-xl motion-safe:animate-[notify-in_420ms_cubic-bezier(0.2,0.9,0.3,1.2)_both]"
                >
                  <span className="flex items-center gap-2 text-[12px] font-semibold text-ink">
                    <svg aria-hidden viewBox="0 0 32 32" className="size-5 rounded-md bg-white p-0.5">
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#0d7a73" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="62 14" transform="rotate(-50 16 16)" />
                      <circle cx="16" cy="16" r="4.4" fill="#0a2e45" />
                    </svg>
                    CARECIRCLE
                    <span className="ml-auto font-normal">now</span>
                  </span>
                  <span className="mt-1.5 block text-[15px] font-semibold">{incoming.title}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug">{incoming.body}</span>
                </button>
              ) : (
                <p className="text-center text-[13px] opacity-70">No new notifications</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col bg-surface px-6 pt-16">
            <svg aria-hidden viewBox="0 0 32 32" className="size-12">
              <circle cx="16" cy="16" r="12" fill="none" stroke="#0d7a73" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="62 14" transform="rotate(-50 16 16)" />
              <circle cx="16" cy="16" r="4.2" fill="#0a2e45" />
            </svg>
            <h1 className="mt-6 text-[26px] leading-tight">Sign in to see the details</h1>
            <p className="mt-2 text-small">
              For {state.familyAccount.name}&apos;s privacy, health details stay behind sign-in. We sent a 6-digit code to{" "}
              <span className="font-semibold text-navy">{formatPhone(state.familyAccount.phone)}</span> on WhatsApp.
            </p>
            <form onSubmit={signIn} className="mt-6 space-y-4">
              <label className="block font-semibold text-navy" htmlFor="phone-code">
                Code
              </label>
              <input
                id="phone-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="block min-h-14 w-full rounded-2xl bg-bg px-4 text-center text-[24px] tracking-[0.5em] text-navy shadow-card"
                placeholder="••••••"
              />
              <Button type="submit" disabled={code.length !== 6} className="w-full">
                Sign in
              </Button>
              <p className="text-center text-label text-ink">Demo: any 6 digits work.</p>
            </form>
            <button type="button" onClick={() => setScreen("locked")} className="mt-auto mb-8 min-h-11 text-small font-semibold text-teal-deep">
              Back to lock screen
            </button>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-small text-ink" role="status">
        <span aria-hidden className="size-2 rounded-full bg-teal" />
        {incoming ? "Update received." : "Waiting for the nurse to submit a visit in the other window."}
      </p>
    </div>
  );
}
