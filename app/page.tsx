import { SeedCheck } from "@/components/demo/seed-check";

// Session 1 placeholder. Replaced by the F1 landing page in Session 4.

const SWATCHES = [
  ["navy", "bg-navy"],
  ["navy-mid", "bg-navy-mid"],
  ["teal", "bg-teal"],
  ["teal-light", "bg-teal-light"],
  ["teal-tint", "bg-teal-tint"],
  ["verified", "bg-verified"],
  ["amber", "bg-amber"],
  ["coral", "bg-coral"],
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["line", "bg-line"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <p className="text-label font-semibold text-teal">Session 1 · scaffold check</p>
      <h1 className="mt-2 text-display font-bold">CareCircle NG</h1>
      <p className="mt-3 max-w-prose">
        Fonts, colour tokens, the type scale, and demo state are wired up. Screens arrive in the
        next sessions.
      </p>

      <section className="mt-10">
        <h2 className="text-h1 font-bold">Type scale</h2>
        <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface p-5">
          <p className="font-display text-display font-bold text-navy">Display 36/40</p>
          <p className="font-display text-h1 font-bold text-navy">Heading 1 28/34</p>
          <p className="font-display text-h2 font-semibold text-navy">Heading 2 20/26</p>
          <p className="text-body">Body 15/24 — Inter regular, for everything else.</p>
          <p className="text-small text-muted">Small 13/20 — secondary text.</p>
          <p className="text-label font-semibold">Label 12/16 — field labels and chips</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-h1 font-bold">Colour tokens</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([name, className]) => (
            <li key={name} className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className={`h-14 ${className}`} />
              <p className="px-3 py-2 text-label font-semibold text-navy">{name}</p>
            </li>
          ))}
        </ul>
        <span className="mt-4 inline-flex items-center rounded-full bg-verified px-3 py-1 text-label font-semibold text-white">
          NMCN verified
        </span>
      </section>

      <section className="mt-10 pb-16">
        <h2 className="text-h1 font-bold">Demo state</h2>
        <div className="mt-4">
          <SeedCheck />
        </div>
      </section>
    </main>
  );
}
