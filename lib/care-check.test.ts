// Run with: npm test   (Node's built-in runner; no extra dependencies.)
// These use a made-up person, not a seeded elder. The seeded arc is checked by
// the invariant in createSeedState, so there is one copy of the real records.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeBaseline,
  parseCareCheckInput,
  runCareCheck,
  THRESHOLDS,
  type CareCheckInput,
  type Reading,
} from "./care-check.ts";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n * 7)).toISOString();
const reading = (n: number, systolic: number, diastolic: number, pulse: number): Reading => ({
  recordedAt: day(n),
  systolic,
  diastolic,
  pulse,
});
const STEADY = [reading(0, 128, 82, 74), reading(1, 130, 83, 76), reading(2, 129, 82, 75), reading(3, 132, 84, 77)];

const input = (
  systolic: number,
  diastolic: number,
  history: Reading[] = STEADY,
  extra: Partial<CareCheckInput["current"]> = {},
): CareCheckInput => ({
  current: { systolic, diastolic, pulse: 76, temperature: 36.6, medicationAdherence: "taken_as_scheduled", ...extra },
  history,
});
const run = (i: CareCheckInput) => runCareCheck(i, "server", new Date("2026-02-01T09:00:00Z"));
const ids = (i: CareCheckInput) => run(i).findings.map((f) => f.ruleId);

test("a reading near their usual stays green with no findings", () => {
  const result = run(input(134, 86));
  assert.equal(result.suggestedStatus, "green");
  assert.deepEqual(result.findings, []);
});

test("baseline is the rounded middle of the last visits, and absent with too little history", () => {
  assert.deepEqual(computeBaseline(STEADY), { systolic: 130, diastolic: 83, pulse: 76, basedOnVisits: 4 });
  assert.equal(computeBaseline(STEADY.slice(0, THRESHOLDS.minVisitsForBaseline - 1)), null);
});

test("a jump above their own usual is flagged yellow and explains itself with numbers and units", () => {
  const result = run(input(148, 92));
  assert.equal(result.suggestedStatus, "yellow");
  const rise = result.findings.find((f) => f.ruleId === "BP_RISE");
  assert.ok(rise);
  assert.match(rise.reason, /148\/92 mmHg is 18 mmHg higher on the top number than their usual 130\/83 mmHg/);
});

test("the same reading is not flagged for someone whose usual is already that high", () => {
  const high = [reading(0, 146, 90, 76), reading(1, 148, 91, 77), reading(2, 147, 90, 76), reading(3, 149, 91, 78)];
  assert.ok(!ids(input(149, 91, high)).includes("BP_RISE"));
});

test("one odd reading in the history does not drag their usual up", () => {
  const withSpike = [...STEADY.slice(1), reading(4, 148, 92, 88)];
  assert.equal(computeBaseline(withSpike)?.systolic, 131);
  assert.equal(run(input(134, 86, withSpike)).suggestedStatus, "green");
});

test("a critical reading is red", () => {
  assert.equal(run(input(184, 118)).suggestedStatus, "red");
  assert.equal(run(input(150, 121)).suggestedStatus, "red");
});

test("a steady climb is caught for a new client who has no personal usual yet", () => {
  const climbing = [reading(0, 120, 78, 70), reading(1, 127, 79, 71)];
  const result = run(input(136, 82, climbing));
  assert.equal(result.baseline, null);
  assert.deepEqual(result.findings.map((f) => f.ruleId), ["BP_TREND"]);
  assert.equal(result.suggestedStatus, "yellow");
});

test("a pulse rise alone is noted but does not change the status", () => {
  const result = run(input(130, 83, STEADY, { pulse: 88 }));
  assert.equal(result.suggestedStatus, "green");
  assert.equal(result.findings[0]?.ruleId, "PULSE_RISE");
});

test("missed medication is yellow, some missed doses is a note", () => {
  assert.equal(run(input(130, 83, STEADY, { medicationAdherence: "missed" })).suggestedStatus, "yellow");
  assert.equal(run(input(130, 83, STEADY, { medicationAdherence: "partial" })).suggestedStatus, "green");
});

test("high fever is yellow and very high is red", () => {
  assert.equal(run(input(130, 83, STEADY, { temperature: 38.2 })).suggestedStatus, "yellow");
  assert.equal(run(input(130, 83, STEADY, { temperature: 39.4 })).suggestedStatus, "red");
});

test("with no history it uses the fixed lines only and says nothing about a usual", () => {
  const result = run(input(130, 83, []));
  assert.equal(result.baseline, null);
  assert.equal(result.suggestedStatus, "green");
  assert.equal(run(input(150, 95, [])).suggestedStatus, "yellow");
});

test("every result carries the model version, source and time", () => {
  const result = run(input(130, 83));
  assert.equal(result.modelVersion, "rules-v1");
  assert.equal(result.source, "server");
  assert.equal(result.evaluatedAt, "2026-02-01T09:00:00.000Z");
});

test("the payload parser rejects impossible readings and drops extra fields", () => {
  const bad = parseCareCheckInput({ current: { systolic: 80, diastolic: 120, pulse: 400, temperature: 36.6, medicationAdherence: "taken_as_scheduled" }, history: [] });
  assert.equal(bad.ok, false);
  const ok = parseCareCheckInput({
    current: { systolic: 130, diastolic: 83, pulse: 76, temperature: 36.6, medicationAdherence: "taken_as_scheduled", patientName: "Should be dropped" },
    history: [],
    address: "Should be dropped",
  });
  assert.ok(ok.ok);
  assert.ok(!JSON.stringify(ok.input).includes("dropped"));
});

// ── The cases the demo is built around ─────────────────────────────────────

const WELL_CONTROLLED = [reading(0, 116, 74, 70), reading(1, 118, 76, 71), reading(2, 115, 74, 69), reading(3, 117, 75, 70)];

test("a reading under the textbook limit is still flagged when it is far above THEIR usual", () => {
  const result = run(input(138, 86, WELL_CONTROLLED));
  assert.equal(result.suggestedStatus, "yellow");
  assert.deepEqual(result.findings.map((f) => f.ruleId), ["BP_RISE"]);
  assert.match(result.findings[0].reason, /138\/86 mmHg is 21 mmHg higher on the top number than their usual 117\/75 mmHg/);
  // The same reading means nothing to a fixed limit, and nothing to someone whose usual is higher.
  assert.equal(run(input(138, 86, [])).suggestedStatus, "green");
  assert.equal(run(input(138, 86, STEADY)).suggestedStatus, "green");
});

test("a high usual is called out, and the fixed limit still catches the reading", () => {
  const high = [reading(0, 150, 92, 76), reading(1, 152, 93, 77), reading(2, 151, 92, 76), reading(3, 153, 93, 78)];
  const result = run(input(152, 93, high));
  const rules = result.findings.map((f) => f.ruleId);
  assert.ok(rules.includes("BASELINE_HIGH"));
  assert.ok(rules.includes("BP_HIGH"));
  assert.ok(!rules.includes("BP_RISE"));
  assert.equal(result.suggestedStatus, "yellow");
  // Close to a low usual never produces the note.
  assert.ok(!ids(input(134, 86)).includes("BASELINE_HIGH"));
});

test("higher blood pressure with missed doses is linked, but missed doses alone are not", () => {
  const linked = run(input(138, 86, WELL_CONTROLLED, { medicationAdherence: "missed" }));
  assert.deepEqual(linked.findings.map((f) => f.ruleId).sort(), ["BP_RISE", "MED_BP_LINK", "MED_MISSED"]);
  assert.equal(linked.suggestedStatus, "yellow");
  assert.ok(ids(input(138, 86, WELL_CONTROLLED, { medicationAdherence: "partial" })).includes("MED_BP_LINK"));
  assert.ok(!ids(input(130, 83, STEADY, { medicationAdherence: "missed" })).includes("MED_BP_LINK"));
  assert.ok(!ids(input(138, 86, WELL_CONTROLLED)).includes("MED_BP_LINK"));
});

test("a critical reading stays red whatever the usual is", () => {
  assert.equal(run(input(184, 118, WELL_CONTROLLED)).suggestedStatus, "red");
  assert.equal(run(input(184, 118, [])).suggestedStatus, "red");
});
