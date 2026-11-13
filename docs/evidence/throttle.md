# Throttled-network measurements (NFR-10, NFR-11)

- Date: 2026-11-13
- Model recorded by the server: `gemini-3.5-flash-lite`
- Server measured: `https://itan-five.vercel.app` (deployed)
- Network: **an approximation of Chrome's Fast 3G preset**, applied to the browser with the Chrome DevTools Protocol: 1.6 Mbit/s down, 0.75 Mbit/s up, 562 ms added latency. It is not a real mobile network.
- Network floor (one tiny request, `GET /api/health`, under the same throttle): 0.6 s
- Synthetic documents only. Times are what the browser saw, from the start of the upload to the end of the extraction response. Only the browser-to-server link is throttled: the server's own calls to the database, storage and the AI service are not.

## NFR-10: extraction within 30 s, slowest of the documents

**NFR-10: WITHIN (slowest 6.2 s of 5 completed (lab-fbc-photo.jpg); limit 30 s)**

| Document | Size | Upload | Extract | Total | Facts | Result |
|---|---|---|---|---|---|---|
| lab-fbc-photo.jpg | 93 KB | 2.2 s | 4.0 s | 6.2 s | 4 | ok |
| lab-chem-photo.jpg | 97 KB | 1.8 s | 3.3 s | 5.1 s | 5 | ok |
| rx-printed-photo.jpg | 93 KB | 1.6 s | 3.1 s | 4.8 s | 4 | ok |
| referral-letter-photo.jpg | 87 KB | 1.6 s | 2.5 s | 4.1 s | 1 | ok |
| lab-hba1c-2026-pdf.pdf | 49 KB | 1.2 s | 2.1 s | 3.3 s | 1 | ok |

## NFR-11: clinician first screen under 300 KB and 5 s

**NFR-11: SKIPPED: /v not built**

Re-run with `npm run throttle` (see scripts/throttle.ts). A number is written here only if this run measured it.
