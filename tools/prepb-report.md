# Prep B extraction test report

- Model: `gemini-3.5-flash-lite`
- Prompt version: `v1`
- Date: 2026-11-13
- Runs per document: 2
- Documents scored: 19; failed to extract: 1
- Latency (ms): median 11248, slowest 37863 (NFR-10 target is 30 s on throttled 3G; this is unthrottled server-side time)
- **NFR-15: FAIL (2 critical errors)**

Synthetic documents only. Accuracy here does not prove real-world accuracy.

| Document | ms | Items found/expected | Label | Value | Unit | Range | Unreadable handled | Hallucinated | Critical |
|---|---|---|---|---|---|---|---|---|---|
| lab-blurred-photo | 6990 | 0/3 | 0% (0/3) | n/a | n/a | n/a | 3/3 | 0 | 0 |
| lab-blurred-photo | 6859 | 0/3 | 0% (0/3) | n/a | n/a | n/a | 3/3 | 0 | 0 |
| lab-chem-photo | 23523 | 5/5 | 100% (5/5) | 100% (5/5) | 80% (4/5) | 100% (5/5) | n/a | 0 | 1 |
| lab-chem-photo | 27424 | 5/5 | 100% (5/5) | 100% (5/5) | 80% (4/5) | 100% (5/5) | n/a | 0 | 1 |
| lab-fbc-photo | 12358 | 4/4 | 100% (4/4) | 100% (4/4) | 100% (4/4) | 100% (4/4) | n/a | 0 | 0 |
| lab-fbc-photo | 11248 | 4/4 | 100% (4/4) | 100% (4/4) | 100% (4/4) | 100% (4/4) | n/a | 0 | 0 |
| lab-hba1c-2025-pdf | 6960 | 1/1 | 100% (1/1) | 100% (1/1) | 100% (1/1) | 100% (1/1) | n/a | 0 | 0 |
| lab-hba1c-2025-pdf | 35089 | 1/1 | 100% (1/1) | 100% (1/1) | 100% (1/1) | 100% (1/1) | n/a | 0 | 0 |
| lab-hba1c-2026-pdf | 10928 | 1/1 | 100% (1/1) | 100% (1/1) | 100% (1/1) | 100% (1/1) | n/a | 0 | 0 |
| lab-hba1c-2026-pdf | 11227 | 1/1 | 100% (1/1) | 100% (1/1) | 100% (1/1) | 100% (1/1) | n/a | 0 | 0 |
| lab-mixed-pdf | 9788 | 6/6 | 100% (6/6) | 100% (6/6) | 100% (6/6) | 100% (6/6) | n/a | 0 | 0 |
| lab-mixed-pdf | 37863 | 6/6 | 100% (6/6) | 100% (6/6) | 100% (6/6) | 100% (6/6) | n/a | 0 | 0 |
| lab-no-range-photo | 10956 | 3/3 | 100% (3/3) | 100% (3/3) | 100% (3/3) | n/a | n/a | 0 | 0 |
| lab-unusual-units-pdf | 11756 | 2/2 | 100% (2/2) | 100% (2/2) | 100% (2/2) | 100% (2/2) | n/a | 0 | 0 |
| lab-unusual-units-pdf | 8681 | 2/2 | 100% (2/2) | 100% (2/2) | 100% (2/2) | 100% (2/2) | n/a | 0 | 0 |
| referral-letter-photo | 19016 | 0/0 | n/a | n/a | n/a | n/a | n/a | 0 | 0 |
| referral-letter-photo | 29736 | 0/0 | n/a | n/a | n/a | n/a | n/a | 0 | 0 |
| rx-printed-photo | 12316 | 4/4 | 100% (4/4) | 100% (3/3) | n/a | n/a | n/a | 0 | 0 |
| rx-printed-photo | 8266 | 4/4 | 100% (4/4) | 100% (3/3) | n/a | n/a | n/a | 0 | 0 |

## Documents that failed to extract

- lab-no-range-photo: model_unavailable

## Critical errors

| Document | Item | Reason | Expected | Actual |
|---|---|---|---|---|
| lab-chem-photo | Creatinine | unit differs from key | µmol/L | μmol/L |
| lab-chem-photo | Creatinine | unit differs from key | µmol/L | μmol/L |

## Referral letters (reason and urgency must be the letter's exact words)

- referral-letter-photo: reason exact; urgency exact
- referral-letter-photo: reason exact; urgency exact

## Items the model missed (not critical)

- lab-blurred-photo: Fasting Glucose; Creatinine; Urea
- lab-blurred-photo: Fasting Glucose; Creatinine; Urea
