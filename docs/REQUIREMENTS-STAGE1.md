# Itan: Stage 1 Requirements

Nov 12, 2026 · @Mowa

This builds on Itan: Problem Statement. Labels used throughout: **Verified** (a source establishes it), **Finding** (drawn from several sources), **Decision** (our choice, given our users and constraints), **Assumption** (believed, not validated), **Open** (needs research or a stakeholder answer).

## Decisions taken

The team is two developers, both language-agnostic; the other two members work on other contest categories. That is the binding constraint on everything below: roughly five days (12–17 Nov) and two people, with no one dedicated to design, testing or content.

**Decision 1: the share code is the credential; clinicians do not create accounts.** The patient generates a short code or QR that expires and can be revoked. The clinician enters it and sees the record. The pitch's "no login for the doctor" and the guidelines' "secure authentication and appropriate access controls" are both satisfied, because possession of a patient-issued, time-limited credential *is* an access control. The clinician view also asks for a name and practice number, stored in the access log and shown to the patient, but not verified against any register in this version, and the screen says so. Rejected: clinician accounts (no verification source available in five days, and it adds a sign-up barrier that kills adoption) and open links (no control at all).

**Decision 2: a referral acknowledgement means "received, and this service is offered here", never "a bed is available".** Bed supply is outside software, and claiming otherwise would be a safety claim we cannot support. The acknowledgement screen says what was acknowledged in those words.

**Decision 3: the drug–allergy check is a SHOULD, not a MUST, and it never gives advice.** It compares a recorded allergy against a drug name in the record and shows a non-blocking flag that says "check this with your doctor". It is scoped to a small hand-written list of common pairs with their sources written down, not a pharmacological database. If the time goes, it is cut before anything in the core flow. It appears in the current demo script, so cutting it means rewriting that script. FR-24 (the last-value comparison) now ranks above it, so if both cannot be built, FR-24 is the one to keep.

**Decision 4: the performance promise is stated as a target, not as "seconds".** Extraction completes within 30 seconds on a 3G-throttled connection for a single-page document, measured on the demo set. This is a proposed engineering target, not a standard, and it is validated or revised after the extraction test.

**Decision 5: the first document must be useful on its own.** From the cold-start finding: a user with one lab result gets a plain-language explanation of what was measured and which values sit outside the stated reference range, plus questions to ask their doctor. It is a MUST, because without it the product has no value until a user has several documents. It restates the document's own reference ranges and never interprets or diagnoses.

**A sixth decision, forced by two developers:** the facility directory shrinks from a seeded list of about ten Ogun facilities with services to a short static list used only to choose a destination in the referral flow. It is data entry with no product logic, and it is the cheapest thing to cut.

**Decision 7: from the Torch review, one idea is borrowed.** The last-value comparison on the clinician view (FR-24), and digital lab PDFs as a first-class input. Visit recording, wearables, consumer-service linking and chat-with-record are left for later. See the table in the competitive section.

**Decision 8: partner hospitals send data in; their doctors get no new screens in Itan.** We rejected hospital sign-in screens and an in-session referral form, because asking staff to type into a second system beside the one they already use is double entry that real hospitals will not adopt. Instead, a partner hospital's existing system sends structured data to a secured, write-only feed for patients who have linked that hospital. The reason and urgency of a referral are recorded in the hospital's own system and carried to Itan. Itan never generates urgency or a reason; for a non-partner hospital they appear only if a photographed letter states them, and are otherwise shown as missing.

Three defaults, open to veto: (a) hospital-sent facts are a third state, *provider-entered*, which the patient cannot edit and can only flag as disputed; (b) a link is standing access, distinct from a per-visit code, granted and revoked by the patient and logged, and the feed comes first while hospitals reading patient-added documents is deferred, since they can use the QR meanwhile; (c) the hospital side is a script that plays a hospital, labelled as simulated on screen, and no partner exists. Hospitals with no EMR cannot take part in this thin form and fall back to a photographed letter.

These are SHOULDs (FR-25 to FR-27) built after the MUSTs. The design and the endpoint are drawn on Friday so the architecture is real even if the build is cut on Saturday.

## Existing solutions

**The headline finding, and it is uncomfortable: a Nigerian product with substantially the same core idea launched on 10 September 2026, two months ago.** Medbankr describes itself as a patient-controlled health platform with an encrypted "Health Vault" holding lab results, prescriptions, scan reports and clinical notes, selective sharing with clinicians, specialists and family caregivers, AI-assisted symptom support, and medication tracking. It is live on the Google Play Store and the Apple App Store. Itan's one-line description is not novel in this market.

I grouped solutions by the user problem they attack, not by product category.

### A. Patient holds the record (direct overlap)

|  | Medbankr | Health Vault NG | Apple Health Records / Google Health | India's ABHA (ABDM) |
| --- | --- | --- | --- | --- |
| Problem solved | History does not follow the patient between facilities | Same | Records scattered across provider portals | National record portability and faster registration |
| Primary users | Nigerian patients; also sold to employers, insurers, universities, HMOs | Nigerian patients | US patients on supported systems | Indian citizens |
| How records get in | Documents into a vault; the launch materials do not state the method | "Upload files or snap a photo of paper results. Health Vault reads and organises them" | FHIR sync from connected health systems; photos and PDFs in some apps | Linked from ABDM-enabled facilities; the 2026 app reportedly also takes uploaded paper documents |
| Sharing with a clinician | Selective sharing with clinicians, specialists, caregivers | Grant access, set duration, revoke; an access history | Google's Smart Health Links generate a URL or QR code for a summary | Consent-based; "Scan and Share" QR at the facility counter |
| Status | Live, both app stores, Sept 2026 | Waitlist only, not launched | Live, not in Nigeria | Live at national scale |
| Verified strength | Breadth: vault, medication, tracking, sharing, AI, in one app | Explicitly NDPA-aligned, offline-aware, built for paper | Automatic sync means no user effort and no transcription error | Scale, and a measured operational result: Scan and Share reduced registration waiting times |
| What I could not verify | Whether extraction is automatic or manual; whether a clinician gets a structured summary rather than documents; whether a referral packet exists; real usage (one third-party tracker shows about 8,500 Play Store downloads, which I could not confirm independently) | Everything beyond the marketing site: no product exists to inspect | Nothing relevant; it does not operate here | Nigerian relevance: it is a precedent, not a competitor |

### B. The institution holds the record and makes it portable

|  | Lagos SHIP (Interswitch e'Clat + Patients Know Best) | Helium Health | Nigeria's NDHA |
| --- | --- | --- | --- |
| What it is | Lagos State health information exchange with a patient-controlled single patient record on the PKB platform, FHIR-based, announced May–June 2025 | EMR and hospital management system; reports operating in seven countries; MyHelium patient app | National architecture with a health information exchange and shared record, endorsed by all 36 states and the FCT |
| Why it matters to us | It is the serious long-term answer to our exact problem, in a neighbouring state, with government backing and real money | Controls the hospital side we have no access to; a health information exchange was reported as "in the works" in 2020 | Will eventually make patient-held capture less necessary |
| Verified limitation | Covers Lagos, not Ogun, and the first stage was described as foundational data hosting. Its value depends on facilities being connected | Serves facilities that buy it; a patient with no Helium-using hospital gets nothing | Minister stated in June 2026 that donor platforms still run independently and sharing remains hard; 43% of PHCs have no electricity |

### C. Adjacent, worth noting

- **ChatGPT Health and Torch.** Torch was acquired by OpenAI in January 2026. ChatGPT Health connects records and explains them. Reported caveat, which is also our risk: a medication can remain in a synced record long after the patient stopped taking it, so synced data is not automatically current.
- **Consumer record apps with OCR** (Sync.MD, My Medical Records.ai and similar). They already do photo capture, OCR and QR sharing. Not Nigerian, but they prove the mechanism is ordinary, not inventive.
- **Clinify and MyItura.** Nigerian patient-record entries found only in MIT Solve listings, so status and traction are unverified.

### What is a documented limitation, and what is merely unverified

- **Documented:** Lagos SHIP is state-scoped and depends on facility connection. The national programme's own minister names fragmentation, power and connectivity as current barriers. Synced records can be stale (OpenAI's own caveat).
- **Reported by researchers:** patient-held records' effect on cross-facility information continuity is the least evaluated function in the literature, and was null in cancer-care trials. This cuts against every product in group A, ours included.
- **Could not be verified:** whether Medbankr turns photographs into structured, clinician-readable facts; whether any of these generates a referral packet; whether any shows each extracted fact beside its source image. I am not calling these gaps. They are unknowns, and one team member downloading Medbankr would resolve most of them in twenty minutes.
- **Our opportunity, stated as opinion:** the clinician's side is the thinnest part of every group A product. They are built for the patient to hold documents. None that I could verify is built around the ninety seconds a Nigerian doctor actually has.

## What the landscape means for us

**1. "A patient-held record for Nigeria" is no longer a differentiator, and claiming it would be a liability.** A judge who searches the phrase during your defence finds Medbankr. The earlier mini pitch answers "isn't this just another EMR?" but has no answer for "Medbankr launched this in September". It needs one, and the honest one is better than a dodge: *they built the vault; we built the handover.*

**2. The crowding is itself evidence that the problem is real.** Two verifiable Nigerian products in 2026 (one launched, one on a waitlist), two more listed only in MIT Solve entries with unverified status, a Lagos State contract with a UK personal-health-record provider, and a federal architecture all point at the same gap. For a contest judged on problem analysis, that strengthens the problem section. It weakens any claim of novelty.

**3. Where a defensible difference remains, narrowly.** Every group A product is built around the patient holding documents. Itan's distinct bet is the other side of the handover, and it is three things together, not one:

- The output is a structured clinical summary a doctor can read in under a minute, not a folder of files to open.
- A referral packet is generated from the record, aimed at the specific fields the LUTH and UCH audits found missing. I found no competitor that does this, though absence of evidence is not evidence of absence.
- Every extracted fact shows its source image and stays unverified until a person confirms it, which is the direct answer to the stale-and-wrong-data risk OpenAI itself names.

**4. An uncomfortable implication for scope.** If the difference is the handover, then the clinician view and the referral packet are the product, and the patient vault is table stakes we build only as far as the demo needs. With two developers this is good news: it tells us what to cut. Any hour spent on medication reminders, vitals tracking or family profiles is an hour spent catching up to Medbankr on the dimension where we cannot win.

**5. Viability, stated plainly.** As a contest entry: viable, because the contest rewards problem analysis, engineering and defence, not market novelty, and we can show a working flow that a specific audit says is broken. As a startup: the earlier "treat it as a startup" ambition now has to contend with a funded-looking competitor two months ahead and a state government building the institutional version. That is not fatal, but it is a different conversation and should not be asserted on a slide without evidence.

**6. The partner-hospital model moves us toward the institutional lane.** Lagos SHIP (Interswitch e'Clat with Patients Know Best, state-backed), Helium Health and India's ABHA already connect facilities. Our thin partner feed is a design direction, not a competitive position. With no partner it is a simulation, and the credible route to scale is partnership with such a platform or a hospital group, not a rival build.

**7. Who would pay is a hypothesis.** Patients are unlikely to pay. The candidate payers are government (federal or state, through the digital health programme) and insurers working under NHIA, and neither is validated. Any payer's access to data must stay consent-based and aggregated, because health data is sensitive personal data. See The Case.

**One action, worth doing before the demo:** install Medbankr, photograph one lab result, and try to share it with someone acting as a doctor. Whatever happens, you will know what your actual difference is instead of guessing, and you can say so in the defence.

### What we borrow from Torch, and what we leave

OpenAI described Torch as unifying lab results, medications and visit recordings, and trade coverage adds that it drew on hospitals, labs, wearables and consumer testing companies. Torch built a normalised record for the patient and an AI to read. Itan uses the record for the person across the desk, so we borrow only what serves that.

| Idea | Decision | Reason |
| --- | --- | --- |
| Visit recording | Leave for later | Needs consent from patient and doctor; audio is sensitive data; processing abroad is a cross-border transfer; already out of scope. A visit summary could later be one more document type |
| Linking lab and consumer services | Borrow the form, not the integration | No integration is available here: SYNLAB Nigeria's portal lets patients view, share and print results, but we found no public API. Accept the lab's digital PDF as a first-class input and test it |
| Apple Health and wearables | Leave | One report puts Android at 86% of smartphone users (search result only); wearables are not central to P1 to P3 |
| Normalised record with last-value comparison | Borrow (FR-24) | Serves the clinician's reading; cheap once values are structured |
| Chat with your record | Leave | Conflicts with NFR-19 (no advice) and competes with ChatGPT Health directly |

*Torch's features are as OpenAI and trade press describe them. We could not inspect the product, and could not confirm that Torch itself linked Function: Function is named as a ChatGPT Health connection.*

## Unique value proposition

**Recommended statement**

> For Nigerian patients being referred or managing a long-term condition, Itan keeps one history that partner hospitals add to directly and any other doctor can read in under a minute without installing anything, with a referral packet that carries the results, reason and urgency the referring doctor recorded.

**Why this one.** It names the user (referred or chronic patients), the problem (the handover, not storage), and a difference that survives the competitive check: the clinician's reading experience and the referral packet, not the vault. "Documented to leave out" is no longer in the statement, because Itan cannot create urgency or a reason that the referring doctor never wrote. On the partner path the hospital's own system supplies them; on any other path they appear only if a photographed letter states them, and the audits suggest that is often not the case (urgency stated in 8.4% of LUTH letters). The partner-hospital feed is simulated in this version, and the pitch must not imply that a partner exists. "Without installing anything" is a real constraint on the receiving side, where a doctor who must create an account simply does not.

**Shorter version for a slide**, which loses the evidence but keeps the point: *Itan turns a patient's paper into a history the next doctor can actually read, and a referral that carries what the referring doctor wrote.*

**Statements I rejected, and why**

| Rejected | Problem |
| --- | --- |
| "A patient-held medical record that any clinic can read" (the current doc's line) | Describes Medbankr equally well. It is a category, not a difference |
| "Nigeria's first patient-owned health record" | False. Medbankr claims first, launched September 2026, and Health Vault NG claims the same category |
| "AI-powered medical memory for Nigeria" | Buzzwords, and it competes with ChatGPT Health on its own ground |
| "Reduces repeated tests and saves patients money" | We have no measurement. Nigerian duplicate testing is unquantified in what we found, so this would be an unsupported health-economic claim |
| "Bridges the gap until the national exchange arrives" | True but weak: it frames the product as temporary, and invites "so why fund you?" |

**One honest caveat to carry into the defence.** The differentiation rests partly on things I could not verify about competitors. If a judge establishes that Medbankr already produces a clinician summary and referral packet, the remaining difference is execution and the provenance model, not the concept. Say that rather than bluff.

## Personas

These are the three from earlier, unchanged in substance. They are composites built from the evidence in the problem statement, not from interviews, and that limits them: nobody has told us what a Nigerian patient actually wants from this. Each persona separates what evidence supports from what we are assuming.

**P1 — Mrs Bisi, 54, trader in Abeokuta. Lives with hypertension and type 2 diabetes.** Uses a government hospital and a nearby private clinic, buys drugs from a pharmacy that keeps no record. Keeps her papers in a plastic folder. Owns an Android phone and uses WhatsApp daily. *Evidence:* about 30.6% of Nigerian adults have hypertension; HbA1c appeared in only 21.7% of referral letters to a specialist diabetes clinic; households pay most health costs directly. *Assumption:* that she will photograph her own documents without help. Untested, and it is the single assumption the product most depends on. *What she needs:* to stop being the memory of her own care.

**P2 — Kunle, 35, takes his father to appointments.** Holds his father's folder, his phone and his queue position. Comfortable with apps. His father is not. *Evidence:* WHO recommends a home-based record for every pregnant woman, and caregiver-held records are the norm in low- and middle-income settings; smartphone ownership is far from universal. *Assumption:* that caregiver-held accounts are acceptable to patients and clinicians. Untested. *What he needs:* to hand a doctor the full picture without narrating it himself.

**P3 — Dr Tunde, 31, medical officer at a busy secondary facility.** Sees a high volume of patients daily. Will not install an app, create an account or attend training for one patient's record. Trusts what he can see the source of. *Evidence:* the audits show what reaches him; the JAMA study (US, so indicative only) found clinicians spending 5–10 minutes searching for missing information in a quarter of affected visits. *Assumption:* that he will accept a browser link from a patient at all. This is the second critical untested assumption, and it decides whether the product has a receiving end. *What he needs:* the medicines, allergies, recent results and the reason for referral, fast, with a way to judge whether to trust them.

**Deliberately not personas:** HMOs, hospital administrators, government. They may be future payers. Building for them now would mean building a different product.

**A new actor, not a new persona: the partner hospital.** Its doctors never use Itan's screens; their own record system sends data. We model it as a system actor with two things, a link to the patient and a feed. The referring doctor is a real user of the hospital's own system, not of Itan, so there is no fourth persona to research, but there is a new untested assumption (A6) about whether a hospital would take part.

**What would make these real.** Fifteen minutes each with one person per persona, before the demo. For P3 especially: show a doctor the clinician screen and ask whether they would open it. A single quote from a real clinician is worth more in the defence than any of this.

## User stories

Grouped by user. Each one connects to an objective from the problem statement. Acceptance criteria are written so a person can check them on the demo set without instrumentation we do not have time to build.

### Patient: getting history in (P1, P2)

**US-1.** As a patient, I want to photograph a lab result and have its values read out for me, so that my history starts without my typing anything. *Acceptance:* a photographed single-page printed lab result produces dated entries with test name, value and the unit as printed; anything the model cannot read is marked unreadable rather than guessed; the original image stays viewable beside every entry.

**US-2.** As a patient, I want to correct what was read wrongly before it becomes part of my history, so that a mistake is not carried into my care. *Acceptance:* every extracted fact shows as unverified until confirmed; a patient can edit the value or delete the fact; confirmed and unverified look different on the clinician's screen too.

**US-3.** As a patient uploading my first document, I want to understand what it says and what to ask my doctor, so that the app is worth something to me before I have a full archive. *Acceptance:* a result outside the reference range printed on the document is identified as outside that range, in plain language; two or three questions to ask are offered; no interpretation, cause or diagnosis is given; a line states this is not medical advice. *This story exists because of the cold-start finding and is the main defence against the "empty app" problem.*

**US-4.** As a caregiver, I want to hold a record on behalf of my father, so that the person who carries the folder is the person who holds the record. *Acceptance:* a record can be labelled as held on behalf of someone, and that label appears on the clinician view. *Scope note: one caregiver, one dependant; no invitations or transfers.*

### Patient: controlling who sees it (P1, P2)

**US-5.** As a patient at a clinic, I want to give this doctor access for this visit only, so that I am not permanently exposed by one consultation. *Acceptance:* a code or QR is generated in under five seconds, expires after a set period, can be revoked immediately, and a revoked or expired code shows a refusal rather than stale content.

**US-6.** As a patient, I want to see who opened my record and when, so that I can tell whether my consent was respected. *Acceptance:* every successful access writes an entry with time, and the name and practice number entered by the viewer; the patient can read this list; entries cannot be deleted from the patient view.

**US-7.** As a patient, I want to hide sensitive parts of my history before sharing, so that I can get care without disclosing everything. *Acceptance:* a patient can exclude a category or an individual document from a share; the clinician view states that the patient has hidden some items, without naming them, so the doctor knows the record is partial.

### Clinician: reading and acting (P3)

**US-8.** As a receiving doctor, I want the patient's current medicines, allergies, diagnoses and recent results on one screen, so that I can take a history in a fraction of the usual time. *Acceptance:* opening a valid code shows a single screen with those four groups, each item dated, without scrolling past the first screen for the four headline groups; the full timeline is one tap away; no installation or account is required.

**US-9.** As a receiving doctor, I want to see where each fact came from and whether anyone confirmed it, so that I can decide how much to trust it. *Acceptance:* every item on the clinician view carries its source document and its confirmed or unverified state; tapping an item shows the original image.

**US-13.** As a receiving doctor, I want to see the previous value and its date beside the latest for any repeated test, so that I can see at a glance what has changed since the last record. *Acceptance:* a test with two or more values shows the latest and the previous with their dates; a test with one value shows no comparison; no wording implies better or worse; both values keep their source images and confirmed state.

**US-10.** As a receiving doctor at any facility, I want a referral packet that carries the results, reason and urgency recorded by the referring doctor, so that I do not depend on a letter that may have left them out. *Acceptance:* the packet contains the fields the audits found missing (investigation results, urgency, current medicines, allergies, reason for referral, referring clinician and date); missing fields are shown as missing rather than omitted silently; the packet can be opened by the receiving side through a link or code. For a referral sent by a linked partner hospital, reason and urgency appear as entered by that facility; for any other referral they appear only if read from a photographed letter, and are otherwise shown as missing.

**US-11.** As a receiving facility, I want to acknowledge a referral, so that the patient knows the destination has seen it before travelling. *Acceptance:* acknowledgement records that the referral was received and that the service is offered there; the wording never states or implies that a bed is available. *Simulated in this version, and labelled as simulated on screen.*

### Cross-cutting

**US-12.** As a patient on a slow or intermittent connection, I want my upload to survive a dropout, so that I do not lose the document or my place. *Acceptance:* an upload interrupted mid-way resumes or queues and completes without the patient re-photographing; the interface states what is pending.

### Partner hospitals (added 12 Nov)

**US-14.** As a patient who attends a partner hospital, I want to link that hospital to my record, so that its results, medicines and referrals appear without my photographing them. *Acceptance:* the patient generates a one-time link code; once the (simulated) hospital presents it, the hospital shows as linked; the patient can revoke the link; every link, revocation and delivery appears in the access log.

**US-15.** As a patient, I want to see which facts my hospital sent and which I added, so that I know what I may change and what I may only question. *Acceptance:* hospital-sent facts show the facility's name and have no edit control; the patient can flag one as disputed; the flag shows on the clinician view.

**US-16.** As a doctor at a partner hospital, I want to record the reason and urgency of a referral in my own system, so that they travel with the patient and I do not depend on a letter that may leave them out. *Acceptance:* a referral posted for a linked patient appears in the record with reason, urgency, the referring clinician's name, facility and date; it is refused for an unlinked or revoked patient; Itan offers this doctor no screen to fill in; the packet never contains an urgency that nobody recorded. *Simulated in this version.*

**Deliberately not stories.** Medication reminders, vitals tracking, family profiles, symptom checking, appointment booking, insurance, a doctor's dashboard across patients. Each is defensible on its own and all of them together are how two developers ship nothing. They are also the dimension on which a two-month-old funded competitor already wins.

## Functional requirements

Prioritised against two developers and five days. The MUST list is the smallest set that demonstrates the value proposition end to end; if any MUST is dropped, the demo stops making its argument. There are 14 MUSTs, which is already ambitious for the time available.

| ID | Requirement | Pri | Rationale | From | Acceptance condition |
| --- | --- | --- | --- | --- | --- |
| FR-01 | A patient can create an account and sign in | MUST | The record must belong to someone | US-1 | A new account can be created and signed back into on a second device |
| FR-02 | A patient can capture a document by photo or file upload | MUST | The only input channel that works on paper | US-1 | A photo taken on a phone and a PDF both reach the system and are retrievable, including a digital PDF exactly as a lab portal issued it |
| FR-03 | The system extracts structured facts (test name, value, unit, date, medicine, dose, allergy, diagnosis, facility) from a captured document | MUST | This is the product's core transformation | US-1 | On the demo set, each document yields its facts in the defined fields |
| FR-04 | Anything the model cannot read with confidence is marked unreadable rather than guessed | MUST | A confident wrong dose is the single worst failure this product can produce | US-1, Obj 3 | On a deliberately blurred document, unreadable fields are flagged, not invented |
| FR-05 | Every extracted fact stores and displays a link to its source image | MUST | Provenance is the differentiator and the safety mechanism | US-2, US-9 | Every fact on both patient and clinician views opens its original image |
| FR-06 | Facts are unverified until the patient confirms them; the state is visible on every view | MUST | Human oversight, and honesty to the reading clinician | US-2, Obj 3 | A new fact shows unverified; after confirmation it shows confirmed on the clinician view too |
| FR-07 | A patient can edit or delete an extracted fact | MUST | Correction must be possible before it reaches a doctor | US-2 | An edited value persists and the original image remains attached |
| FR-08 | Facts appear on a dated timeline | MUST | A history is chronological or it is a pile of files | US-1 | Entries from several documents appear in date order |
| FR-09 | For a lab result, the system produces a plain-language explanation of what was measured, identifies values outside the reference range printed on that document, and offers questions to ask a doctor | MUST | Answers the cold-start problem: the first document must pay for itself | US-3, Decision 5 | On a demo result with an out-of-range value, the value is identified as outside the printed range and questions appear, with no cause or diagnosis stated |
| FR-10 | A patient can generate an access code or QR that expires | MUST | The consent mechanism and the clinician's entry point | US-5 | A code opens the record; after expiry the same code is refused |
| FR-11 | A patient can revoke an active code immediately | MUST | Consent that cannot be withdrawn is not consent | US-5 | A revoked code is refused on the next request |
| FR-12 | A clinician opening a valid code sees one screen with current medicines, allergies, diagnoses and recent results, each dated, with no installation or account | MUST | The value proposition itself | US-8 | A person who has never used the system reads the four groups without scrolling or signing up |
| FR-13 | Each access writes a log entry (time, name and practice number entered) that the patient can read | MUST | Required by the confidentiality consideration; also the patient's only accountability | US-6, NFR-01 | After two accesses, both appear in the patient's log |
| FR-14 | A referral packet is generated from the record containing results, urgency, medicines, allergies, reason for referral, referring clinician and date, showing missing fields as missing; reason and urgency are carried from a source and never generated | MUST | The second half of the differentiation, aimed at the audited gaps | US-10 | A generated packet shows all seven fields, with absent ones labelled missing; reason and urgency are never produced by the system, only carried from a partner's referral or read from a photographed letter |
| FR-15 | A patient can exclude a document or category from a share, and the clinician view states that some items are hidden | SHOULD | Privacy design in the project docs; honesty to the clinician matters as much as the hiding | US-7 | A hidden document does not appear; the clinician view shows the partial-record notice |
| FR-16 | Uploads queue and resume across a connection drop | SHOULD | Low-bandwidth consideration; cheap if designed in, expensive if retrofitted | US-12, NFR-12 | With the network disabled mid-upload then restored, the document completes without re-capture |
| FR-17 | A drug–allergy mismatch between a recorded allergy and a recorded medicine shows a non-blocking flag advising the patient to check with a doctor | SHOULD | In the demo script, but needs a reference list and gives no clinical benefit if wrong | US-8, Decision 3 | A seeded pair produces a flag; the flag states it is not advice |
| FR-18 | A record can be marked as held by a caregiver on behalf of a dependant | SHOULD | P2 is a real access route for patients without phones | US-4 | The clinician view shows who holds the record |
| FR-19 | A receiving facility can acknowledge a referral, worded as received and service offered | SHOULD | Closes the referral loop in the demo; simulated | US-11, Decision 2 | Acknowledgement appears to the referrer; the wording makes no bed claim |
| FR-20 | A short static list of facilities can be chosen from when referring | SHOULD | Needed for a believable referral demo; pure data entry | US-10 | A destination can be selected and appears on the packet |
| FR-24 | For any test with two or more values in the record, the clinician view shows the previous value and its date beside the latest, with no wording that says better or worse | SHOULD | The Torch idea worth borrowing: a normalised longitudinal record, aimed at the clinician's reading. Cheap once values are structured; differentiates more than FR-17 and needs no reference list | US-13 | A demo record with two HbA1c values shows both with dates on the clinician view; a test with one value shows no comparison; no improved or worsened wording appears |
| FR-25 | A patient can link a hospital with a one-time code, see which hospitals are linked, and revoke a link; the link and every delivery from that hospital appear in the patient's access log | SHOULD | The consent step for the partner path: a hospital adds only to what a patient has linked it to | US-14, Decision 8 | A generated code links a (simulated) hospital once and then expires; the hospital appears as linked; after revocation the next delivery is refused and the revocation is logged |
| FR-26 | A secured, write-only feed accepts structured results, medicines, allergies, diagnoses and referrals from a hospital for a patient who has linked it, stores each as provider-entered with the facility name and date, and refuses every other request | SHOULD | Lets a partner hospital add to the record from its own system, so its patients photograph nothing and its doctors change nothing. Supplies the reason and urgency that photographs cannot. The demo plays the hospital with a script | US-14, US-16, Decision 8 | A post for a linked patient appears in the record with the facility's name; posts for an unlinked patient, a revoked link or a wrong credential are refused with no record content in the response; the feed cannot read any record |
| FR-27 | Provider-entered facts show their origin on every view; the patient cannot edit or delete them but can flag them as disputed, and the flag shows on the clinician view | SHOULD | Stops a patient altering what a doctor wrote, while keeping the patient's right to challenge it | US-15 | A hospital-sent fact shows the facility's name and no edit control; after a flag, the clinician view shows it as disputed by the patient |
| FR-21 | A patient can export or print the record as a PDF | COULD | Useful in reality where phones fail; not needed to prove the argument | US-8 | A PDF is produced |
| FR-22 | Search across the timeline | COULD | Only matters once a record is large, which no demo record will be | US-8 | A term returns matching entries |
| FR-23 | A clinician can add a note back to the record | COULD | Attractive, but it turns a patient record into a clinical system and raises oversight questions we cannot answer in five days | — | Deferred |

**Cut order if we fall behind**, worst first to cut: FR-22, FR-21, FR-18, FR-20, FR-17, FR-24, FR-19, FR-27, then FR-25 and FR-26 together, then FR-15 and FR-16. FR-25 and FR-26 are the first SHOULDs to build, then FR-24, because they answer the biggest gap in the referral flow; they are useless apart, so they are cut together. FR-24 is cut after FR-17 because it differentiates more, needs no reference list and carries less clinical risk. Nothing in FR-01 to FR-14 is cuttable without dropping the argument. If the time runs out inside the MUST list, cut the *breadth of document types* instead (printed only, one layout), not the integrity requirements FR-04, FR-05 and FR-06.

**Two requirements I argued against including.** FR-17 (drug–allergy) is a safety-adjacent feature with no clinical validation behind it; it survives only because it is in the agreed demo and is non-blocking. FR-23 is excluded outright: letting clinicians write into the record changes the regulatory posture of the product.

## Non-functional requirements

The seven considerations are taken verbatim from section 4C of the NCS preparation guidelines, in their order. Each one separates what the law obliges, what is recommended practice, and what is simply our engineering target. Numeric thresholds marked **proposed** are ours and have no external authority; they are validated or revised after the extraction test.

### 1. Patient confidentiality and data protection

*Relevance:* Itan concentrates a person's whole history in one place and makes it shareable, which is the product's value and its principal risk. *Attribute:* confidentiality.

**Regulatory (Nigeria Data Protection Act 2023, per a law-firm summary of sections 24–39; we have not read the statute and are not lawyers).** Health data is sensitive personal data requiring explicit consent or another lawful ground; processing principles include data minimisation, purpose limitation and storage limitation; a breach likely to risk individuals' rights must be notified to the Commission within 72 hours; cross-border transfer requires adequate protection in the receiving jurisdiction. *That last point has a direct design consequence we should state in the defence: sending document images to an AI service hosted abroad is a cross-border transfer of sensitive data.*

- **NFR-01.** Nothing is shared by default; every disclosure is an explicit, patient-initiated, time-limited act. *Verified by:* attempting to read a record without a valid code, which must fail.
- **NFR-02.** Data is encrypted in transit (HTTPS/TLS) and at rest; no real patient data is used at any point in the contest. *Verified by:* checking the connection, confirming storage encryption, and inspecting the demo data set for provenance.
- **NFR-03.** The consent screen states, before first capture, that document images are processed by a third-party AI service, names the country of processing if known, and says what is retained. *Verified by:* the screen exists and a reader can state those three facts after reading it.

### 2. Secure authentication and appropriate access controls

*Relevance:* two very different actors, one long-lived (patient), one momentary (clinician). *Attribute:* security, specifically authorisation.

**Our engineering targets, not obligations.**

- **NFR-04.** Patient accounts use a password of at least 8 characters with credentials stored only as a salted hash. *Verified by:* inspecting the stored record for the absence of plaintext.
- **NFR-05.** Access codes are randomly generated with at least 2^40 possible values, single-record scoped, expiring by default within 60 minutes (**proposed**), and revocable; expired or revoked codes return a refusal carrying no record content. *Verified by:* a direct test of each of the four states.
- **NFR-06.** No record content is reachable through a URL that does not carry a valid unexpired credential, including by guessing a record identifier. *Verified by:* requesting a known record id without a code and confirming refusal.

### 3. Accessibility for users with different abilities

*Relevance:* P1 is 54 and may have diabetic retinopathy; clinicians read in bad light. *Attribute:* usability.

**Recommended practice: WCAG 2.1 Level AA** (W3C, an international recommendation; not Nigerian law, and we should not imply it is). We target a subset honestly rather than claiming full conformance.

- **NFR-07.** Body text at least 16px and resizable to 200% without loss of content or function; contrast at least 4.5:1 for normal text; every control reachable and labelled for a screen reader; no information conveyed by colour alone. *Verified by:* browser zoom to 200%, an automated contrast check, and one pass with a screen reader on the patient capture flow and the clinician view.
- **NFR-08.** The clinician view is legible on a 360px-wide screen without horizontal scrolling. *Verified by:* device emulation at 360px.

### 4. Low-bandwidth and offline functionality

*Relevance:* the minister's own figures put about 60% of rural primary facilities without internet; this is the consideration most likely to decide whether the product works where it is needed. *Attribute:* performance and resilience.

**All thresholds below are proposed targets of ours.**

- **NFR-09.** Photos are compressed on the device before upload, to a target of 500KB or less per page while remaining readable by the extractor. *Verified by:* measuring the bytes sent and re-running extraction on the compressed image.
- **NFR-10.** Extraction completes within 30 seconds for a single page on a connection throttled to 3G (**proposed**, per Decision 4). *Verified by:* browser network throttling over five demo documents, reporting the slowest.
- **NFR-11.** The clinician view's first screen transfers under 300KB and renders within 5 seconds on throttled 3G. *Verified by:* the same throttled test.
- **NFR-12.** An upload interrupted by connection loss resumes or queues without the patient re-capturing. *Verified by:* disabling the network mid-upload and restoring it.

### 5. Responsible use of AI and disclosure of its limitations

*Relevance:* an AI reads clinical values off paper, and a confident error here can change treatment. *Attribute:* safety and transparency.

**Recommended frameworks, named accurately:** the WHO 2021 guidance on ethics and governance of AI for health, and the NIST AI Risk Management Framework (US, voluntary). Neither binds us; both are defensible to cite as the practice we followed. *I have not re-read either document in this session, so treat the citation as a pointer, not as a summary of their contents.*

- **NFR-13.** Every screen showing AI-derived content states that it was read by AI and may contain errors, and that it is not medical advice. *Verified by:* inspecting each such screen.
- **NFR-14.** The known-limitations list is written and published with the project, stating document types tested, measured accuracy, failure modes and what the system does not do. *Verified by:* the document exists and its numbers come from the extraction test, not from estimates.
- **NFR-15.** Zero confident critical errors on the test set, where a critical error is a wrong medicine name, dose, or allergy presented as confident. *Verified by:* scoring the extraction test against an answer key. *This is a stop condition: if it fails, the demo restricts itself to document types where it passes.*

### 6. Appropriate validation of medical information

*Relevance:* extracted values become the basis of a clinical conversation. *Attribute:* data integrity.

- **NFR-16.** No clinical fact reaches a clinician view without a visible provenance chain: source image, extraction date, and confirmed or unverified state. *Verified by:* inspecting every item type on the clinician view.
- **NFR-17.** Reference ranges are only ever those printed on the patient's own document; the system holds no reference range table of its own and never substitutes one. *Verified by:* code inspection and a document whose printed range is unusual.
- **NFR-18.** Units are preserved exactly as printed and never converted. *Verified by:* a document using a less common unit.

### 7. Human clinical oversight

*Relevance:* the guidelines require it where medical decisions are involved. *Attribute:* accountability.

- **NFR-19.** The system makes no diagnosis, no treatment recommendation, and no triage or urgency judgment of its own; urgency in a referral packet is entered by the referring clinician. *Verified by:* reviewing every output string for advice language.
- **NFR-20.** Plain-language explanations (FR-09) restate what the document says and never state a cause, diagnosis or action beyond "discuss with your doctor". *Verified by:* a review of generated explanations across the demo set by someone with clinical knowledge.
- **NFR-21.** The drug–allergy flag (FR-17), if built, is advisory and non-blocking, and tells the patient to confirm with a clinician. *Verified by:* confirming no workflow is blocked and the wording is advisory.

### Added 12 Nov: the partner-hospital path

These extend considerations 2, 1 and 6 and stand alone so the earlier numbering is unchanged.

- **NFR-22** (authentication and access control). The feed is write-only and scoped: a facility credential can add records for patients who have linked that facility and cannot read any record. *Verified by:* attempting a read, a post for an unlinked patient and a post with a wrong credential; all must fail.
- **NFR-23** (confidentiality). A link is an explicit patient act, revocable at any time and logged; a revoked link refuses the next delivery. *Regulatory note:* health data is sensitive personal data needing explicit consent, and a hospital that sends us patient data is itself a data controller. Whether Itan is its processor or a separate controller is a legal question we have not answered. *Verified by:* link, revoke, then post.
- **NFR-24** (validation of medical information). Provider-entered facts keep their facility, timestamp and original content, and the patient cannot alter them; a patient dispute is recorded beside the fact, never in place of it. *Verified by:* trying to edit a hospital-sent fact, then checking the stored original after a dispute.

**The honest gap.** NFR-20 says "someone with clinical knowledge", and the team has no clinician. Either one is found to review the generated explanations before the demo, or the limitations list states plainly that no clinician reviewed them. The second is acceptable; pretending otherwise is not.

## Scope

**What the first version will do.** One patient journey, end to end: sign in, capture a document by photo or file, extraction into structured facts with the source image attached and an unverified state, correction by the patient, a plain-language explanation of a first lab result with questions to ask, a dated timeline, an expiring revocable share code, a one-screen clinician view with provenance, an access log the patient reads, and a referral packet built from the record that names its missing fields. That is FR-01 to FR-14. Beyond them, as SHOULDs built after the MUSTs: a patient can link a hospital, a simulated partner system can send results and referrals into the record with the hospital as author, and hospital-sent facts are labelled and cannot be edited by the patient (FR-25 to FR-27).

**What it will not do.** No real integration with any hospital or laboratory system (the partner side is a simulation and no partner exists), no hospital reading of patient-added documents, no connection to the national exchange, no HMO or insurance flow, no visit recording or transcription, no WhatsApp capture, no live bed capacity, no native mobile app, no clinician accounts or verification against a practice register, no clinician writing into the record, no medication reminders, no vitals tracking, no symptom checking, no appointment booking, no multi-dependant family profiles, no payments, no analytics dashboard.

**Deferred deliberately, with the reason:** clinician verification against a register (no accessible source); referral acknowledgement as a real transaction (needs a receiving institution); a real partner-hospital integration and hospital reading of patient-added documents (needs a hospital, its record-system vendor and a legal basis); the facility directory with services (data entry with no product logic); handwriting support (pending the extraction test); search and PDF export (only matter at a record size no demo reaches).

**Future directions, none validated and none in this version:** less clerking (designed for, to be measured first); trends over time (FR-24 is the first step); structuring radiologists' written reports; AI reading of images or complex results, which would be a regulated medical-device product and conflicts with NFR-19 until validated; and payer-facing insight using only consented, aggregated data. See The Case.

**Users included in the first version:** the patient (P1), the caregiver holding on behalf of one dependant (P2, through FR-18 if it survives), and the receiving clinician (P3) as a reader only. A partner hospital is a system actor, simulated in this version. **Excluded:** referring clinicians as account holders in Itan (a partner's doctors use their own system, not ours), facility staff screens, administrators, HMOs.

**Dependencies and constraints, honestly stated**

|  | Detail | Risk if it fails |
| --- | --- | --- |
| Two developers, five days | 12–17 Nov, alongside other commitments | The MUST list is 14 items. This is the dominant risk in the project |
| A third-party AI service for extraction | Needs a key, credit, and acceptable latency. Also a cross-border transfer of sensitive data (NFR-01 note) | No extraction means no product. There is no fallback |
| The extraction test has not been run | Decides printed-only versus handwriting, and sets the accuracy target in NFR-15 | Scope may need to shrink after the fact, which is worse than shrinking now |
| Demo documents must be created or fully anonymised | No real patient data at any point | A privacy failure in a healthcare contest is disqualifying, not embarrassing |
| Organisers' repo, deadline 17 Nov | Registration and repo access unconfirmed | Code not submitted |
| Judging criteria unknown | Success criteria below are aligned to the guidelines, not to the actual rubric | Effort misallocated |
| Venue conditions unknown | Power, projector, internet at Chrisland | A live demo that needs the network could fail on stage; a recorded backup is a Stage 6 requirement |
| Partner hospital (simulated) | No partner exists; the feed is shown by a script playing a hospital. Whether any hospital would send data to a patient-held record is untested | Presenting the simulation as real would be a false claim in a healthcare contest. The pitch must say it is simulated |

**My scope recommendation, as a reviewer.** The MUST list is at the edge of what two people can do in five days, and it has no slack. If by Saturday the extraction pipeline is not returning structured facts reliably, drop FR-09 (plain-language explanation) and FR-14 (referral packet) to SHOULD and ship the capture-to-clinician path alone. A complete thin flow defends well. A broad broken one does not. The partner feed (FR-25 to FR-27) is the first thing to decide on Saturday. If it is cut, the demo's referral packet takes its reason and urgency from a photographed referral letter, and the pitch says the partner path is the architecture, not the demo.

## Success criteria

Three different things get confused as "success". They are separated here, and only the first two are achievable before 17 November. No baseline figure is invented: where a number is missing, the criterion says how to establish it.

### A. Functionality completed (the product exists)

| Metric | Target | Method | When |
| --- | --- | --- | --- |
| MUST requirements passing their acceptance condition | 14 of 14 | Walk the acceptance column, one by one, recording pass or fail | Sat 15, then Mon 16 |
| The demo journey completes without manual intervention | 3 consecutive clean runs | Run it end to end on the demo device | Mon 16 |
| Code in the organisers' repo with a README that installs from scratch | Yes | A person who has not seen it follows the README on a clean machine | Tue 17 |
| Section D documentation items assembled | 11 of 11 | Checklist against the guidelines | Tue 17 |
| SHOULD requirements FR-25 to FR-27 passing their acceptance conditions | 3 of 3 if built; otherwise reported as not built | Walk the acceptance column | Mon 16 |

### B. Technical performance demonstrated (it works under the conditions it claims)

| Metric | Target | Method | When |
| --- | --- | --- | --- |
| Extraction accuracy on printed documents | **No target yet.** The extraction test establishes the baseline; the target is then set at or above it and reported honestly either way | Score the test set against an answer key: correct, missed, flagged unreadable, wrong; the set includes photographed paper and at least two lab-issued digital PDFs, scored separately | Extraction test, before the build hardens |
| Confident critical errors (wrong medicine, dose or allergy, presented as confident) | 0 | Same scoring run, counted separately | Same |
| Extraction latency, single page, throttled 3G | ≤30s (**proposed**) | Browser throttling, 5 documents, report the slowest | Sat 15 |
| Clinician first screen on throttled 3G | <300KB, <5s | Same | Sat 15 |
| Accessibility subset (NFR-07) | All four checks pass on the two main screens | 200% zoom, contrast checker, screen-reader pass, colour-only review | Sun 16 |
| Unauthorised access attempts refused | 4 of 4 (no code, wrong code, expired, revoked) | Direct test of each | Sun 16 |
| Feed refusals: a read attempt, an unlinked patient, a revoked link, a wrong credential | 4 of 4 refused with no record content | Direct test of each | Sun 16 |

### C. User value validated (it actually helps someone)

**None of this can be claimed by 17 November, and the defence should say so.** These are how the claim would be tested, not results we will have.

| Question | How it would be measured | Why we cannot answer it yet |
| --- | --- | --- |
| Does a referral packet carry more than a letter? | Score generated packets against the LUTH audit fields and compare with a local sample of real letters scored the same way | Needs a facility's permission and anonymised letters. The comparison is the strongest evidence available to this project and still costs only an afternoon |
| Will a doctor open a patient's link? | Show the clinician view to 3–5 clinicians and record whether they would use it, and what is missing | No clinician has seen it |
| Will a patient photograph their own documents? | Watch 3–5 people attempt it unaided and count how many succeed without help | Untested; this assumption carries the product |
| Does it reduce repeated tests? | A prospective study comparing patients with and without the record | Out of reach, and no Nigerian baseline for duplicate testing exists in what we found. **Do not claim this on a slide** |
| Would a hospital send data to a patient-held record, and in what format? | One conversation with a hospital records or IT officer, noting what their system can export | No hospital has been asked. The partner path is a design, not evidence |

**The single most valuable thing you could add before the contest** is the first row of section C: twenty real anonymised referral letters, scored against the same fields your packet fills. It converts the whole project from "we built something" to "we measured the gap and closed it", which is exactly what the guidelines ask teams to demonstrate.

## Assumptions, risks and open questions

### Assumptions carrying the product

| # | Assumption | If wrong | How to test cheaply |
| --- | --- | --- | --- |
| A1 | Patients will photograph their own documents unaided | The product needs a caregiver or a records officer, which changes the design | Watch 3–5 people try it |
| A2 | A clinician will open a link handed over by a patient | There is no receiving end, and the value proposition collapses | Show it to 3–5 clinicians |
| A3 | AI extraction is accurate enough on Nigerian printed documents | Scope shrinks to a narrower document set, or the product becomes manual entry | **The extraction test. Not yet run** |
| A4 | People being referred or with chronic conditions have enough documents for the record to be useful | Even the cold-start fix is not enough | Ask five people what is in their folder |
| A5 | Our differentiation (clinician summary, referral packet, provenance) is not already in Medbankr | The unique value proposition needs rewriting | Install Medbankr and try it |
| A6 | A hospital would send data to a patient-held record | The partner path is only a diagram, and the simulation says nothing about real adoption | One conversation with a hospital records or IT officer |
| A7 | A hospital's existing system can send structured results, medicines and referrals in a usable format | Each vendor needs its own adapter, which is beyond a team of two | Ask what the system can export, and whether it supports FHIR or simple JSON |

### Risks

| # | Risk | Likelihood | Impact | Response |
| --- | --- | --- | --- | --- |
| R1 | Two developers cannot finish 14 MUSTs in five days | High | Severe | The cut order in the requirements section; decide on Saturday, not Monday night |
| R2 | Extraction produces a confident wrong dose or allergy during the demo | Medium | Severe, and in front of healthcare judges | NFR-15 as a stop condition; unverified state on every fact; rehearse with the actual demo documents |
| R3 | A judge raises Medbankr | Medium | Moderate | Prepare the honest answer now; it is a strength if handled well and a collapse if improvised |
| R4 | Real patient data enters the demo set by accident | Low | Severe, and disqualifying in a healthcare contest | Create or fully anonymise every document; one person checks the set before the demo |
| R5 | Live demo fails on venue internet | Medium | Moderate | Recorded backup video, required by Stage 6 |
| R6 | Cross-border transfer of health data to an AI service is challenged | Low at contest, real later | Moderate | Disclose it on the consent screen and name it in the limitations rather than hoping it is missed |
| R7 | No clinician reviews the generated explanations | High | Moderate | Find one, or state in the limitations that none did |
| R8 | The legal position of hosting hospital-originated health data is unclear | Medium | Moderate at the contest, severe at launch | Say so in the limitations; take legal advice before any real partner; no real data in the contest |
| R9 | The simulated partner path is read as real adoption | Medium | Severe in a healthcare contest | Label the simulation on screen and in the pitch; use the claims table in The Case |
| R10 | The partner feed takes build time from extraction | Medium | Severe | Design on Friday, decide on Saturday; the fallback is a photographed referral letter |

### Open questions

**For the organisers:** judging criteria and weights; demo length and whether there is Q\&A; submission format beyond code; repo access confirmation; whether AI APIs are permitted; venue power and internet.

**For the team:** who builds which half; whether an AI API key and credits are in hand; who owns the extraction test and when it runs; whether anyone can reach a clinician to review explanations and the clinician view. Also whether anyone can reach one hospital records or IT officer to ask whether they would send data to a patient-held record, and in what format.

**For research:** whether Medbankr produces a clinician summary or referral packet; whether any local referral letters can be scored; what the Data Protection Act actually says, read from the statute rather than a summary, before any claim of compliance.

### Weaknesses in the existing problem statement that this stage did not fix

- The duplicate-testing claim still rests on one press anecdote. It is used in the pitch as though measured. It should be stated as illustrative.
- No Ogun State evidence exists anywhere in the project, in a contest held in Ogun State.
- The referral audits are 13 and 9 years old.
- The problem statement's objective 2 already says the comparison with the LUTH audit is not like-for-like, and the success criteria above keep that caveat. Two other passages need narrowing after the competitor research: the "unmet need" wording in its five-component check, and the closing "our reading" sentence of its Relevance paragraph.

## Source register

Research for this stage was done on 12 November 2026. Sources for the problem statement itself are in that document's own register and are not repeated. **Verification key:** *Page read* = the page's text was opened and read; *Search result* = only the search-result text was seen; *Blocked* = the page refused automated access.

| Source | Type | Date | URL | Supports | Verification |
| --- | --- | --- | --- | --- | --- |
| BusinessDay, "Medbankr targets Nigeria's fragmented health records" | News | 12 Sep 2026 | [link](https://businessday.ng/health/article/medbankr-targets-nigerias-fragmented-health-records-with-patient-owned-data/) | Medbankr launch date, vault contents, selective sharing, AI symptom support, institutional buyers, CEO named, no user numbers disclosed | Page read |
| TechCabal, Medbankr launch announcement | Company announcement via press | 10 Sep 2026 | [link](https://techcabal.com/2026/09/10/medbankr-launches-to-solve-nigerias-invisible-healthcare-crisis-the-one-nobody-talks-about/) | "Nigeria's first patient-controlled health continuity and intelligence platform"; availability on both app stores | Blocked; search-result text only |
| Innovation Village, Medbankr | Sponsored post | 9 Sep 2026 | [link](https://innovation-village.com/medbankr-launches-platform-to-give-nigerians-lifelong-control-of-their-medical-records/) | The five capabilities, Health Vault description | Search result. **Sponsored content, so it is the company's claims, not independent** |
| Chrome-Stats listing for the Medbankr Android app | Third-party app tracker | 18 Oct 2026 | [link](https://chrome-stats.com/d/com.medbankr.app) | Feature list; approximately 8,484 downloads; explicit "does not provide medical advice" | Search result. **Third-party tracker; download figure unconfirmed** |
| Health Vault NG site | Company marketing site | Accessed 12 Nov 2026 | [link](https://www.healthvaultng.com/) | Photo capture with automatic organising, time-limited access with revocation, access history, NDPA alignment claim, built for paper and poor connectivity | Page read. **Waitlist only; no product verified to exist** |
| Patients Know Best announcement | Company announcement | 2 Jun 2025 | [link](https://patientsknowbest.com/2025/06/02/patients-know-best-wins-single-patient-record-contract-for-lagos/) | PKB supplying the single patient record for Lagos; FHIR APIs; integrates provider, device and patient-contributed data | Search result |
| HTN, PKB wins Lagos contract | Trade press | 2025 | [link](https://htn.co.uk/?p=73129) | First stage focuses on foundational data hosting | Search result |
| BusinessDay, Lagos SHIP | News | undated in result | [link](https://businessday.ng/health/article/lagos-interswitch-partner-to-build-digital-medical-records-platform/) | SHIP as a health information exchange adopting FHIR; patient tracking across providers; e-prescription | Search result |
| Techpoint, Interswitch eClat and Lagos | News | undated in result | [link](https://techpoint.africa/news/interswitchs-eclat-lagos-health) | eClat acquired by Interswitch in 2019; claim of 250 facilities using its EHR | Search result |
| Y Combinator company page, Helium Health | Company profile | undated | [link](https://www.ycombinator.com/companies/helium-health) | Founded 2016; EMR/HMIS for providers, payers and patients | Search result |
| TechCabal, "The BackEnd: Helium Health" | News | 13 Aug 2020 | [link](https://techcabal.com/2020/08/13/the-backend-helium-health/) | Helium's health information exchange described as in development in 2020 | Search result |
| National Health Authority (India), Scan and Share onboarding manual | Government document | 18 Jan 2023 | [link](https://abdm.gov.in/strapicms/uploads/ABDM_Scan_and_Share_Onboarding_Manual_18_01_2023_1_0600fe7747.pdf) | ABHA as a 14-digit identifier; QR-based sharing at facility counters; consent model | Search result |
| Press Information Bureau (India) | Government document | 2026 | [link](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jul/doc202676912801.pdf) | Portability of records at ABDM-enabled facilities; an IIHMR study finding Scan and Share reduced waiting times | Search result. The magnitude of the reduction was cut off in the text returned |
| Digital Trends, Google Health 5.05 | Tech press | 2026 | [link](https://www.digitaltrends.com/?p=5995311) | Smart Health Links: sharing a record summary by URL or QR; Google states it does not replace official records | Search result |
| AI News, OpenAI ChatGPT Health | Tech press | 24 Jul 2026 | [link](https://www.artificialintelligence-news.com/news/openai-pushes-chatgpt-into-patient-health-records/) | ChatGPT Health connects Apple Health and medical records; OpenAI's own caveat that a synced medication may be stale | Search result |
| Sync.MD App Store listing | Product listing | undated | [link](https://apps.apple.com/us/app/-/id1435733695) | Consumer PHR apps already do camera capture, OCR and QR sharing to clinicians | Search result |
| NCS ITDC 2026 preparation guidelines, section 4C | Contest document | 2026 | Project knowledge | The seven healthcare considerations, verbatim | Read in full |
| Lexworth summary of the Nigeria Data Protection Act 2023 | Law-firm commentary | 18 Sep 2023 | [link](https://www.mondaq.com/nigeria/data-protection/1366934/the-nigerias-data-protection-act-2023-a-look-at-key-provisions) | Health data as sensitive personal data; explicit consent; 72-hour breach notification; cross-border transfer conditions | Page read. **A summary, not the statute. Not legal advice** |
| eWeek, OpenAI strengthens ChatGPT Health plans with Torch acquisition | Tech press | Jan 2026 | [link](https://www.eweek.com/news/openai-buys-torch/) | OpenAI's wording: Torch unifies lab results, medications and visit recordings; aggregates data from hospitals, labs, wearables and consumer testing companies | Search result |
| TechInformed, OpenAI buys health data startup Torch | Tech press | Jan 2026 | [link](https://techinformed.com/openai-buys-health-data-startup-torch-as-it-turns-chatgpt-health-into-a-records-connected-workflow/) | The same OpenAI statement; Axios described Torch as including visit recordings | Search result |
| Technotrenz, OpenAI's $100 million Torch acquisition | Tech blog | 2026 | [link](https://technotrenz.com/news/openais-100-million-torch-acquisition) | Function, b.well and Apple Health named as ChatGPT Health connections; Torch normalises data into one context engine | Search result. Secondary source of lower quality |
| SYNLAB Nigeria, PathProvider patient results | Company site | undated | [link](https://www.synlab.com.ng/?p=3982) | Results delivered on an online portal with email or SMS notification; patients can share or print results. No public API was found | Search result |
| Nairametrics, Nigeria's smartphone ownership rises to 75% | News | 26 Sep 2026 | [link](https://nairametrics.com/2026/09/26/nigerias-smartphone-ownership-rises-to-75-as-digital-use-expands-report/) | 75% smartphone ownership (KPMG study); 86% of smartphone users on Android; 157 million internet subscribers, May 2026 (NCC) | Search result |

**Named but not re-read in this session**, so cited as pointers rather than summarised: WCAG 2.1 (W3C), WHO guidance on ethics and governance of AI for health (2021), NIST AI Risk Management Framework. Verify each before quoting it in the final documentation.
