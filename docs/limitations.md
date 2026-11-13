# Itan: known limitations (DRAFT for the team to finish, NFR-14)

Status: draft written 13 Nov 2026 by Dev B. Lines marked **TEAM** must be completed by a person before publishing. Nothing here is an estimate presented as a measurement.

## 1. Documents tested and measured accuracy
- **Test set:** 10 SYNTHETIC documents with answer keys (`tools/fixtures`): two printed lab photos, one more lab photo with a blank range column, a heavily blurred lab photo, a printed prescription (3 medicines, 1 allergy), a printed referral letter, and four lab PDFs (including one in g/L and one two-page PDF). They are clean, computer-made layouts with a printed-photo look, **not real phone photographs, and no handwriting**. They do not prove real-world accuracy.
- **Model:** `gemini-3.5-flash-lite`, prompt v1. **The demo must run on exactly this model;** if it changes, Prep B must be re-run first.
- **Calls:** the first run was 10 calls (9 scored, 1 provider failure). The reported run was 20 calls = 10 documents x 2 runs (19 scored, 1 provider failure). 30 calls in total, 2 failures. The report covers the second run.
- **Read correctly:** every test name, result, range and date; every medicine name and dose; the penicillin allergy; the referral reason and urgency in the letter's exact words with no diagnosis invented; the blank range column left empty; nothing invented on any page; the blurred sheet returned no results (3 of 3 handled as unreadable).
- **NFR-15 (zero confident critical errors):** Scored strictly the first time, this run had 2 critical errors; D-020 reclassified them as 2 glyph variants in 1 document (the unit rule was refined after seeing this result, see D-020).
  - Verdict line as saved: `NFR-15: INCOMPLETE (0 critical errors in 19 scored; 2 glyph variants, reclassified, see D-020; 1 failed to extract, not scored)`. It is INCOMPLETE, not PASS, because one call in that run failed with a provider error; all 10 documents still have a scored run.
  - The difference: the model returned the Greek mu (U+03BC) for the micro sign (U+00B5) in `µmol/L`. They look identical. It is not a wrong value, medicine, dose or allergy. Itan now compares units after Unicode NFKC folding, for comparison only, so a previous value is not lost; it stores the text the model returned and does not claim it matches the printed character.
  - **TEAM:** if a judge asks: the rule was refined after the first run, because of this finding, and both numbers are reported.
- **Later run, 13 Nov (evening), same model and prompt:** 10 calls (one per document), all 10 scored, none failed, **0 critical errors, `NFR-15: PASS`**. This run returned the micro sign correctly, so it had no glyph variants. It is **one run per document**, not two, and the same 10 synthetic documents, so it does not show real-world accuracy and does not cancel the earlier INCOMPLETE run: the model does vary between runs (a glyph variant on one run, none on the next). Calls over all runs so far: 40, 2 provider failures. The earlier report is in git history (commit `89b6e91`).
- **TEAM:** after the two real phone photographs are scored, add them here.

## 2. Failure modes seen so far
- **Provider errors.** 2 of 30 calls to `gemini-3.5-flash-lite` failed (`model_unavailable`) after our retries. A failed extraction writes nothing and the patient can retry. `gemini-3.6-flash` was worse (D-013, D-015).
- **Slow tail, and it varies.** Earlier run, unthrottled server-side extraction over 19 scored calls: median 11.2 s, p90 35.1 s, p95 and max 37.9 s (n=19, so p95 is the maximum); 4 calls took over 25 s and 2 over 30 s. A later run the same day, 10 calls: median 4.8 s, max 8.1 s, none over 25 s. We do not know why they differ (provider load is the likely cause, not measured), so **do not quote the faster run alone**: the 38 s call happened. With the browser on a Fast 3G approximation against the deployed site (`docs/evidence/throttle.md`, 13 Nov), the slowest of five documents took 6.2 s end to end. Only the browser link was throttled, it was one run, and it happened while the provider was fast.
- **Unit glyph variant.** The same-looking unit can come back as a different character (see NFR-15 above). NFKC folding also folds superscript digits, so `10⁹/L` compares equal to `109/L`; this is accepted.
- **A clinician line can swallow the next line.** On the referral letter the referring clinician came back as "Dr Demo Physician (SYNTHETIC)" plus the following line "Medical Officer". That field is not scored, so it is unmeasured.
- **Slow sign-in checks.** Calls from Nigeria to Supabase Auth in London sometimes stalled for 10 to 45 s. These used to look like "signed out" (401); they now return 503 "try again" after 8 s (P12).
- **Not yet known:** behaviour on real phone photos, real prescriptions and referral letters, and handwriting.

## 3. What Itan does NOT do
- **No clinical judgement of its own:**
  - no diagnosis, advice or triage, and no urgency judgement of its own
  - referral reason and urgency are only ever carried as written, or shown as "Not stated by the referring clinician"
- **No numbers of its own:**
  - no reference-range table: explanations compare only against the range printed on the patient's own report
  - no unit conversion: results are compared only when the printed units are identical
- **No AI-written medical text.** AI only reads documents; every explanation is fixed text written by the team.
- **Clinicians:** no clinician accounts. A clinician's name and practice number are recorded but **not verified** against any register.
- **Hospitals:** no hospital screens inside Itan. The partner hospital is **SIMULATED** (a script), not a real system.
- **Data and input:**
  - no real patient data anywhere
  - no handwriting (**TEAM:** keep this line unless Prep B shows handwriting works)
- **The drug-allergy check** uses a short hand-built list that is **not clinically validated**. It is advisory only and never blocks anything.

## 4. Gemini terms
- The Gemini API terms bar use in clinical practice and for medical advice. That is why the AI only reads documents and never explains, advises or summarises.
- On the free tier, Google may use the content to improve its products and **human reviewers may read it**. Only synthetic documents are used unless the team has a billed project.
- **TEAM:** state which tier the demo uses.
- Developers must be 18 or over, and apps must not be directed at under-18s. Itan is for adults.

## 5. Review of medical content
- Glossary descriptions and questions (NFR-20): **TEAM:** "reviewed by ______, a medical student, on __ Nov 2026; not reviewed by a licensed clinician", or "not reviewed".
- Drug-allergy list (FR-17, NFR-21): **TEAM:** same line. Its rows are stored with `reviewed_by = null` until then.

## 6. Where data is
- **At rest:** all patient data is in the United Kingdom (Supabase London, eu-west-2). Functions run in Vercel London: the deployed `/api/health` reported `lhr1` on 13 Nov (`BASE_URL=https://itan-five.vercel.app npm run smoke`).
- **During extraction:** the image goes to the Google Gemini API, which may cache or process it **in any country** where Google has facilities.
- **The feed:** SIMULATED hospital bundles travel from a team laptop to London.

## 7. Unverified items (design section 18), current status
| Item | Status 13 Nov |
| --- | --- |
| Drizzle with the Supabase transaction pooler | **Verified** (D-010) |
| supabase-js with the new `sb_secret_` keys | **Verified** (D-010) |
| Vercel request body limit (believed 4.5 MB) | Not verified; uploads are capped at 1 MB for images and 4 MB for PDFs |
| Vercel Hobby non-commercial-use rule | Not verified |
| Supabase password hashing and encryption at rest | Not verified by us (Supabase's documentation claim) |
| Gemini bounding-box format | Observed once as [ymin, xmin, ymax, xmax] on 0 to 1000; not confirmed in documentation |
| Gemini inline file size limit | Not verified |
| iOS Background Sync | Not verified (Dev A) |
| `qrcode` and `idb-keyval` packages | `qrcode` works server-side (share and link QR codes generated live); `idb-keyval` is Dev A's |
| Gemini available from Nigeria | Works: the key and calls work from Nigeria |

## 8. Interoperability
FHIR R4-aligned at the partner interface only (a small Bundle subset: Observation and ServiceRequest, validated with Zod). The internal model is our own relational schema. **Itan is not FHIR-compliant** and runs no FHIR server.

## 9. Law
The Nigeria Data Protection Act has **not been read from the statute** by the team. That includes its rules on health data as sensitive data and on cross-border transfer. No compliance claim is made. **TEAM:** keep this line unless someone reads the Act.
