"use client";
// NFR-03: before the first capture the person can state three facts: an AI service reads the document, where it is
// processed, and what is kept. The wording must match the Google tier actually in use (docs/limitations.md section 4).
import { useState } from "react";
import { Button, Card, ErrorBox, Eyebrow, Spinner } from "@/components/ui";
import { describeError, postJson } from "@/lib/client-api";

/** TEAM DECISION: set to "paid" ONLY when the demo runs on a billed Google Cloud project. "free" is the cautious default:
 *  on the free tier Google may use the content to improve its products and people at Google may read it. */
const GOOGLE_TIER: "paid" | "free" = "free";

export function ConsentCard({ onAccepted }: { onAccepted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/consent");
      onAccepted();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl p-6">
      <Eyebrow>Before your first document</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">How Itan reads your documents</h1>
      <dl className="mt-5 grid gap-4">
        <div>
          <dt className="font-semibold">An AI service reads them</dt>
          <dd className="text-muted">
            Your photo is sent to Google&rsquo;s Gemini service, which reads the text into fields. Google may process it in any country. It can make mistakes, which is why you
            check every item before it counts as confirmed.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">What is kept</dt>
          <dd className="text-muted">
            Your photos and the facts read from them stay in your record, stored in London, UK, until you delete them. Google may keep a copy for a limited time to prevent
            abuse.{" "}
            {GOOGLE_TIER === "paid"
              ? "On our paid Google account, Google does not use it to improve its products."
              : "Google may use it to improve its products, and people at Google may read it. Use made-up documents only."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Nothing is shared unless you share it</dt>
          <dd className="text-muted">You choose who sees what, and for how long. You can end access at any moment and see who looked.</dd>
        </div>
        <div>
          <dt className="font-semibold">This is a prototype</dt>
          <dd className="text-muted">Use made-up documents only. Itan is not cleared for real patients.</dd>
        </div>
      </dl>
      {error ? (
        <div className="mt-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      ) : null}
      <div className="mt-6">
        <Button onClick={accept} disabled={busy}>
          {busy ? <Spinner>Saving</Spinner> : "I understand, continue"}
        </Button>
      </div>
    </Card>
  );
}
