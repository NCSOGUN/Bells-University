import Link from "next/link";
import { Eyebrow } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12">
      <Eyebrow>Prototype · made-up data only</Eyebrow>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">Itan</h1>
      <p className="mt-3 max-w-prose text-lg text-muted">
        A medical record the patient holds. Photograph the papers you already have, check what was read, and show a doctor a one-screen history with a code that
        expires. Itan is the Yoruba word for history: tell it once.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/sign-in" className="group rounded-lg border border-line bg-surface p-5 hover:border-accent">
          <Eyebrow>Patient</Eyebrow>
          <p className="mt-1 font-display text-xl font-semibold">Sign in to your record</p>
          <p className="mt-1 text-muted">Add documents, confirm what was read, share with a doctor.</p>
          <span className="mt-4 inline-block font-medium text-accent-ink underline underline-offset-2 group-hover:no-underline">Sign in or create an account</span>
        </Link>
        <Link href="/c" className="group rounded-lg border border-line bg-surface p-5 hover:border-accent">
          <Eyebrow>Clinician</Eyebrow>
          <p className="mt-1 font-display text-xl font-semibold">Open a shared record</p>
          <p className="mt-1 text-muted">No account and nothing to install. You need the code the patient shows you.</p>
          <span className="mt-4 inline-block font-medium text-accent-ink underline underline-offset-2 group-hover:no-underline">Enter a code</span>
        </Link>
      </div>

      <p className="mt-10 max-w-prose text-sm text-muted">
        Itan is not a diagnosis tool and is not cleared for real patients. Documents are read by an AI service that can make mistakes, so every item is checked by
        the patient before it is marked confirmed.
      </p>
    </main>
  );
}
