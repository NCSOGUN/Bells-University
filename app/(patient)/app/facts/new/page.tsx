"use client";
// FR-07: add a fact by hand. It is stored as added by the patient and confirmed. Also the fallback when a document cannot be read.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useRecord } from "@/components/RecordContext";
import { Button, ErrorBox, Field, inputCls, PageHeader } from "@/components/ui";
import type { AddFactBody, FactResponse } from "@/lib/api-types";
import { describeError, postJson } from "@/lib/client-api";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@/lib/category-labels";

const KINDS: { value: AddFactBody["kind"]; label: string }[] = [
  { value: "lab", label: "Test result" },
  { value: "medication", label: "Medicine" },
  { value: "allergy", label: "Allergy" },
  { value: "diagnosis", label: "Diagnosis" },
  { value: "other", label: "Something else" },
];

export default function NewFactPage() {
  const router = useRouter();
  const { record } = useRecord();
  const [kind, setKind] = useState<AddFactBody["kind"]>("lab");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [range, setRange] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: AddFactBody = { record_id: record!.id, kind, label_as_printed: label.trim() };
      if (value.trim()) body.value_as_printed = value.trim();
      if (unit.trim()) body.unit_as_printed = unit.trim();
      if (range.trim()) body.range_as_printed = range.trim();
      if (date.trim()) body.fact_date_as_printed = date.trim();
      if (category) body.sensitive_category = category as NonNullable<AddFactBody["sensitive_category"]>;
      await postJson<FactResponse>("/api/facts", body);
      router.push("/app");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const isLab = kind === "lab";
  return (
    <>
      <PageHeader title="Add a fact by hand" sub="Type it as it is written on your paper. It will be marked as added by you." />
      <form onSubmit={submit} className="grid max-w-xl gap-4">
        <Field label="What is it?">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as AddFactBody["kind"])}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={kind === "medication" ? "Medicine name" : kind === "allergy" ? "Allergy" : kind === "diagnosis" ? "Diagnosis" : isLab ? "Test name" : "Name"}>
          <input className={inputCls} required maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div className={`grid gap-4 ${isLab ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Field label={kind === "medication" ? "Dose" : "Value"}>
            <input className={`${inputCls} printed`} value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
          <Field label="Unit">
            <input className={`${inputCls} printed`} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
          {isLab ? (
            <Field label="Printed range">
              <input className={`${inputCls} printed`} value={range} onChange={(e) => setRange(e.target.value)} />
            </Field>
          ) : null}
        </div>
        <Field label="Date on the paper (day first)" hint="For example 03/11/2026.">
          <input className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Mark as sensitive (optional)">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Not marked</option>
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div>
          <Button type="submit" disabled={busy || !label.trim()}>
            Add to my history
          </Button>
        </div>
      </form>
    </>
  );
}
