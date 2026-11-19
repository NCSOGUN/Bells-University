import { NURSE_CARE_STATUS_LABEL } from "@/lib/care-status";
import { formatTime, nurseShortName } from "@/lib/format";
import type { Nurse, Visit } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";

/** What the family sees about how a visit's readings were checked, and who decided. */
export function CareCheckNote({ visit, nurse }: { visit: Visit; nurse?: Nurse }) {
  const check = visit.careCheck;
  if (!check) return null;
  const { decision } = check;
  const who = nurse ? nurseShortName(nurse.name) : "The nurse";
  const reasons = check.findings.filter((f) => f.severity !== "info");

  return (
    <Card title="How these readings were checked">
      <p>
        We compared this visit&apos;s readings with {check.baseline ? "their usual and " : ""}with general limits.{" "}
        {reasons.length === 0 ? "Nothing stood out." : "Here is what stood out:"}
      </p>
      {reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-navy">
          {reasons.map((f) => (
            <li key={f.ruleId}>{f.reason}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 font-medium text-navy">
        {who} reviewed this at {formatTime(decision.decidedAt)} and recorded it as{" "}
        {NURSE_CARE_STATUS_LABEL[decision.finalStatus].toLowerCase()}.
        {decision.outcome === "adjusted" && decision.reason && ` Their note: ${decision.reason}`}
      </p>
      <p className="mt-2 text-small">
        The check is rule-based decision support, not a diagnosis, and a nurse always has the final say. If you are worried,
        call us or your doctor.
      </p>
    </Card>
  );
}

/** Dashboard explainer: how we keep watch, with no numbers that could drift from the rules. */
export function HowWeKeepWatch() {
  return (
    <Card title="How we keep watch">
      <ul className="list-disc space-y-1 pl-5">
        <li>At each visit the nurse records blood pressure, pulse, temperature and medication.</li>
        <li>We compare the readings with your relative&apos;s own earlier visits, not just a textbook number.</li>
        <li>If something looks different, the nurse decides what it means and how to follow up.</li>
      </ul>
      <p className="mt-3 text-small">
        These are transparent clinical rules that compare each reading with your relative&apos;s own history. They support the
        nurse and explain themselves. They don&apos;t diagnose, and they never replace medical advice.
      </p>
      <TextLink href={routes.familyPrivacy} className="mt-1">
        Privacy and consent
      </TextLink>
    </Card>
  );
}
