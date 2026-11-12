# Prep B extraction test report

- Model: `gemini-3.6-flash`
- Prompt version: `v1`
- Date: 2026-11-12
- Runs per document: 1
- Documents scored: 0; failed to extract: 1
- Latency (ms): median n/a, slowest n/a (NFR-10 target is 30 s on throttled 3G; this is unthrottled server-side time)
- **NFR-15: NOT RUN (no documents were scored)**

Synthetic documents only. Accuracy here does not prove real-world accuracy.

| Document | ms | Items found/expected | Label | Value | Unit | Range | Unreadable handled | Hallucinated | Critical |
|---|---|---|---|---|---|---|---|---|---|

## Documents that failed to extract

- tiny-fbc-pdf: model_timeout

## Critical errors

None.
