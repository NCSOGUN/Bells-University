import type { DemoState, Elder, ElderConsent } from "./mock-data";

// Consent is kept per relative, because the person whose health data is used
// (the elder) is not always the person who signed up (a family member). Two
// kinds: sharing readings with their nurse and care circle (required for the
// service), and letting the Care Check compare today's readings with their
// own earlier visits (optional; off means fixed limits only).

/** Without a record, nothing optional is assumed. Privacy by default. */
export function personalisedCheckAllowed(elder: Elder | undefined): boolean {
  return elder?.consent?.choices.personalisedCheck === true;
}

export function inPersonConsentRecorded(elder: Elder | undefined): boolean {
  return Boolean(elder?.consent?.inPerson);
}

function withConsent(state: DemoState, elderId: string, change: (c: ElderConsent) => ElderConsent): DemoState {
  return {
    ...state,
    elders: state.elders.map((e) => (e.id === elderId && e.consent ? { ...e, consent: change(e.consent) } : e)),
  };
}

/** A family member turns the personalised Care Check on or off. Logged with who and when. */
export function setPersonalisedCheck(state: DemoState, elderId: string, on: boolean, by: string): DemoState {
  return withConsent(state, elderId, (c) => {
    if (c.choices.personalisedCheck === on) return c;
    return {
      ...c,
      choices: { ...c.choices, personalisedCheck: on },
      log: [
        ...c.log,
        {
          at: new Date().toISOString(),
          by,
          change: on ? "Allowed the personalised Care Check" : "Turned off the personalised Care Check",
        },
      ],
    };
  });
}

/** The nurse records that the elder themself said yes, in person. */
export function recordInPersonConsent(state: DemoState, elderId: string, nurseId: string): DemoState {
  const elder = state.elders.find((e) => e.id === elderId);
  const nurse = state.nurses.find((n) => n.id === nurseId);
  if (!elder || !nurse) return state;
  const first = elder.name.split(" ")[0];
  return withConsent(state, elderId, (c) => {
    if (c.inPerson) return c;
    const at = new Date().toISOString();
    return {
      ...c,
      inPerson: { at, nurseId },
      log: [...c.log, { at, by: `Nurse ${nurse.name.split(" ")[0]}`, change: `Recorded that ${first} agreed in person` }],
    };
  });
}

/** Records a request to delete the relative's data. Nothing is deleted in the demo. */
export function requestDeletion(state: DemoState, elderId: string, by: string): DemoState {
  return withConsent(state, elderId, (c) => {
    if (c.deletionRequestedAt) return c;
    const at = new Date().toISOString();
    return { ...c, deletionRequestedAt: at, log: [...c.log, { at, by, change: "Asked for their data to be deleted" }] };
  });
}

/** Everything held about one relative, for the "download a copy" button. */
export function buildDataExport(state: DemoState, elderId: string) {
  const elder = state.elders.find((e) => e.id === elderId);
  if (!elder) return null;
  return {
    exportedAt: new Date().toISOString(),
    note: "Fictional demo data.",
    relative: {
      name: elder.name,
      age: elder.age,
      city: elder.city,
      address: elder.address,
      conditions: elder.conditions,
      medications: elder.medications,
    },
    consent: elder.consent,
    visits: state.visits
      .filter((v) => v.elderId === elderId && v.status === "complete")
      .map((v) => ({
        date: v.checkOutAt ?? v.scheduledAt,
        vitals: v.vitals,
        medication: v.medicationAdherence,
        nurseNotes: v.nurseNotes,
        careCheck: v.careCheck && {
          modelVersion: v.careCheck.modelVersion,
          suggested: v.careCheck.suggestedStatus,
          decidedStatus: v.careCheck.decision.finalStatus,
          reasons: v.careCheck.findings.map((f) => f.reason),
        },
      })),
  };
}
