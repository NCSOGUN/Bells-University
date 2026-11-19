import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import {
  ClipboardCheck,
  Clock,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";
import { CARE_STATUS_COPY } from "@/lib/care-status";
import { EXAMPLE_VISITS_PER_CLIENT, monthlyEarningsFor } from "@/lib/earnings";
import { formatNaira, planFrequency, nurseShortName } from "@/lib/format";
import { PLANS, createSeedState } from "@/lib/mock-data";
import { SERVICE_CITIES } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { findElder, findNurse } from "@/lib/selectors";
import { CareStatusChip } from "@/components/care/care-status-chip";
import { ButtonLink } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";
import heroPhoto from "@/public/images/hero-nurse-visit.jpg";

const cities = SERVICE_CITIES.join(" and ");
const cheapest = PLANS.reduce((a, b) => (b.priceNGN < a.priceNGN ? b : a));

/** Only the nurse's name comes from the seed; the rest of the example is copy. */
function exampleNurseName(): string {
  const state = createSeedState();
  const elder = findElder(state, state.familyAccount.elderIds[0]);
  const nurse = elder && findNurse(state, elder.assignedNurseId);
  return nurse ? nurseShortName(nurse.name) : "Your nurse";
}

const STEPS = [
  {
    icon: HeartHandshake,
    title: "Tell us about them",
    body: "Choose a plan and describe what your mum or dad needs, in your own words. No forms full of medical jargon.",
  },
  {
    icon: UserRoundSearch,
    title: "We match a verified nurse",
    body: `A licensed nurse near them in ${cities}, matched on their needs and how far they have to travel.`,
  },
  {
    icon: ClipboardCheck,
    title: "You hear after every visit",
    body: "The readings, whether medication was taken, and a note from the nurse, sent to you on WhatsApp.",
  },
];

export default function LandingPage() {
  const nurse = exampleNurseName();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Brand />
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="#how-it-works"
              className="hidden min-h-11 items-center rounded-xl px-3 font-semibold text-navy hover:bg-bg sm:inline-flex"
            >
              How it works
            </Link>
            <Link
              href={routes.nurseLanding}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-small font-semibold text-navy hover:bg-bg sm:text-body"
            >
              For nurses
            </Link>
            <ButtonLink href={routes.familySignup} className="px-4 text-small sm:text-body">
              Get care
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 -right-24 size-[34rem] rounded-full bg-teal-tint blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-20">
            <div className="lg:order-2">
              <div className="relative">
                <div className="relative aspect-[8/7] overflow-hidden rounded-[2rem] bg-teal-tint shadow-xl shadow-navy/10 sm:aspect-[3/2] lg:aspect-[7/8]">
                  <Image
                    src={heroPhoto}
                    alt="A smiling nurse in blue scrubs rests her hand on the shoulder of an older woman, who laughs with her."
                    fill
                    priority
                    placeholder="blur"
                    sizes="(min-width: 1024px) 520px, (min-width: 640px) 90vw, 100vw"
                    className="object-cover object-[25%_30%] lg:object-[20%_40%]"
                  />
                </div>

                <p className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-label font-semibold text-navy shadow-md shadow-navy/10 backdrop-blur">
                  <MapPin aria-hidden className="size-3.5" />
                  Arrival confirmed, 9:02 am
                </p>

                <div className="relative mx-3 -mt-20 rounded-2xl bg-surface shadow-card p-4 shadow-xl shadow-navy/10 sm:mx-auto sm:max-w-sm lg:absolute lg:-bottom-6 lg:-left-10 lg:mx-0 lg:mt-0 lg:w-72">
                  <p className="flex items-center gap-2 text-label font-semibold text-navy">
                    <WhatsAppMark className="size-4" />
                    Example update on WhatsApp
                  </p>
                  {/* §4.3: the parts of the message arrive 150ms apart, like a real one. */}
                  <div className="mt-2 rounded-xl rounded-tl-sm bg-teal-tint p-3 text-small text-navy motion-safe:animate-reveal">
                    <span className="block motion-safe:animate-reveal [animation-delay:150ms]">
                      <CareStatusChip status="green" />
                    </span>
                    <p className="mt-2 motion-safe:animate-reveal [animation-delay:300ms]">
                      {nurse} has finished today&apos;s visit with Mum. Her blood pressure and pulse are in her
                      usual range, and she&apos;s taken her medication.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:order-1">
              {/* One quiet entrance on the hero only, not section by section. */}
              <h1 className="text-display font-bold motion-safe:animate-reveal sm:text-[46px] sm:leading-[52px]">
                Someone checks on your parents. You hear about it the same day.
              </h1>
              <p className="mt-4 max-w-prose text-[17px] leading-7 motion-safe:animate-reveal [animation-delay:80ms]">
                CareCircle sends a verified nurse to your mum or dad at home in {cities}, then tells you how
                they are, what was recorded, and when the next visit is. Wherever you live.
              </p>

              <div className="mt-7 flex flex-col gap-3 motion-safe:animate-reveal [animation-delay:160ms] sm:flex-row">
                <ButtonLink href={routes.familySignup}>Get care for a loved one</ButtonLink>
                <ButtonLink href="#how-it-works" variant="secondary">
                  See how it works
                </ButtonLink>
              </div>

              <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 text-small motion-safe:animate-reveal [animation-delay:240ms]">
                <li>
                  <VerifiedBadge />
                </li>
                <li className="flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 text-navy" />
                  {cities}
                </li>
                <li className="flex items-center gap-1.5">
                  <Clock aria-hidden className="size-4 text-navy" />
                  From {formatNaira(cheapest.priceNGN)} a month
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-label="What CareCircle promises" className="bg-navy text-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-6">
            <Promise icon={ShieldCheck} title="Checked by a person">
              Every nurse&apos;s NMCN licence, ID and address is verified before their first visit.
            </Promise>
            <Promise icon={MapPin} title="Every visit on record">
              Arrival and departure times, GPS confirmation, and the readings, signed by the nurse.
            </Promise>
            <Promise mark title="Told, not asked">
              You get the update after each visit. No chasing, no wondering how it went.
            </Promise>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="max-w-2xl text-h1 font-bold sm:text-display">Three steps, then it runs itself</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-tint text-navy">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span aria-hidden className="font-display text-h1 font-bold text-line">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 text-h2 font-semibold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-2 max-w-sm">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="dashboard-heading" className="border-y border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
            <div>
              <h2 id="dashboard-heading" className="text-h1 font-bold sm:text-display">
                Your dashboard answers one question
              </h2>
              <p className="mt-4 max-w-prose text-[17px] leading-7">
                Not a wall of charts. A sentence that says how your parent is, when they were last checked, and
                who checked them. The detail is one tap deeper when you want it.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Blood pressure, pulse and temperature from every visit",
                  "The nurse's own note, in their words",
                  "A reading flagged the moment it looks off, and the follow-up when it's rechecked",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ClipboardCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-navy" />
                    {item}
                  </li>
                ))}
              </ul>
              <TextLink href={routes.familyDashboard} className="mt-6">
                Look around a live dashboard
              </TextLink>
            </div>

            <figure className="rounded-3xl border-2 border-amber bg-amber/10 p-6 sm:p-8">
              <figcaption className="text-small font-medium text-navy">Is Dad okay?</figcaption>
              <p className="mt-2 font-display text-h1 font-bold text-navy">
                {CARE_STATUS_COPY.yellow.headline("Dad")}
              </p>
              <p className="mt-4">
                <CareStatusChip status="yellow" label={CARE_STATUS_COPY.yellow.label} />
              </p>
              <p className="mt-3 text-h2 font-medium text-navy">
                Blood pressure was higher than usual at the last visit. {nurse} is checking again this visit.
              </p>
              <p className="mt-3 text-small">Recorded at the visit, by the nurse who was there.</p>
            </figure>
          </div>
        </section>

        <section aria-labelledby="nurses-heading" className="bg-teal-tint">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 id="nurses-heading" className="text-h1 font-bold">
                Are you an NMCN-licensed nurse?
              </h2>
              <p className="mt-2">
                Regular clients near you, {formatNaira(monthlyEarningsFor(4))} a month from four clients at{" "}
                {EXAMPLE_VISITS_PER_CLIENT} visits each, and the same people week after week rather than
                one-off jobs.
              </p>
            </div>
            <ButtonLink href={routes.nurseLanding} variant="secondary" className="shrink-0">
              Join as a nurse
            </ButtonLink>
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
            <h2 className="text-h1 font-bold sm:text-display">Start with one visit a week</h2>
            <p className="mx-auto mt-3 max-w-xl">
              {cheapest.name} is {formatNaira(cheapest.priceNGN)} a month for{" "}
              {planFrequency(cheapest)}. Tell us about your parent, choose a plan, and
              we&apos;ll match a nurse near them.
            </p>
            <div className="mt-6 flex justify-center">
              <ButtonLink href={routes.familySignup}>Get care for a loved one</ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-bg">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div>
            <Brand />
            <p className="mt-2 text-small">Home nursing for older people in {cities}.</p>
          </div>
          <FooterLinks
            title="For families"
            links={[
              { href: routes.familyPlans, label: "Plans and pricing" },
              { href: routes.familyDashboard, label: "Family dashboard" },
              { href: routes.familyWhatsApp, label: "WhatsApp updates" },
            ]}
          />
          <FooterLinks
            title="For nurses"
            links={[
              { href: routes.nurseLanding, label: "Join as a nurse" },
              { href: routes.nurseEarnings, label: "How earnings work" },
              { href: routes.nurseDashboard, label: "Nurse dashboard" },
            ]}
          />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <p className="border-t border-line pt-6 text-small">
            A working demo. No payments are taken, no messages are sent, and every name and reading is sample
            data. Use the Demo button to jump between screens.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Promise({
  icon: Icon,
  mark,
  title,
  children,
}: {
  icon?: LucideIcon;
  /** Use the WhatsApp mark instead of a lucide icon. */
  mark?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10">
        {mark ? <WhatsAppMark className="size-5" /> : Icon && <Icon aria-hidden className="size-5" />}
      </span>
      <div>
        <h3 className="font-sans text-body font-semibold text-white">{title}</h3>
        <p className="mt-1 text-small text-white/80">{children}</p>
      </div>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-sans text-label font-semibold text-navy">{title}</h2>
      <ul className="mt-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center text-small text-navy underline decoration-line decoration-2 underline-offset-4 hover:decoration-teal"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
