import type { Visit, Vitals } from "./mock-data";

export interface VitalField {
  key: keyof Vitals;
  label: string;
  unit: string;
  format: (vitals: Vitals) => string | undefined;
}

export const VITAL_FIELDS: VitalField[] = [
  { key: "bloodPressure", label: "Blood pressure", unit: "mmHg", format: (v) => v.bloodPressure },
  { key: "pulse", label: "Pulse", unit: "bpm", format: (v) => String(v.pulse) },
  { key: "temperature", label: "Temperature", unit: "°C", format: (v) => v.temperature.toFixed(1) },
  { key: "weight", label: "Weight", unit: "kg", format: (v) => String(v.weight) },
  {
    key: "bloodSugar",
    label: "Blood sugar",
    unit: "mg/dL",
    format: (v) => (v.bloodSugar === undefined ? undefined : String(v.bloodSugar)),
  },
];

/** Fields that have a value in at least one of the given readings. */
export function presentVitalFields(readings: Vitals[]): VitalField[] {
  return VITAL_FIELDS.filter((field) => readings.some((v) => field.format(v) !== undefined));
}

export function parseBloodPressure(value: string): { systolic: number; diastolic: number } | null {
  const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(value.trim());
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

type Adherence = NonNullable<Visit["medicationAdherence"]>;

export const ADHERENCE_LABEL: Record<Adherence, string> = {
  taken_as_scheduled: "Taken as scheduled",
  partial: "Some doses missed",
  missed: "Doses missed",
};
