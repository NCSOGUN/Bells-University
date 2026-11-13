# Prep B extraction test report

- Model: `gemini-3.5-flash-lite`
- Prompt version: `v1`
- Date: 2026-11-13
- Runs per document: 1
- Calls in this report: 10 (10 scored, 0 failed to extract and not scored) over 10 documents, 1 run(s) each
- Latency of the 10 scored calls (ms): median 4849, p90 6839, p95 8071 (nearest rank; with n=10 this is the maximum), max 8071; over 25 s: 0; over 30 s: 0. Failed calls have no recorded time. NFR-10 is 30 s on throttled 3G; this is unthrottled server-side time, so 3G transfer is not included
- **NFR-15: PASS**
- Critical errors: 0 as reported; 0 if unit glyph variants were counted as critical (the strict count)

Synthetic documents only. Accuracy here does not prove real-world accuracy.

| Document | ms | Items found/expected | Label | Value | Unit | Range | Unreadable handled | Hallucinated | Critical |
|---|---|---|---|---|---|---|---|---|---|
| lab-blurred-photo | 3790 | 0/3 | 0% (0/3) | n/a | n/a | n/a | 3/3 | 0 | 0 |
| lab-chem-photo | 4220 | 5/5 | 100% (5/5) | 100% (5/5) | 100% (5/5) | 100% (5/5) | n/a | 0 | 0 |
| lab-fbc-photo | 4849 | 4/4 | 100% (4/4) | 100% (4/4) | 100% (4/4) | 100% (4/4) | n/a | 0 | 0 |
| lab-hba1c-2025-pdf | 5786 | 1/1 | 100% (1/1) | 100% (1/1) | 100% (1/1) | 100% (1/1) | n/a | 0 | 0 |
| lab-hba1c-2026-pdf | 2842 | 1/1 | 100% (1/1) | 100% (1/1) | 100% (1/1) | 100% (1/1) | n/a | 0 | 0 |
| lab-mixed-pdf | 6839 | 6/6 | 100% (6/6) | 100% (6/6) | 100% (6/6) | 100% (6/6) | n/a | 0 | 0 |
| lab-no-range-photo | 4935 | 3/3 | 100% (3/3) | 100% (3/3) | 100% (3/3) | n/a | n/a | 0 | 0 |
| lab-unusual-units-pdf | 3604 | 2/2 | 100% (2/2) | 100% (2/2) | 100% (2/2) | 100% (2/2) | n/a | 0 | 0 |
| referral-letter-photo | 3781 | 0/0 | n/a | n/a | n/a | n/a | n/a | 0 | 0 |
| rx-printed-photo | 8071 | 4/4 | 100% (4/4) | 100% (3/3) | n/a | n/a | n/a | 0 | 0 |

## Critical errors

None.

## Referral letters (reason and urgency must be the letter's exact words)

- referral-letter-photo: reason exact; urgency exact

## Items the model missed (not critical)

- lab-blurred-photo: Fasting Glucose; Creatinine; Urea
