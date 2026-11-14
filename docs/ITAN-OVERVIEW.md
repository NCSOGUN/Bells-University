# Itan: project overview (corrected to match the build)

Status: 14 Nov 2026. Supersedes the earlier overview PDF, which promised things the build does not do (see "What changed" at the end). Everything here is checked against `docs/SYSTEM-DESIGN.md`, `docs/limitations.md` and the code. **All data is synthetic. Itan is a prototype, not cleared for real patients.**

## 1. In one paragraph
Itan is a patient-held medical record. The patient photographs the paper they already have (a lab report, a prescription, a referral letter). An AI service **only reads** the text into fields. The patient checks each field against the photo and confirms it. At a clinic the patient shows a short code that expires; the doctor opens a one-screen summary in a browser, with no app and no account. The name comes from the Yoruba word for history: the patient tells their history once.

## 2. The one problem
At handover between health facilities in Nigeria, the receiving clinician often gets an incomplete picture. In a Lagos paediatric audit (Dec 2012 to Feb 2013) only 28.4% of 356 referral letters contained any test results and 8.4% stated urgency; in an Ibadan diabetes clinic audit (2017) 21.7% of 120 letters stated an HbA1c. An estimated 18 to 23% of Nigerian hospitals use electronic records (Salam et al., 2023, pooled review), and the national exchange that would connect them is still being built. Until then the paper the patient carries is the only thing that travels.

Scope limit: Itan does not fix bed shortage, replace hospital systems, or build the national exchange. The audits are old and from Lagos and Ibadan; we found no Ogun State measurement.

## 3. What Itan does (built)
1. **Capture.** Photo or PDF, made smaller and stripped of location data on the device, queued on the phone until it uploads.
2. **Read.** The AI returns, for each item: the text as printed, the printed unit, the printed range, and a quote. It never guesses: unreadable means empty.
3. **Guard.** Our code checks every number against the printed text. Nothing is ever auto-confirmed.
4. **Confirm.** The patient sees the photo beside each field and confirms, corrects or removes it. Every fact shows where it came from and whether it is unverified or confirmed.
5. **Explain.** A fixed-text explanation compares a value with **the range printed on the same document** and adds a short description written by the team. No AI writes it. We keep no reference-range table and never convert units.
6. **Share.** The patient picks a duration and categories to hide. The code is shown once, expires, and can be ended at any moment; the doctor's access ends on their next click.
7. **Read as clinician.** One server-rendered screen: allergies and advisory, medicines, recent results with the printed range and previous value, referral. The doctor's name and practice number are recorded and shown to the patient but **not verified**.
8. **Log.** The patient sees who opened what, and refused attempts too.
9. **Referral.** The packet is built from existing facts. Reason and urgency are carried **word for word** from a photographed referral letter (the patient confirms the transcription) or from a hospital's message; otherwise the packet says "Not stated by the referring clinician". Itan never sets urgency. The receiving clinician can tap "Received, service offered here" or "Received, service not offered here". This is not a statement that a bed is available.
10. **Hospital link (SIMULATED).** A write-only feed lets a hospital system push results into the patient's record, once the patient links that hospital. The hospital cannot read anything. The partner in the demo is a script; no real hospital is connected.
11. **Two-step sign-in (optional, new).** Authenticator-app code (TOTP) after the password. Once enrolled, creating a share or linking a hospital needs a fresh code.

## 4. What Itan is not
- Not a diagnosis, triage or advice tool. The drug-allergy advisory uses a short hand-built list, is **not clinically validated**, never blocks anything, and only knows allergies that someone wrote down. No flag is not proof of safety.
- Not a hospital record system and not FHIR-compliant. The feed is **FHIR R4-aligned at the partner interface only** (a small Bundle subset).
- Not for emergencies where the patient cannot create a share (roadmap, section 8).
- Not tested on handwriting. Prep B (extraction accuracy) used 10 synthetic, computer-made documents, not real phone photographs; see `docs/limitations.md` for the numbers and the one earlier INCOMPLETE run.

## 5. Where the data goes
- At rest: Supabase, London (eu-west-2). Functions: Vercel London.
- During reading: the photo goes to the Google Gemini API, which may process or cache it **in any country**. On the paid tier Google does not use it to improve its products; on the free tier it may, and people at Google may read it. The demo states which tier it runs on (`docs/limitations.md` section 4). Itan does **not** remove the patient's name before sending: that earlier claim is withdrawn.
- Encryption at rest is Supabase's own claim; we have not verified it.
- Gemini's terms bar clinical practice and medical advice, which is why the AI only transcribes. Whether a clinician reading the output at the point of care is inside that bar has not had a lawyer's review.
- The Nigeria Data Protection Act and its implementation directive have **not been read from the statute by the team**. No compliance claim is made. Cross-border transfer may need more than consent.

## 6. Compared with Torch
Torch (US, bought by OpenAI in January 2026, price reported between about $60M and $100M) unified lab results, medications and visit recordings into one record. ChatGPT Health, the product it feeds, links US portals through a partner. Itan keeps the idea of a patient-side record with provenance, and changes the input to **paper first**, because Nigeria has no portal to pull from. Itan is scoped to the handover moment, with expiring consented sharing and a log. Itan is not a longitudinal AI assistant and does not claim to be.

## 7. Who it is for, and its limits on access
Patients moving between clinics or referred, especially long-term conditions and pregnancy, and the clinicians receiving them. It needs a phone with a camera to build the record and a connection to open it. Capture queues offline. About 43% of primary health centres have no electricity and about 60% of rural ones no internet (ministerial figures, Jun 2026), so the first users are urban, phone-owning patients.

## 8. Roadmap (not built, not promised)
1. Verified-facility access by patient ID under the patient's consent, with the same access log.
2. Emergency "break-glass" access: mandatory reason, immediate patient notification, full log entry.
3. Doctor-side summaries and session notes using an AI arrangement that suits clinical use, after legal and clinical review.
4. HMO and government-hospital integration. Government is the natural first partner; revenue then depends on policy we do not control.
Each step comes after the legal, clinical and security review in `docs/limitations.md`.

## 9. What changed from the earlier overview
| Earlier claim | Now |
| --- | --- |
| AI writes explanations and a clinician summary | AI only reads. Explanations are fixed text plus a team glossary |
| Handwritten cards and prescriptions | Printed documents and lab PDFs; handwriting untested |
| Doctor writes the referral reason; hospital acknowledges before travel | Reason and urgency carried verbatim from a source; acknowledgement means "received, service offered here" |
| Name removed before sending to AI | Withdrawn: not implemented |
| Practice number checked against a list | Recorded, not verified |
| Hospital registers: "fewer than 18%" | "An estimated 18 to 23% (2023 review)" |
| Real-looking facility and doctor names | Fictional, labelled SIMULATED |
