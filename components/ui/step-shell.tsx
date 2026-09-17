"use client";

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { TextLink } from "./text-link";

interface StepShellProps {
  steps: readonly string[];
  current: number;
  progressLabel: string;
  back: { href: string; label: string };
  onStartOver: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Frame for a multi-step flow: where you are, how to go back, a way to start again. */
export function StepShell({
  steps,
  current,
  progressLabel,
  back,
  onStartOver,
  title,
  description,
  children,
}: StepShellProps) {
  const { hydrated } = useDemo();

  return (
    <div className="mx-auto max-w-xl">
      <div className="-mt-2 flex items-center justify-between gap-3">
        <TextLink href={back.href} direction="back">
          {back.label}
        </TextLink>
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-small font-semibold text-navy transition-colors duration-150 hover:bg-surface"
        >
          <RotateCcw aria-hidden className="size-4" />
          Start over
        </button>
      </div>

      <nav aria-label={progressLabel} className="mt-4">
        <p className="text-small font-medium text-navy">
          Step {current + 1} of {steps.length}: {steps[current]}
        </p>
        <ol className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((label, i) => (
            <li key={label} aria-current={i === current ? "step" : undefined}>
              <span
                aria-hidden
                className={`block h-1.5 rounded-full transition-colors duration-150 ${
                  i < current ? "bg-teal" : i === current ? "bg-navy" : "bg-line"
                }`}
              />
              <span className="sr-only">
                {label}
                {i < current ? " (done)" : i === current ? " (current)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="text-h1 font-bold sm:text-display">{title}</h1>
        {description && <p className="mt-2">{description}</p>}
      </header>

      <div className="mt-6">
        {hydrated ? (
          children
        ) : (
          <div role="status" aria-label="Loading" className="space-y-3">
            <div className="h-24 rounded-2xl bg-line/70" />
            <div className="h-24 rounded-2xl bg-line/70" />
            <div className="h-12 rounded-xl bg-line/70" />
          </div>
        )}
      </div>
    </div>
  );
}
