"use client";
// The moment a share code exists: the code is large, mono and shown once; the QR is an <img> data URI (never inline SVG
// markup, so a Content-Security-Policy can be added later, S-16); the screen speaks to the doctor as well as the patient.
import { Button, Card, Eyebrow, Notice } from "@/components/ui";

const qrSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ShareResult({
  share,
  onRevoke,
  onDone,
}: {
  share: { share_id: string; code: string; qr_svg: string; expires_at: string };
  onRevoke: (id: string) => void;
  onDone: () => void;
}) {
  return (
    <>
      <Card className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc(share.qr_svg)} alt="QR code for the doctor to scan" className="h-44 w-44 rounded-md border border-line bg-white p-2" />
        <div className="min-w-0">
          <Eyebrow>Code</Eyebrow>
          <p className="printed mt-1 text-5xl font-medium tracking-[0.12em]" aria-label={`Code ${share.code.split("").join(" ")}`}>
            {share.code}
          </p>
          <p className="mt-3 text-muted">
            Ends <span className="font-medium text-ink">{when(share.expires_at)}</span>
          </p>
        </div>
      </Card>
      <div className="mt-4 grid gap-3">
        <Notice tone="accent" title="For the doctor">
          Point your phone camera at the QR code. Or open <span className="printed">{typeof window !== "undefined" ? window.location.host : ""}/c</span> on any phone or computer and type the
          code. You will be asked for your name and practice number.
        </Notice>
        <Notice tone="warn">This code is shown once. If you lose it, make a new one.</Notice>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="danger" onClick={() => onRevoke(share.share_id)}>
          End access now
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
