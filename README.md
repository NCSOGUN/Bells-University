# Itan

Itan is a medical record that the patient holds. You photograph the papers you already have (lab results, prescriptions, a referral letter), an AI service reads the text, and you check each item against the photo before it counts as confirmed. When you see a new doctor, you show a code that expires. The doctor opens a one-screen history in a browser, with no account and nothing to install.

The name is Yoruba for history. The idea is that you tell yours once.

We built it for the 16th NCS Ogun State IT Development Contest (theme: intelligent and accessible healthcare delivery). Everything in it is a prototype, and every document, patient and hospital in the demo is made up.

## The problem

When a patient moves between facilities in Nigeria, the next clinician usually starts from a short letter and whatever the patient remembers. In a Lagos audit of 356 paediatric referral letters (December 2012 to February 2013), 28.4% contained any test results and 8.4% said how urgent the case was. In an Ibadan diabetes clinic (2017), 21.7% of 120 letters gave an HbA1c. Only an estimated 18 to 23% of Nigerian hospitals use electronic records at all (Salam et al., 2023), and the national exchange that would connect the ones that do is still being built.

Itan does not try to replace any of that. It covers the patient who is carrying paper today. We could not find a measurement from Ogun State, and the audits above are old, so treat them as the best evidence we have, not as a current count.

## How it works

1. The patient takes a photo or picks a PDF. The phone shrinks it, strips the location data, and saves it in the browser before anything is sent, so a dropped connection never loses a capture.
2. An AI service (Google Gemini) reads the document into fields: test name, value, unit, printed range, date. It copies what is printed and leaves a field empty when it cannot read it. It never explains or advises.
3. Our own code checks each number against the printed text before storing it.
4. The patient sees the photo beside every item and confirms, corrects or removes it. Nothing is confirmed automatically.
5. The patient creates a share code (15 minutes to 24 hours, with chosen categories or documents hidden). The doctor types it or scans the QR code, gives a name and practice number, and reads the summary.
6. The patient can end access at any moment and sees every opening in an access log, including refused attempts.

A referral works the same way. The packet is built from facts already in the record, and the reason and urgency are copied word for word from a letter the patient confirmed, or from a hospital's message. If neither exists the packet says "Not stated by the referring clinician". Itan never writes them. The receiving doctor can reply "Received, service offered here", which is not a promise of a bed.

Explanations of a result are fixed text. We compare the value with the range printed on the patient's own report and add a short description we wrote. No AI writes anything the patient reads as medical information.

## What is real and what is simulated

Real: the capture queue, extraction, the confirm flow, share codes, the access log, the referral packet, and a write-only feed that accepts results from a hospital system.

Simulated: the hospital. No real hospital is connected. A script plays one (`npm run sim`) and every hospital name carries the word SIMULATED.

Not done, on purpose:

- Handwriting. We tested printed documents and PDFs only.
- Emergencies where the patient cannot create a share.
- Checking a doctor's practice number against a register. We record it and show it to the patient, marked unverified.
- Clinical review. The glossary and the drug-allergy list were not reviewed by a licensed clinician, and the allergy check uses a short hand-built list.
- Legal review. Nobody on the team has read the Nigeria Data Protection Act from the statute, so we make no compliance claim.

[docs/limitations.md](docs/limitations.md) has the full list, with the accuracy numbers and the failures we saw.

## Try it

Sign in as the demo patient (`demo@itan.example`) and open the record named "Demo Patient (SYNTHETIC)". The team gives out the password on contest day. To make a hospital send results, link "Demo General Hospital (SIMULATED)" under Hospitals and run:

```bash
npm run sim -- send-results --link <ITN-LNK reference from the screen> --mrn DEMO-00123
```

Clinicians start at `/c`. They need a code from a patient's share screen.

## Run it yourself

You need Node 24 and a Supabase project (we use London) plus a Gemini API key. Copy `.env.example` to `.env.local` and fill it in. The file is ignored by git, so keep it that way.

```bash
npm ci
npm run dev        # http://localhost:3000
```

On a fresh Supabase project, run these once, in this order. They write to the database named in `.env.local`.

```bash
npm run db:migrate     # schema, works on an empty database
npm run db:seed        # facilities, the simulated hospital, glossary, drug-allergy rules
npm run storage:init   # private `documents` bucket; without it every upload fails
npm run db:seed:demo   # the demo user and the synthetic demo record
npm run rls:check      # confirm row-level security is deny-all and the bucket is private
```

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler URL (port 6543) |
| `MIGRATION_DATABASE_URL` | Direct connection for migrations, optional |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Project URL and publishable key, used on the server |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key for Storage and Auth admin. Server only |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Extraction. The model is pinned; our accuracy numbers are for that exact value |
| `SHARE_PEPPER` | At least 16 characters. Keys the hash of every share code, so changing it invalidates them all |
| `DEMO_PASSWORD` | Password of the demo user |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same values as the two above, for sign-in in the browser. These are the only public variables allowed, and a test fails if another appears |

After `npm run build`, restart `npm run dev` in the same folder. A build writes into `.next` and can leave a running dev server returning errors.

## How it is built

One Next.js 16 app in TypeScript: the patient app, the clinician pages, the API and the partner feed. Supabase holds the data (Postgres, private file storage, sign-in) in London, and the functions run in London too. Tailwind for styling, Drizzle and Zod on the server, Vitest for tests, and a small hand-written service worker so the app shell opens offline.

```
app/            patient app (app/(patient)), clinician pages (c, v), API routes (api)
components/     shared interface pieces
lib/            server logic: policy, share codes, extraction and its guards, feed, referral
tools/          the simulated hospital and the extraction test harness
tests/          unit and static tests
docs/           design, requirements, API contract, decisions, limitations, evidence
```

Three rules shape most of the code. Every permission goes through one function, `can()` in `lib/policy.ts`. The AI only reads documents. And the browser Supabase client is for sign-in only: all data goes through `/api/*`.

Sign-in is a password, with an optional authenticator-app code on top. An account that turns the code on must pass it before creating a share or linking a hospital. Ending access never asks for it.

## Where the data goes

Records and photos are stored in the UK. During reading, the photo goes to Google's Gemini API, which may process it in any country. On a paid Google account it is not used to improve Google's products; on the free tier it can be, and people at Google may read it, which is why the demo uses made-up documents only. The consent screen says all of this before the first capture. Gemini's terms bar clinical use, which is the reason the AI only transcribes.

## Checks

| Command | What it does |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm test` | The checks CI runs. 596 tests, no database or network needed |
| `npm run smoke` | End-to-end API checks against `BASE_URL`. It writes throwaway data to the real database |
| `npm run sim -- <command>` | The simulated hospital: `send-results`, `send-referral`, `correct-result`, `refusals` |
| `npm run extract-test` | Reads our 10 synthetic test documents with the real model and scores them |
| `npm run throttle` | Times extraction and the clinician page on a throttled connection |

Git hooks in `.githooks/` run lint before each commit and the type check plus tests before each push. `npm ci` switches them on.

Evidence for each non-functional requirement, with what passed and what was not run, is in [docs/evidence](docs/evidence).

## Documents

`docs/SYSTEM-DESIGN.md` is the design, `docs/REQUIREMENTS-STAGE1.md` the requirements, `docs/api.md` the API, `docs/LOCKED-DECISIONS.md` and `docs/DEVIATIONS.md` the decisions and where we departed from the design, and `docs/ITAN-OVERVIEW.md` a plain-language overview. `docs/design-lab.html` is an interactive version of the design you can open in a browser.
