"use client";

import { RotateCcw } from "lucide-react";
import { useDemo } from "@/lib/demo-context";

export function ResetDemoButton() {
  const { resetDemo } = useDemo();

  return (
    <button
      type="button"
      onClick={resetDemo}
      className="fixed right-4 bottom-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-label font-semibold text-navy shadow-sm transition-colors duration-150 hover:border-teal"
    >
      <RotateCcw aria-hidden className="size-4" />
      Reset demo
    </button>
  );
}
