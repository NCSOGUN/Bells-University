# Itan: known limitations (DRAFT for the team to finish, NFR-14)

Status: draft written 13 Nov 2026 by Dev B. Lines marked **TEAM** must be completed by a person before publishing. Nothing here is an estimate presented as a measurement.

## 1. Documents tested and measured accuracy
- **Test set:** 10 SYNTHETIC documents with answer keys (`tools/fixtures`): two printed lab photos, one more lab photo with a blank range column, a heavily blurred lab photo, a printed prescription (3 medicines, 1 allergy), a printed referral letter, and four lab PDFs (including one in g/L and one two-page PDF). They are clean, computer-made layouts with a printed-photo look, **not real phone photographs, and no handwriting**. They do not prove real-world accuracy.
- **Run:** 13 Nov 2026, model `gemini-3.5-flash-lite`, prompt v1, 2 runs per document (20 calls; 1 failed with a provider error and was not scored). An earlier single run (10 calls, 1 provider failure) gave the same results.
- **Read correctly:** every test name, result, range and date; every medicine name and dose; the penicillin allergy; the referral reason and urgency in the letter's exact words with no diagnosis invented; the blank range column left empty; nothing invented on any page; the blurred sheet returned no results (3 of 3 handled as unreadable).
- **NFR-15 (zero confident critical errors): FAIL, 2 critical errors.** Both are one finding, reproduced twice: the model returned the Greek mu (U+03BC) for the micro sign (U+00B5) in `µmol/L`. It looks identical and is not a wrong value, medicine, dose or allergy, but it is not "character for character". See DEVIATIONS D-020. **TEAM:** decide how this is treated before the freeze.
- **TEAM:** after the two real phone photographs are scored, add them here.

## 2. Failure modes seen so far
- **Provider errors.** About 2 of 30 calls to `gemini-3.5-flash-lite` failed (`model_unavailable`) after our retries. A failed extraction writes nothing and the patient can retry. `gemini-3.6-flash` was worse (D-013, D-015).
- **Slow tail.** Unthrottled server-side extraction took a median of 11.2 s but up to **37.9 s** (4 of 20 calls took 27 to 38 s), above the 30 s target (NFR-10) before any 3G delay. Not yet measured on throttled 3G.
- **Unit glyph variant.** The same-looking unit can come back as a different character. Previous-value comparison (FR-24) compares units exactly, so two such results would silently show no previous value (D-020).
- **A clinician line can swallow the next line.** On the referral letter the referring clinician came back as "Dr Demo Physician (SYNTHETIC)" plus the following line "Medical Officer". The scorer does not compare this field, so it is unmeasured.
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
- **At rest:** all patient data is in the United Kingdom (Supabase London, eu-west-2). Functions are configured for Vercel London (`lhr1`). The region is **not yet confirmed** on the deployed URL.
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
