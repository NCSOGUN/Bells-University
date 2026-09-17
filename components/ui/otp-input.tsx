"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

// Behaviour adapted from 21st.dev's OTP Input (ddoemonn): one cell per digit,
// typing and paste fill forward, arrows/Home/End move, Backspace steps back.
// Rebuilt as a controlled component without its motion dependency and
// re-themed to §4.1.

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length: number;
  label: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, length, label, invalid, describedBy, disabled }: OtpInputProps) {
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusAt = (index: number) => {
    const el = cells.current[Math.max(0, Math.min(length - 1, index))];
    el?.focus();
    el?.select();
  };

  const fillFrom = (index: number, digits: string) => {
    const next = [...chars];
    let cursor = index;
    for (const d of digits) {
      if (cursor >= length) break;
      next[cursor++] = d;
    }
    onChange(next.join(""));
    focusAt(cursor);
  };

  const clearAt = (index: number) => {
    // Digits after a cleared cell shift left so the code stays contiguous.
    const next = chars.filter((_, i) => i !== index);
    onChange(next.join(""));
  };

  const onKeyDown = (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      focusAt(moves[e.key]);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[index]) {
        clearAt(index);
      } else if (index > 0) {
        clearAt(index - 1);
        focusAt(index - 1);
      }
    }
  };

  const onPaste = (index: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (digits) fillFrom(digits.length >= length ? 0 : index, digits);
  };

  return (
    <div role="group" aria-label={label} aria-describedby={describedBy} className="flex gap-2">
      {chars.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          value={char}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`${label}, digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onFocus={(e) => {
            // Always type into the first empty cell.
            const firstEmpty = chars.findIndex((c) => c === "");
            if (firstEmpty !== -1 && firstEmpty < i) focusAt(firstEmpty);
            else e.currentTarget.select();
          }}
          onChange={(e) => {
            const digits = e.currentTarget.value.replace(/\D/g, "");
            if (!digits) return;
            // Typing over a filled cell: keep only the new digit(s).
            fillFrom(i, char && digits.length > 1 && digits.startsWith(char) ? digits.slice(1) : digits);
          }}
          onKeyDown={onKeyDown(i)}
          onPaste={onPaste(i)}
          className={`size-12 min-w-0 rounded-xl border-2 bg-surface text-center font-display text-h2 font-semibold text-navy tabular-nums transition-colors duration-150 focus-visible:border-teal focus-visible:outline-offset-0 sm:size-14 ${
            i === Math.floor(length / 2) ? "ml-2 sm:ml-3" : ""
          } ${invalid ? "border-coral" : char ? "border-navy" : "border-muted"}`}
        />
      ))}
    </div>
  );
}
