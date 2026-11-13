// C15 partner feed: the FHIR R4 Bundle SUBSET we accept (FR-26, NFR-22, Locked decision L29). PURE.
// This is not a FHIR server and does not claim FHIR compliance: it is "FHIR R4-aligned at the partner interface".
// Accepted: a Bundle of type "collection" with exactly one Patient and up to 49 Observation / ServiceRequest
// resources (at most 50 entries in all). Any other resource type is refused. Unknown fields inside accepted
// resources are stripped (Zod's default for z.object). Issues carry paths and messages only, never values.
import { z } from "zod";

export const LINK_SYSTEM = "urn:itan:link";
export const MAX_ENTRIES = 50;
export const ACCEPTED_RESOURCE_TYPES = ["Patient", "Observation", "ServiceRequest"] as const;
export const PRIORITIES = ["routine", "urgent", "asap", "stat"] as const;
const MAX_ISSUES = 20;

const text = (max = 500) => z.string().trim().min(1).max(max);

const identifierSchema = z.object({ system: text(200).optional(), value: text(200) });

const quantitySchema = z.object({ value: z.number().finite(), unit: text(50).optional() });

const patientSchema = z.object({
  resourceType: z.literal("Patient"),
  identifier: z.array(identifierSchema).min(1).max(10),
});

const observationSchema = z
  .object({
    resourceType: z.literal("Observation"),
    identifier: z.array(identifierSchema).max(5).optional(),
    code: z.object({ text: text(200) }),
    valueQuantity: quantitySchema.optional(),
    valueString: text(200).optional(),
    referenceRange: z
      .array(z.object({ text: text(100).optional(), low: quantitySchema.optional(), high: quantitySchema.optional() }))
      .max(5)
      .optional(),
    // FHIR dateTime: a full date, optionally with a time. Partial dates (year only) are refused.
    effectiveDateTime: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-]\d{2}:\d{2})?)?$/, "Expected a FHIR dateTime such as 2026-11-10 or 2026-11-10T09:30:00+01:00")
      .optional(),
  })
  .refine((o) => (o.valueQuantity === undefined) !== (o.valueString === undefined), {
    message: "Send exactly one of valueQuantity or valueString",
    path: ["value[x]"],
  });

const serviceRequestSchema = z.object({
  resourceType: z.literal("ServiceRequest"),
  identifier: z.array(identifierSchema).max(5).optional(),
  reasonCode: z.array(z.object({ text: text(500) })).max(10).optional(),
  priority: z.enum(PRIORITIES).optional(),
  requester: z.object({ display: text(200).optional() }).optional(),
});

const bundleShellSchema = z.object({
  resourceType: z.literal("Bundle"),
  type: z.literal("collection"),
  entry: z
    .array(z.object({ resource: z.object({ resourceType: z.string() }).loose() }))
    .min(1)
    .max(MAX_ENTRIES, `At most ${MAX_ENTRIES} entries per bundle`),
});

export type Identifier = z.infer<typeof identifierSchema>;
export type FhirObservation = z.infer<typeof observationSchema>;
export type FhirServiceRequest = z.infer<typeof serviceRequestSchema>;

export interface Issue {
  path: string;
  message: string;
}

export type ParsedBundle =
  | {
      ok: true;
      patient: { linkRef: string; hospitalPatientRef: string };
      observations: FhirObservation[];
      serviceRequests: FhirServiceRequest[];
    }
  | { ok: false; issues: Issue[] };

const pathOf = (prefix: (string | number)[], p: readonly PropertyKey[]) =>
  [...prefix, ...p].map((s) => (typeof s === "number" ? `[${s}]` : `.${String(s)}`)).join("").replace(/^\./, "") || "(body)";

const toIssues = (prefix: (string | number)[], err: z.ZodError): Issue[] =>
  // Zod messages name the expected shape (and at most the received TYPE); they never quote the value.
  err.issues.map((i) => ({ path: pathOf(prefix, i.path), message: i.message }));

/** "<system>|<value>" of an identifier, as stored in fact.source_identifier (L27). */
export const identifierKey = (i: Identifier) => `${i.system ?? ""}|${i.value}`;

/** Validate a decoded JSON body against the subset. Never throws. */
export function parseBundle(json: unknown): ParsedBundle {
  const shell = bundleShellSchema.safeParse(json);
  if (!shell.success) return { ok: false, issues: toIssues([], shell.error).slice(0, MAX_ISSUES) };

  const issues: Issue[] = [];
  const patients: z.infer<typeof patientSchema>[] = [];
  const observations: FhirObservation[] = [];
  const serviceRequests: FhirServiceRequest[] = [];

  shell.data.entry.forEach((e, i) => {
    const prefix = ["entry", i, "resource"];
    const type = e.resource.resourceType;
    const schema =
      type === "Patient" ? patientSchema : type === "Observation" ? observationSchema : type === "ServiceRequest" ? serviceRequestSchema : null;
    if (!schema) {
      // The type name is part of the contract, not patient data, so naming the accepted ones is safe.
      issues.push({ path: pathOf(prefix, ["resourceType"]), message: `Resource type not accepted; only ${ACCEPTED_RESOURCE_TYPES.join(", ")}` });
      return;
    }
    const r = schema.safeParse(e.resource);
    if (!r.success) {
      issues.push(...toIssues(prefix, r.error));
      return;
    }
    if (r.data.resourceType === "Patient") patients.push(r.data);
    else if (r.data.resourceType === "Observation") observations.push(r.data);
    else serviceRequests.push(r.data);
  });

  if (patients.length !== 1) issues.push({ path: "entry", message: "Exactly one Patient entry is required" });

  let linkRef = "";
  let hospitalPatientRef = "";
  if (patients.length === 1) {
    const ids = patients[0].identifier;
    const links = ids.filter((x) => x.system === LINK_SYSTEM);
    const own = ids.filter((x) => x.system !== LINK_SYSTEM);
    if (links.length !== 1) issues.push({ path: "Patient.identifier", message: `Exactly one identifier with system ${LINK_SYSTEM} is required` });
    else linkRef = links[0].value;
    if (own.length < 1) issues.push({ path: "Patient.identifier", message: "The hospital's own patient number is required as a second identifier" });
    else hospitalPatientRef = own[0].value;
  }

  if (patients.length === 1 && observations.length + serviceRequests.length === 0 && issues.length === 0) {
    issues.push({ path: "entry", message: "At least one Observation or ServiceRequest is required" });
  }

  if (issues.length) return { ok: false, issues: issues.slice(0, MAX_ISSUES) };
  return { ok: true, patient: { linkRef, hospitalPatientRef }, observations, serviceRequests };
}
