import type { FamilyAccount, Sponsor } from "@/lib/mock-data";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

interface FamilyCircleCardProps {
  account: FamilyAccount;
  /** How the account holder relates to this person, e.g. "Daughter". */
  relationship: string;
  sponsor?: Sponsor;
  familyTerm: string;
}

export function FamilyCircleCard({ account, relationship, sponsor, familyTerm }: FamilyCircleCardProps) {
  return (
    <Card title={`${familyTerm}'s care circle`}>
      <ul className="space-y-4">
        <li className="flex items-center gap-3">
          <Avatar name={account.name} tone="navy" />
          <div>
            <p className="font-semibold text-navy">{account.name} (you)</p>
            <p className="text-small">
              {relationship} · Arranges {familyTerm}&apos;s care
            </p>
          </div>
        </li>
        {sponsor ? (
          <li className="flex items-center gap-3">
            <Avatar name={sponsor.name} tone="teal" />
            <div>
              <p className="font-semibold text-navy">{sponsor.name}</p>
              <p className="text-small">
                {sponsor.relationship} in {sponsor.city} · Sponsors the care plan
              </p>
            </div>
          </li>
        ) : (
          <li className="text-small">
            Family abroad can join as a sponsor and help pay for {familyTerm}&apos;s care.
          </li>
        )}
      </ul>
    </Card>
  );
}

/** Overlapping avatars for the page header: requester, then sponsor. */
export function FamilyAvatars({ account }: { account: FamilyAccount }) {
  const label = account.sponsor
    ? `${account.name} and ${account.sponsor.name} are in this care circle`
    : `${account.name} is in this care circle`;

  return (
    <div className="flex -space-x-1" role="img" aria-label={label}>
      <Avatar name={account.name} size="sm" className="ring-2 ring-bg" />
      {account.sponsor && (
        <Avatar name={account.sponsor.name} size="sm" tone="teal" className="ring-2 ring-bg" />
      )}
    </div>
  );
}
