import type { Metadata } from "next";
import { CalendarCheck, HeartHandshake, ShieldCheck, UserRoundCheck } from "lucide-react";
import { SERVICE_CITIES } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { EarningsExamples } from "@/components/nurse/earnings-examples";

export const metadata: Metadata = { title: "Join as a nurse · CareCircle NG" };

const cities = SERVICE_CITIES.join(" and ");

const STEPS = [
  { icon: UserRoundCheck, title: "Apply with your NMCN licence", body: "Your details and licence number. It takes a few minutes." },
  { icon: ShieldCheck, title: "A person checks your documents", body: "Licence, ID and proof of address, reviewed by our team." },
  { icon: CalendarCheck, title: "Set when and where you work", body: "Choose your specialisms, how far you'll travel and your free times." },
  { icon: HeartHandshake, title: "Care for the same people each week", body: `Regular clients near you in ${cities}, not one-off jobs.` },
];

export default function NurseLandingPage() {
  return (
    <div className="space-y-12">
      <section className="max-w-2xl">
        <h1 className="text-display font-bold sm:text-[44px] sm:leading-[50px]">
          Your nursing skill, respected and paid for every visit
        </h1>
        <p className="mt-4 text-[17px] leading-7">
          CareCircle matches NMCN-licensed nurses with older people who need regular care at home in {cities}.
          You build real relationships with the same clients, and families see the difference you make.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={routes.nurseSignup}>Join as a nurse</ButtonLink>
          <ButtonLink href={routes.nurseEarnings} variant="secondary">
            See earnings
          </ButtonLink>
        </div>
        <TextLink href={routes.nurseDashboard} className="mt-2 text-small">
          Already a CareCircle nurse? Go to today&apos;s visits
        </TextLink>
      </section>

      <EarningsExamples />

      <section aria-labelledby="nurse-steps-heading">
        <h2 id="nurse-steps-heading" className="text-h2 font-semibold">
          How joining works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-tint text-navy">
                <Icon aria-hidden className="size-5" />
              </span>
              <div>
                <h3 className="font-sans text-body font-semibold text-navy">
                  <span className="sr-only">Step {i + 1}: </span>
                  {title}
                </h3>
                <p className="mt-0.5 text-small">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
