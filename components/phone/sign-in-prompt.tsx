"use client";

import { useState, type FormEvent } from "react";
import { formatPhone } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";

/**
 * The step between a notification and the health details behind it. Shared by
 * the real phone (after tapping a push notification) and the laptop's phone screen.
 */
export function SignInPrompt({
  accountName,
  phone,
  onSignedIn,
}: {
  accountName: string;
  phone: string;
  onSignedIn: () => void;
}) {
  const [code, setCode] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 6) onSignedIn();
  };

  return (
    <div>
      <svg aria-hidden viewBox="0 0 32 32" className="size-12">
        <circle cx="16" cy="16" r="12" fill="none" stroke="#0d7a73" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="62 14" transform="rotate(-50 16 16)" />
        <circle cx="16" cy="16" r="4.2" fill="#0a2e45" />
      </svg>
      <h1 className="mt-6 text-[26px] leading-tight">Sign in to see the details</h1>
      <p className="mt-2 text-small">
        For {accountName}&apos;s privacy, health details stay behind sign-in. We sent a 6-digit code to{" "}
        <span className="font-semibold text-navy">{formatPhone(phone)}</span> on WhatsApp.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block font-semibold text-navy" htmlFor="sign-in-code">
          Code
        </label>
        <input
          id="sign-in-code"
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
    </div>
  );
}
