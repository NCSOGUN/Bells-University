import { initialsOf } from "@/lib/format";

type AvatarSize = "sm" | "md" | "lg";
type AvatarTone = "navy" | "teal";

const SIZES: Record<AvatarSize, string> = {
  sm: "size-9 text-label",
  md: "size-11 text-small",
  lg: "size-14 text-body",
};

const TONES: Record<AvatarTone, string> = {
  navy: "bg-navy text-white",
  teal: "bg-teal-tint text-navy",
};

interface AvatarProps {
  name: string;
  initials?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
}

/** Decorative: the name is always shown as text alongside it. */
export function Avatar({ name, initials, size = "md", tone = "navy", className = "" }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${SIZES[size]} ${TONES[tone]} ${className}`}
    >
      {initials ?? initialsOf(name)}
    </span>
  );
}
