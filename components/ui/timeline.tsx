import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

// Structure adapted from 21st.dev's Timeline (preetsuthar17): a status-coloured
// rail, a node per item and free content beside it. Rebuilt without cva/Radix
// and re-themed to §4.1. The node icon and the item's own chip carry the
// meaning, so colour is never the only signal.

export type TimelineTone = "done" | "flagged" | "followUp" | "current" | "upcoming";

const TONES: Record<TimelineTone, { node: string; rail: string; icon: LucideIcon }> = {
  done: { node: "border-teal bg-teal-tint text-navy", rail: "border-teal-light", icon: Check },
  flagged: { node: "border-coral bg-coral text-navy", rail: "border-coral", icon: AlertTriangle },
  followUp: { node: "border-teal bg-teal text-navy", rail: "border-teal-light", icon: RotateCcw },
  current: { node: "border-navy bg-navy text-white", rail: "border-line border-dashed", icon: ArrowRight },
  upcoming: { node: "border-line bg-surface text-ink", rail: "border-line border-dashed", icon: Circle },
};

export interface TimelineItem {
  id: string;
  tone: TimelineTone;
  /** Overrides the tone's default icon. */
  icon?: LucideIcon;
  content: ReactNode;
  className?: string;
}

interface TimelineProps {
  items: TimelineItem[];
  label: string;
  className?: string;
}

export function Timeline({ items, label, className = "" }: TimelineProps) {
  return (
    <ol aria-label={label} className={className}>
      {items.map((item, index) => {
        const tone = TONES[item.tone];
        const Icon = item.icon ?? tone.icon;
        const last = index === items.length - 1;
        return (
          <li key={item.id} className={`relative flex gap-3 sm:gap-4 ${last ? "" : "pb-5"} ${item.className ?? ""}`}>
            {!last && (
              <span
                aria-hidden
                className={`absolute top-9 bottom-1 left-[15px] border-l-2 ${tone.rail}`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 ${tone.node}`}
            >
              <Icon className="size-4" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">{item.content}</div>
          </li>
        );
      })}
    </ol>
  );
}
