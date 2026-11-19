import { EXAMPLE_VISITS_PER_CLIENT, monthlyEarningsFor } from "@/lib/earnings";
import { formatNaira } from "@/lib/format";
import { EARNINGS_PER_VISIT_NGN, TRANSPORT_ALLOWANCE_NGN, VISIT_FEE_NGN } from "@/lib/mock-data";

const EXAMPLE_CLIENT_COUNTS = [4, 6];

/** The deck's density argument: more clients × more visits = more earning. */
export function EarningsExamples({ headingLevel: Heading = "h2" }: { headingLevel?: "h2" | "h3" }) {
  return (
    <section aria-labelledby="earnings-examples-heading">
      <Heading id="earnings-examples-heading" className="text-h2 font-semibold">
        More clients × more visits = more earning
      </Heading>
      <p className="mt-1">
        Every visit pays {formatNaira(VISIT_FEE_NGN)} plus a {formatNaira(TRANSPORT_ALLOWANCE_NGN)} transport
        allowance, {formatNaira(EARNINGS_PER_VISIT_NGN)} in all. Most clients have one visit a week, about{" "}
        {EXAMPLE_VISITS_PER_CLIENT} a month.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {EXAMPLE_CLIENT_COUNTS.map((clients) => (
          <div key={clients} className="rounded-2xl bg-surface shadow-card p-4">
            <dt className="text-small">
              {clients} clients × {EXAMPLE_VISITS_PER_CLIENT} visits a month
            </dt>
            <dd className="mt-1 font-display text-h1 font-bold tabular-nums text-navy">
              {formatNaira(monthlyEarningsFor(clients))}
              <span className="ml-1 font-sans text-small font-normal text-ink">a month</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
