"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, Smartphone } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { familyTermFor } from "@/lib/format";
import {
  currentSubscription,
  pushSupport,
  sendTestNotification,
  serverStatus,
  turnOffNotifications,
  turnOnNotifications,
  type ServerStatus,
} from "@/lib/push-client";
import { routes } from "@/lib/routes";
import { findElder } from "@/lib/selectors";
import { notificationText } from "@/lib/visit-update";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";

type PhoneState = "checking" | "off" | "on" | "blocked" | "unsupported" | "ios-needs-install";

/** F14: the family turns on visit notifications for the phone they're holding. */
export function AlertsView() {
  const { state, hydrated } = useDemo();
  const [phone, setPhone] = useState<PhoneState>("checking");
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    const support = pushSupport();
    const status = await serverStatus();
    setServer(status);
    if (support !== "supported") return setPhone(support);
    if (Notification.permission === "denied") return setPhone("blocked");
    setPhone((await currentSubscription()) && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    // Reads browser and server state that only exists after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  if (!hydrated) return <PageSkeleton />;

  const elder = findElder(state, state.familyAccount.elderIds[0]);
  const term = elder ? familyTermFor(elder.relationship, elder.name) : "your relative";
  const nurse = elder && state.nurses.find((n) => n.id === elder.assignedNurseId);
  const example = notificationText(term, nurse ? nurse.name.split(/\s+/)[0] : null, "green");

  const turnOn = async () => {
    setBusy(true);
    setNote("");
    const result = await turnOnNotifications();
    setBusy(false);
    if (result.ok) {
      setNote("Done. This phone will get an update after every visit.");
    } else if (result.reason === "denied") {
      setNote("Notifications were not allowed, so nothing changed.");
    } else {
      setNote(result.message ?? "That didn't work. Check this phone's internet and try again.");
    }
    void refresh();
  };

  const test = async () => {
    setBusy(true);
    const result = await sendTestNotification();
    setBusy(false);
    setNote(result.sent > 0 ? "Test sent. It should appear on this phone in a few seconds." : (result.error ?? "The test didn't send. Try again."));
  };

  const turnOff = async () => {
    setBusy(true);
    await turnOffNotifications();
    setBusy(false);
    setNote("Turned off. This phone won't get visit updates.");
    void refresh();
  };

  return (
    <article className="space-y-6">
      <TextLink href={routes.familyDashboard} direction="back" className="-mt-2">
        Back to dashboard
      </TextLink>
      <header>
        <h1 className="text-display font-bold">Visit updates on this phone</h1>
        <p className="mt-2 max-w-prose text-navy">
          When the nurse finishes a visit, this phone shows a notification straight away, even when CareCircle is
          closed. Tap it to see the visit.
        </p>
      </header>

      <Card title="What you'll see">
        <div className="rounded-[1.4rem] bg-bg p-3.5 text-navy shadow-card">
          <p className="flex items-center gap-2 text-label font-semibold text-ink">
            <Smartphone aria-hidden className="size-4" />
            CARECIRCLE · now
          </p>
          <p className="mt-1.5 font-semibold">{example.title}</p>
          <p className="mt-0.5 text-small text-navy">{example.body}</p>
        </div>
        <p className="mt-3 text-small">
          The notification says how {term} is and nothing more. Readings and the nurse&apos;s notes only
          appear once you tap it, because anyone can glance at a lock screen.
        </p>
      </Card>

      <Card title="This phone">
        <PhoneStatus phone={phone} server={server} />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row" aria-live="polite">
          {phone === "off" && (
            <Button onClick={turnOn} loading={busy} loadingText="Turning on…" disabled={server?.ready === false} className="w-full sm:w-auto">
              <BellRing aria-hidden className="size-5" />
              Turn on notifications
            </Button>
          )}
          {phone === "on" && (
            <>
              <Button onClick={test} loading={busy} loadingText="Sending…" className="w-full sm:w-auto">
                Send a test notification
              </Button>
              <Button variant="secondary" onClick={turnOff} disabled={busy} className="w-full sm:w-auto">
                <BellOff aria-hidden className="size-5" />
                Turn off
              </Button>
            </>
          )}
        </div>
        {note && (
          <p role="status" className="mt-3 text-small font-semibold text-navy">
            {note}
          </p>
        )}
      </Card>

      <p className="text-small">
        Prefer WhatsApp? Updates still arrive there too. <TextLink href={routes.familyWhatsApp}>See a WhatsApp update</TextLink>
      </p>
    </article>
  );
}

function PhoneStatus({ phone, server }: { phone: PhoneState; server: ServerStatus | null }) {
  if (phone === "checking") return <p className="text-small">Checking this phone…</p>;
  if (server && !server.ready) {
    return (
      <p className="text-navy">
        Notifications aren&apos;t available right now. {server.problem} Updates still arrive on WhatsApp and on the dashboard.
      </p>
    );
  }
  switch (phone) {
    case "on":
      return (
        <p className="flex items-center gap-2 font-semibold text-navy">
          <span aria-hidden className="size-2.5 rounded-full bg-teal" />
          On. This phone gets an update after every visit.
        </p>
      );
    case "off":
      return <p className="text-navy">Off. Your phone will ask once whether CareCircle can send notifications. Choose Allow.</p>;
    case "blocked":
      return (
        <p className="text-navy">
          Notifications are blocked for this site. In Chrome, tap the icon to the left of the web address, then
          Permissions, then Notifications, and choose Allow. Then come back to this page.
        </p>
      );
    case "ios-needs-install":
      return (
        <p className="text-navy">
          On iPhone, first add CareCircle to your Home Screen: tap Share, then Add to Home Screen. Open it from there
          and come back to this page.
        </p>
      );
    default:
      return (
        <p className="text-navy">
          This browser can&apos;t show notifications. Try Chrome on an Android phone. Updates still arrive on WhatsApp
          and on the dashboard.
        </p>
      );
  }
}
