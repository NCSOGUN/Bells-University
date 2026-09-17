import { Clock, Star } from "lucide-react";
import type { Nurse } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { VerifiedBadge } from "@/components/ui/verified-badge";

interface NurseCardProps {
  nurse: Nurse;
  title?: string;
}

export function NurseCard({ nurse, title = "Your nurse" }: NurseCardProps) {
  return (
    <Card title={title}>
      <div className="flex items-start gap-4">
        <Avatar name={nurse.name} initials={nurse.initials} size="lg" />
        <div className="min-w-0 space-y-2">
          <p className="font-display text-h2 font-semibold text-navy">{nurse.name}</p>
          {nurse.verified && <VerifiedBadge />}
          <p className="text-small">
            Licence {nurse.licenceId} · {nurse.yearsExperience} years&apos; experience
          </p>
        </div>
      </div>

      <p className="mt-4">{nurse.microBio}</p>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Specialisations">
        {nurse.specializations.map((s) => (
          <li key={s} className="rounded-full bg-teal-tint px-3 py-1 text-label font-semibold text-navy">
            {s}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-small">
        <div className="flex items-center gap-2">
          <Star aria-hidden className="size-4 shrink-0 text-navy" />
          <div>
            <dt className="sr-only">Rating</dt>
            <dd>
              <span className="font-semibold text-navy">{nurse.rating.toFixed(1)}</span> out of 5 from
              families
            </dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock aria-hidden className="size-4 shrink-0 text-navy" />
          <div>
            <dt className="sr-only">Travel time</dt>
            <dd>
              Usually <span className="font-semibold text-navy">{nurse.avgTravelMinutes} min</span> away
            </dd>
          </div>
        </div>
      </dl>
    </Card>
  );
}
