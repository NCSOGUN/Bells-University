# Prep B extraction test report

- Model: `gemini-3.5-flash-lite`
- Prompt version: `v1`
- Date: 2026-11-13
- Runs per document: 2
- Calls in this report: 20 (19 scored, 1 failed to extract and not scored) over 10 documents, 2 run(s) each
- Latency of the 19 scored calls (ms): median 11248, p90 35089, p95 37863 (nearest rank; with n=19 this is the maximum), max 37863; over 25 s: 4; over 30 s: 2. Failed calls have no recorded time. NFR-10 is 30 s on throttled 3G; this is unthrottled server-side time, so 3G transfer is not included
- Rescored from the saved results under the D-020 rule on 2026-11-13, with no model calls. Scored strictly the first time this run had 2 critical errors; D-020 reclassified them as 2 glyph variants in 1 document (the unit rule was refined after seeing this result, see D-020).
- **NFR-15: INCOMPLETE (0 critical errors in 19 scored; 2 glyph variants, reclassified, see D-020; 1 failed to extract, not scored)**
- Critical errors: 0 as reported; 2 if unit glyph variants were counted as critical (the strict count)

Synthetic documents only. Accuracy here does not prove real-world accuracy.

| Document | ms | Items found/expected | Label | Value | Unit | Range | Unreadable handled | Hallucinated | Critical |
|---|---|---|---|---|---|---|---|---|---|
| lab-blurred-photo | 6990 | 0/3 | 0% (0/3) | n/a | n/a | n/a | 3/3 | 0 | 0 |
| lab-blurred-photo | 6859 | 0/3 | 0% (0/3) | n/a | n/a | n/a | 3/3 | 0 | 0 |
| lab-chem-photo | 23523 | 5/5 | 100% (5/5) | 100% (5/5) | 80% (4/5) | 100% (5/5) | n/a | 0 | 0 |
| lab-chem-photo | 27424 | 5/5 | 100% (5/5) | 100% (5/5) | 80% (4/5) | 100% (5/5) | n/a | 0 | 0 |
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

None.

## Unit glyph variants (reported separately, not counted as critical; D-020)

Same letter to a reader, different character: the micro sign U+00B5 versus the Greek mu U+03BC. The strict unit hit-rate above still counts each as a miss.

| Document | Item | Printed (key) | Returned | Printed code point | Returned code point |
|---|---|---|---|---|---|
| lab-chem-photo | Creatinine | µmol/L | μmol/L | U+00B5 | U+03BC |
| lab-chem-photo | Creatinine | µmol/L | μmol/L | U+00B5 | U+03BC |

## Referral letters (reason and urgency must be the letter's exact words)

- referral-letter-photo: reason exact; urgency exact
- referral-letter-photo: reason exact; urgency exact

## Items the model missed (not critical)

- lab-blurred-photo: Fasting Glucose; Creatinine; Urea
- lab-blurred-photo: Fasting Glucose; Creatinine; Urea
