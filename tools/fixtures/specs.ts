// Synthetic demo documents for Prep B and the demo (P1, freeze item 12). PURE: data and HTML builders only.
// Each fixture is defined ONCE; the document and its answer key are both generated from the same rows, so they
// cannot disagree. EVERYTHING here is invented: no real patient, hospital, laboratory, clinician or phone number
// (hard rule 8). Every page carries the footer "SYNTHETIC DEMO DATA, not a real patient".
import type { FixtureKey, KeyItem } from "./key-schema";

export const FOOTER = "SYNTHETIC DEMO DATA, not a real patient";

export type Render =
  | { kind: "pdf" }
  | {
      kind: "photo";
      /** Degrees. Phone photos are never perfectly square on. */
      rotate: number;
      /** Horizontal shear in degrees (a perspective-free skew). */
      skew: number;
      /** Gaussian blur sigma on top of the usual slight camera softness. */
      blur: number;
      /** Which edge the uneven lighting darkens. */
      shade: "left" | "right" | "bottom";
      /** Noise amplitude 0..255 (how far a pixel can darken). */
      noise: number;
      seed: number;
    };

export interface FixtureSpec {
  id: string;
  /** What this fixture tests. */
  tests: string;
  render: Render;
  html: string;
  key: FixtureKey;
}

// ---------------------------------------------------------------- items

interface LabRow {
  label: string;
  value: string;
  unit: string;
  /** null = the range column is blank on the page. */
  range: string | null;
}

const labKey = (r: LabRow, readable = true): KeyItem => ({
  kind: "lab",
  label: r.label,
  value: readable ? r.value : null,
  unit: readable ? r.unit : null,
  range: readable ? r.range : null,
  readable,
  critical: true,
});

// ---------------------------------------------------------------- HTML

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;font-size:14px;line-height:1.35}
.page{width:800px;min-height:1050px;padding:44px 48px 70px;position:relative;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d3b5f;padding-bottom:12px;margin-bottom:16px}
.fac{font-size:22px;font-weight:700;color:#1d3b5f}
.sub{font-size:12px;color:#444}
.title{font-size:17px;font-weight:700;margin:14px 0 8px;letter-spacing:.5px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:13px;margin-bottom:14px}
table{width:100%;border-collapse:collapse;margin-top:6px}
th{background:#e9eef4;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.4px}
th,td{border:1px solid #9aa7b5;padding:8px 10px}
td.v{font-weight:700}
.note{margin-top:16px;font-size:12px;color:#333}
.line{margin:10px 0}
.big{font-size:15px}
.syn{position:absolute;right:16px;bottom:14px;font-size:10px;color:#555;border:1px solid #999;padding:2px 6px}
.letter p{margin:12px 0}
.sig{margin-top:36px}
.portal .head{border-bottom:none;background:#0b6b5d;color:#fff;padding:16px 18px;margin:-44px -48px 18px}
.portal .fac{color:#fff}
.portal .sub{color:#d7efe9}
.portal th{background:#d7efe9}
`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const doc = (pages: string[], style: "print" | "portal" = "print") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SYNTHETIC document</title><style>${CSS}</style></head>` +
  `<body class="${style}">${pages.map((p) => `<section class="page">${p}<div class="syn">${FOOTER}</div></section>`).join("")}</body></html>`;

const header = (facility: string, address: string, right: string) =>
  `<div class="head"><div><div class="fac">${esc(facility)}</div><div class="sub">${esc(address)}</div></div><div class="sub" style="text-align:right">${right}</div></div>`;

const labTable = (rows: LabRow[]) =>
  `<table><thead><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference range</th></tr></thead><tbody>` +
  rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="v">${esc(r.value)}</td><td>${esc(r.unit)}</td><td>${r.range === null ? "" : esc(r.range)}</td></tr>`).join("") +
  `</tbody></table>`;

interface LabDoc {
  facility: string;
  address: string;
  title: string;
  date: string;
  labNo: string;
  rows: LabRow[];
  style?: "print" | "portal";
  note?: string;
}

const labPage = (d: LabDoc, extra = "") =>
  header(d.facility, d.address, `Lab no: ${d.labNo}<br>Date: ${d.date}`) +
  `<div class="title">${esc(d.title)}</div>` +
  `<div class="meta"><div>Patient: Demo Patient (SYNTHETIC)</div><div>Age / sex: 45 / F</div><div>Patient ID: DEMO-00123</div><div>Requested by: Dr Demo Physician (SYNTHETIC)</div></div>` +
  labTable(d.rows) +
  (d.note ? `<div class="note">${esc(d.note)}</div>` : "") +
  extra;

const LAB = "Sample Diagnostics Laboratory";
const LAB_ADDR = "Plot 0, Example Road, Demo Town (fictional address)";

const fbcRows: LabRow[] = [
  { label: "Haemoglobin", value: "9.8", unit: "g/dL", range: "12.0 - 16.0" },
  { label: "White Blood Cell Count", value: "6.2", unit: "10^9/L", range: "4.0 - 11.0" },
  { label: "Platelets", value: "245", unit: "10^9/L", range: "150 - 400" },
  { label: "PCV", value: "30", unit: "%", range: "36 - 46" },
];

const chemRows: LabRow[] = [
  { label: "Fasting Glucose", value: "5.2", unit: "mmol/L", range: "3.9 - 5.5" },
  { label: "Creatinine", value: "88", unit: "µmol/L", range: "45 - 90" },
  { label: "Urea", value: "4.8", unit: "mmol/L", range: "2.5 - 7.1" },
  { label: "Sodium", value: "139", unit: "mmol/L", range: "135 - 145" },
  { label: "Potassium", value: "4.1", unit: "mmol/L", range: "3.5 - 5.1" },
];

const hba1c = (value: string): LabRow[] => [{ label: "HbA1c", value, unit: "%", range: "4.0 - 5.6" }];

const unusualRows: LabRow[] = [
  { label: "Haemoglobin", value: "98", unit: "g/L", range: "120 - 160" },
  { label: "Fasting Glucose", value: "5.8", unit: "mmol/L", range: "3.0 - 6.0" },
];

const noRangeRows: LabRow[] = [
  { label: "Haemoglobin", value: "13.1", unit: "g/dL", range: null },
  { label: "Creatinine", value: "79", unit: "µmol/L", range: null },
  { label: "Fasting Glucose", value: "5.0", unit: "mmol/L", range: null },
];

const blurRows: LabRow[] = [
  { label: "Fasting Glucose", value: "6.9", unit: "mmol/L", range: "3.9 - 5.5" },
  { label: "Creatinine", value: "120", unit: "µmol/L", range: "45 - 90" },
  { label: "Urea", value: "9.1", unit: "mmol/L", range: "2.5 - 7.1" },
];

const mixedP1: LabRow[] = [
  { label: "Haemoglobin", value: "12.4", unit: "g/dL", range: "12.0 - 16.0" },
  { label: "White Blood Cell Count", value: "7.1", unit: "10^9/L", range: "4.0 - 11.0" },
  { label: "Platelets", value: "310", unit: "10^9/L", range: "150 - 400" },
];
const mixedP2: LabRow[] = [
  { label: "Fasting Glucose", value: "6.4", unit: "mmol/L", range: "3.9 - 5.5" },
  { label: "Creatinine", value: "91", unit: "µmol/L", range: "45 - 90" },
  { label: "Sodium", value: "141", unit: "mmol/L", range: "135 - 145" },
];

// ---------------------------------------------------------------- prescription and referral letter

const MEDS = [
  { label: "Metformin 500 mg", value: "1 tablet twice daily" },
  { label: "Amlodipine 5 mg", value: "1 tablet once daily" },
  { label: "Paracetamol 500 mg", value: "1-2 tablets every 6 hours when needed" },
];

const rxHtml = doc([
  header("Demo General Hospital (SIMULATED)", "Outpatient Department (fictional)", "Date: 12/11/2026<br>Rx no: DEMO-RX-0042") +
    `<div class="title">PRESCRIPTION</div>` +
    `<div class="meta"><div>Patient: Demo Patient (SYNTHETIC)</div><div>Age / sex: 45 / F</div><div>Patient ID: DEMO-00123</div><div></div></div>` +
    `<div class="line big"><b>Allergy: Penicillin</b></div>` +
    `<table><thead><tr><th>Medicine</th><th>Dose and frequency</th></tr></thead><tbody>` +
    MEDS.map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(m.value)}</td></tr>`).join("") +
    `</tbody></table>` +
    `<div class="sig">Prescriber: Dr Demo Physician (SYNTHETIC)</div>`,
]);

const REFERRAL = {
  reason: "Rising creatinine over three months, for nephrology opinion",
  urgency: "Please see within 2 weeks",
  clinician: "Dr Demo Physician (SYNTHETIC)",
};

const referralHtml = doc([
  header("Demo General Hospital (SIMULATED)", "Medical Outpatients (fictional)", "Date: 12/11/2026") +
    `<div class="letter">` +
    `<p>To: The Consultant Nephrologist<br>Sample Teaching Hospital (SIMULATED)</p>` +
    `<p>Dear Colleague,</p>` +
    `<p>Re: Demo Patient (SYNTHETIC), 45 years, Patient ID DEMO-00123</p>` +
    `<p>Reason for referral:<br><b>${esc(REFERRAL.reason)}</b></p>` +
    `<p>Urgency:<br><b>${esc(REFERRAL.urgency)}</b></p>` +
    `<p>Thank you for seeing this patient.</p>` +
    `<div class="sig">Yours sincerely,<br><br>${esc(REFERRAL.clinician)}<br>Medical Officer</div>` +
    `</div>`,
]);

// ---------------------------------------------------------------- the fixtures

const photo = (rotate: number, shade: "left" | "right" | "bottom", seed: number, extra: Partial<Extract<Render, { kind: "photo" }>> = {}): Render => ({
  kind: "photo",
  rotate,
  skew: 1,
  blur: 0,
  shade,
  noise: 28,
  seed,
  ...extra,
});

const ext = (r: Render) => (r.kind === "pdf" ? "pdf" : "jpg");

function make(
  s: Omit<FixtureSpec, "key"> & {
    doc_type: FixtureKey["doc_type"];
    facility: string | null;
    document_date: string | null;
    items: KeyItem[];
    referral?: FixtureKey["referral"];
  },
): FixtureSpec {
  return {
    id: s.id,
    tests: s.tests,
    render: s.render,
    html: s.html,
    key: {
      id: s.id,
      file: `${s.id}.${ext(s.render)}`,
      doc_type: s.doc_type,
      facility: s.facility,
      document_date: s.document_date,
      items: s.items,
      referral: s.referral ?? null,
    },
  };
}

export const FIXTURES: FixtureSpec[] = [
  make({
    id: "lab-fbc-photo",
    tests: "Printed full blood count, phone-photo look. Haemoglobin 9.8 g/dL is below its printed range (NFR-15, FR-09).",
    render: photo(2, "left", 11),
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "FULL BLOOD COUNT", date: "10/11/2026", labNo: "DEMO-L-1001", rows: fbcRows })]),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "10/11/2026",
    items: fbcRows.map((r) => labKey(r)),
  }),
  make({
    id: "lab-chem-photo",
    tests: "Printed chemistry panel, rotated 2 degrees, µmol/L unit symbol.",
    render: photo(-2, "right", 12),
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "CLINICAL CHEMISTRY", date: "09/11/2026", labNo: "DEMO-L-1002", rows: chemRows })]),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "09/11/2026",
    items: chemRows.map((r) => labKey(r)),
  }),
  make({
    id: "lab-hba1c-2025-pdf",
    tests: "Digital lab-portal PDF, HbA1c 8.1 %, the earlier of two results (FR-24 previous value).",
    render: { kind: "pdf" },
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "GLYCATED HAEMOGLOBIN", date: "14/05/2025", labNo: "DEMO-L-0501", rows: hba1c("8.1") })], "portal"),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "14/05/2025",
    items: hba1c("8.1").map((r) => labKey(r)),
  }),
  make({
    id: "lab-hba1c-2026-pdf",
    tests: "Same patient and layout, HbA1c 7.4 %, the later result (FR-24: previous value 8.1, no direction word).",
    render: { kind: "pdf" },
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "GLYCATED HAEMOGLOBIN", date: "14/05/2026", labNo: "DEMO-L-0601", rows: hba1c("7.4") })], "portal"),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "14/05/2026",
    items: hba1c("7.4").map((r) => labKey(r)),
  }),
  make({
    id: "lab-unusual-units-pdf",
    tests: "Haemoglobin in g/L and fasting glucose with an unusual printed range: units and ranges kept as printed, never converted (NFR-17, NFR-18).",
    render: { kind: "pdf" },
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "LABORATORY REPORT", date: "11/11/2026", labNo: "DEMO-L-1003", rows: unusualRows })], "portal"),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "11/11/2026",
    items: unusualRows.map((r) => labKey(r)),
  }),
  make({
    id: "lab-no-range-photo",
    tests: "The reference range column is blank: range must stay null and nothing may be filled in (NFR-17).",
    render: photo(1.5, "bottom", 13),
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "LABORATORY REPORT", date: "08/11/2026", labNo: "DEMO-L-1004", rows: noRangeRows })]),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "08/11/2026",
    items: noRangeRows.map((r) => labKey(r)),
  }),
  make({
    id: "lab-blurred-photo",
    tests: "A lab sheet blurred heavily on purpose: the result must come back unreadable or absent, never guessed (FR-04).",
    render: photo(1, "left", 14, { blur: 9 }),
    html: doc([labPage({ facility: LAB, address: LAB_ADDR, title: "CLINICAL CHEMISTRY", date: "07/11/2026", labNo: "DEMO-L-1005", rows: blurRows })]),
    doc_type: "lab_report",
    facility: null,
    document_date: null,
    items: blurRows.map((r) => labKey(r, false)),
  }),
  make({
    id: "rx-printed-photo",
    tests: "Printed prescription, three medicines and one allergy line: medicines and allergies are flagged for care (NFR-15).",
    render: photo(-1.5, "right", 15),
    html: rxHtml,
    doc_type: "prescription",
    facility: "Demo General Hospital (SIMULATED)",
    document_date: "12/11/2026",
    items: [
      ...MEDS.map((m): KeyItem => ({ kind: "medication", label: m.label, value: m.value, unit: null, range: null, readable: true, critical: true })),
      { kind: "allergy", label: "Penicillin", value: null, unit: null, range: null, readable: true, critical: true },
    ],
  }),
  make({
    id: "referral-letter-photo",
    tests: "Printed referral letter: reason, urgency (in words) and clinician carried verbatim, never rephrased or supplied (hard rule 7).",
    render: photo(2.5, "left", 16),
    html: referralHtml,
    doc_type: "referral_letter",
    facility: "Demo General Hospital (SIMULATED)",
    document_date: "12/11/2026",
    items: [],
    referral: REFERRAL,
  }),
  make({
    id: "lab-mixed-pdf",
    tests: "Two-page lab PDF with an ISO date: page handling and source_page.",
    render: { kind: "pdf" },
    html: doc(
      [
        labPage({ facility: LAB, address: LAB_ADDR, title: "HAEMATOLOGY (page 1 of 2)", date: "2026-11-02", labNo: "DEMO-L-1006", rows: mixedP1 }),
        labPage({ facility: LAB, address: LAB_ADDR, title: "CLINICAL CHEMISTRY (page 2 of 2)", date: "2026-11-02", labNo: "DEMO-L-1006", rows: mixedP2 }),
      ],
      "portal",
    ),
    doc_type: "lab_report",
    facility: LAB,
    document_date: "2026-11-02",
    items: [...mixedP1, ...mixedP2].map((r) => labKey(r)),
  }),
];
