# Synthetic demo documents and answer keys

Everything here is **SYNTHETIC**. Every patient, clinician, laboratory, hospital, number and address is invented, and every page carries the footer "SYNTHETIC DEMO DATA, not a real patient". No real person appears anywhere (hard rule 8).

Regenerate with `npm run fixtures` (uses an installed Chrome or Edge; no browser download). The documents and keys are generated from one definition, `specs.ts`, so a key cannot disagree with its page. `tests/fixtures.test.ts` checks that. Run the extraction test with `npm run extract-test`.

| Fixture | Form | What it tests |
| --- | --- | --- |
| `lab-fbc-photo` | phone-photo look (JPEG) | Printed full blood count. Haemoglobin 9.8 g/dL is below its printed range 12.0 - 16.0 |
| `lab-chem-photo` | phone-photo look, rotated 2 degrees | Printed chemistry panel, µmol/L unit symbol |
| `lab-hba1c-2025-pdf` | digital PDF | HbA1c 8.1 %, the earlier result (FR-24 previous value) |
| `lab-hba1c-2026-pdf` | digital PDF | Same patient and layout, HbA1c 7.4 %, the later result |
| `lab-unusual-units-pdf` | digital PDF | Haemoglobin in g/L and fasting glucose with an unusual printed range: kept as printed, never converted (NFR-17, NFR-18) |
| `lab-no-range-photo` | phone-photo look | The reference range column is blank: range must stay empty (NFR-17) |
| `lab-blurred-photo` | heavily blurred photo | Must come back unreadable or absent, never guessed (FR-04) |
| `rx-printed-photo` | phone-photo look | Three medicines and the line "Allergy: Penicillin": flagged for care (NFR-15) |
| `referral-letter-photo` | phone-photo look | Reason, urgency (in words) and clinician carried verbatim (hard rule 7) |
| `lab-mixed-pdf` | two-page digital PDF, ISO date | Page handling and `source_page` |

Dates are dd/mm/yyyy in eight documents and ISO (yyyy-mm-dd) in one (`lab-mixed-pdf`); the blurred sheet has no readable date.

## Answer keys

`keys/<id>.json`, shaped by `key-schema.ts`. Every medicine, allergy and lab value is `critical`: a wrong one presented as confident is a critical error (NFR-15). On the blurred sheet the items have `readable: false` and null values.

## What these do not prove

- They are **clean, computer-made layouts with a printed-photo look**. They are **not** real phone photographs, and handwriting is not covered. Passing here does **not** show real-world accuracy.
- **Two of these should also be printed and photographed with a real phone before Prep B: `lab-fbc` and `rx-printed`.** Save the photos with the same names plus `-real` (for example `lab-fbc-photo-real.jpg`) and copy the key, so the real photo can be scored beside its computer-made twin.
- The photo fixtures are JPEG, 500 KB or less, long edge 1600 px or less: what the app's device-side re-encoding sends.
- Real prescriptions vary far more than this table layout. The referral letter prints no diagnosis, so any diagnosis the model reports from it counts against it.
