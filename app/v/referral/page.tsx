// FR-14, FR-19, NFR-19: the referral packet for the receiving clinician. Reason and urgency are exactly as the referring
// clinician wrote them, with their source, or "Not stated by the referring clinician". Acknowledgement is not a bed statement.
import type { Metadata } from "next";
import { NoLongerValid } from "@/components/NoLongerValid";
import { PacketView } from "@/components/PacketView";
import { Notice } from "@/components/ui";
import { getReferralPacketForViewer } from "@/lib/referral/service";
import { loadViewer } from "@/lib/viewer-page";
import { AckButtons } from "./AckButtons";

export const metadata: Metadata = { title: "Referral" };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ReferralViewerPage() {
  const ctx = await loadViewer();
  if (!ctx.ok) return <NoLongerValid />;
  const view = await getReferralPacketForViewer(ctx);
  if (!view) return <NoLongerValid />;

  return (
    <div className="grid gap-6">
      <header className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Referral packet</h1>
        <p className="text-muted">Shared by the patient, open until {when(view.expires_at)}</p>
      </header>

      <div className="grid gap-2">
        <Notice tone="warn">{view.ai_notice}</Notice>
        {view.partial_notice ? <Notice>{view.partial_notice}</Notice> : null}
        <Notice>{view.recorded_notice}</Notice>
      </div>

      <PacketView packet={view.packet} audience="clinician" />

      <AckButtons
        labels={view.ack_labels}
        disclaimer={view.disclaimer}
        current={view.current_acknowledgement ? { label: view.ack_labels[view.current_acknowledgement.status as keyof typeof view.ack_labels] ?? "Acknowledged" } : null}
      />
    </div>
  );
}
