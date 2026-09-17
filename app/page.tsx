import Link from "next/link";
import { ClipboardCheck, HeartHandshake, MapPin, ShieldCheck, UserRoundSearch } from "lucide-react";
import { familyTermFor, formatNaira, nurseShortName } from "@/lib/format";
import { PLANS, createSeedState } from "@/lib/mock-data";
import { SERVICE_CITIES } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { completedVisits, findElder, findNurse, visitsForElder } from "@/lib/selectors";
import { ADHERENCE_LABEL } from "@/lib/vitals";
import { ButtonLink } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";

const cities = SERVICE_CITIES.join(" and ");
const lowestPrice = Math.min(...PLANS.map((p) => p.priceNGN));

const STEPS = [
  {
    icon: HeartHandshake,
    title: "Tell us about your parent",
    body: "Choose a plan and describe what they need in your own words.",
  },
  {
    icon: UserRoundSearch,
    title: "We match a verified nurse",
    body: `A licensed nurse near them in ${cities}, matched on their needs and travel time.`,
  },
  {
    icon: ClipboardCheck,
    title: "You hear after every visit",
    body: "Readings, medication and a note from the nurse arrive on WhatsApp, wherever you live.",
  },
];

/** A sample update built from the demo's seeded records, without dates. */
function sampleUpdate() {
  const state = createSeedState();
  const elder = findElder(state, state.familyAccount.elderIds[0]);
  const latest = elder && completedVisits(visitsForElder(state, elder.id)).at(-1);
  const nurse = latest && findNurse(state, latest.nurseId);
  if (!elder || !latest?.vitals || !nurse) return null;
  return {
    nurse: nurseShortName(nurse.name),
    who: familyTermFor(elder.relationship, elder.name),
    bp: latest.vitals.bloodPressure,
    medication: latest.medicationAdherence && ADHERENCE_LABEL[latest.medicationAdherence].toLowerCase(),
    note: latest.wellbeingNote,
  };
}

export default function LandingPage() {
  const sample = sampleUpdate();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <p className="font-display text-h2 font-bold text-navy">
            Care<span className="text-teal">Circle</span>
          </p>
          <Link
            href={routes.nurseLanding}
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-small font-semibold text-navy hover:bg-bg"
          >
            For nurses
          </Link>
        </div>
      </header>

      <main className="pb-24">
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-10 pb-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-teal-tint px-3 py-1 text-label font-semibold text-navy">
              <MapPin aria-hidden className="size-3.5" />
              Home nursing in {cities}
            </p>
            <h1 className="mt-4 text-display font-bold sm:text-[44px] sm:leading-[50px]">
              A trusted nurse for your parents, and news after every visit
            </h1>
            <p className="mt-4 max-w-prose text-[17px] leading-7">
              CareCircle sends a verified nurse to check on your mum or dad at home, and tells you how
              they are — even if you live far away.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={routes.familyPlans}>Get care for a loved one</ButtonLink>
              <ButtonLink href={routes.nurseLanding} variant="secondary">
                Join as a nurse
              </ButtonLink>
            </div>
            <TextLink href={routes.familyDashboard} className="mt-2 text-small">
              Skip to a live dashboard
            </TextLink>

            <p className="mt-6 flex flex-wrap items-center gap-2 text-small">
              <VerifiedBadge />
              Every nurse&apos;s licence is checked with the NMCN before their first visit.
            </p>
          </div>

          {sample && (
            <figure className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <figcaption className="flex items-center gap-2 text-small font-semibold text-navy">
                <WhatsAppMark className="size-5" />
                Example update on WhatsApp
              </figcaption>
              <blockquote className="mt-4 rounded-2xl rounded-tl-sm bg-teal-tint p-4 text-navy">
                <p>
                  {sample.nurse} has finished today&apos;s visit with {sample.who}.
                </p>
                <p className="mt-2">
                  Blood pressure <strong className="tabular-nums">{sample.bp} mmHg</strong>
                  {sample.medication && `, medication ${sample.medication}`}.
                </p>
                {sample.note && <p className="mt-2">&ldquo;{sample.note}&rdquo;</p>}
              </blockquote>
              <p className="mt-3 text-small">Sent after every visit, with the nurse&apos;s name and the time.</p>
            </figure>
          )}
        </section>

        <section aria-labelledby="how-heading" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h2 id="how-heading" className="text-h1 font-bold">
              How it works
            </h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <span className="grid size-11 place-items-center rounded-full bg-teal-tint text-navy">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-3 text-h2 font-semibold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-1">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="trust-heading" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 id="trust-heading" className="text-h1 font-bold">
            Why families trust us
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            <li className="rounded-2xl border border-line bg-surface p-5">
              <ShieldCheck aria-hidden className="size-6 text-navy" />
              <h3 className="mt-2 text-h2 font-semibold">Checked by a person</h3>
              <p className="mt-1">
                We verify every nurse&apos;s NMCN licence, ID and address before they can accept a visit.
              </p>
            </li>
            <li className="rounded-2xl border border-line bg-surface p-5">
              <MapPin aria-hidden className="size-6 text-navy" />
              <h3 className="mt-2 text-h2 font-semibold">Every visit on record</h3>
              <p className="mt-1">
                Arrival and departure times, GPS confirmation and the readings, signed by the nurse.
              </p>
            </li>
            <li className="rounded-2xl border border-line bg-surface p-5">
              <HeartHandshake aria-hidden className="size-6 text-navy" />
              <h3 className="mt-2 text-h2 font-semibold">From {formatNaira(lowestPrice)} a month</h3>
              <p className="mt-1">
                {PLANS.length} plans, from a weekly check-in to a live-in nurse. Pay in naira, or from abroad by card.
              </p>
            </li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TextLink href={routes.familyPlans}>See plans and get started</TextLink>
          </div>
        </section>
      </main>
    </div>
  );
}
