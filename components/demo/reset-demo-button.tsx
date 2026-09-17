"use client";

import { RotateCcw } from "lucide-react";
import { useDemo } from "@/lib/demo-context";

/**
 * Puts the demo back to the seeded data. Deliberately quiet: a small icon in
 * the corner that only names itself on hover or focus, so it stays out of the
 * way of the screens themselves.
 */
export function ResetDemoButton() {
  const { resetDemo } = useDemo();

  return (
    <button
      type="button"
      onClick={resetDemo}
      title="Reset demo"
      className="group fixed right-3 bottom-3 z-50 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line/70 bg-surface/80 px-3 text-label font-semibold text-muted opacity-60 backdrop-blur transition-[opacity,color,border-color] duration-150 hover:border-line hover:text-navy hover:opacity-100 focus-visible:opacity-100 sm:min-h-9"
    >
      <RotateCcw aria-hidden className="size-3.5" />
      <span className="sr-only group-hover:not-sr-only group-focus-visible:not-sr-only">Reset demo</span>
    </button>
  );
}
