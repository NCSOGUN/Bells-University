// Pure part of `npm run throttle` (P12 item 3, NFR-10, NFR-11): statistics and the evidence table.
// No browser, no network, no files. The script only ever passes MEASURED numbers in; this module never invents one.
// A result that was not measured is rendered as NOT MEASURED, and a failed document is shown, never dropped.

export const NFR10_LIMIT_MS = 30_000;
export const NFR11_LIMIT_BYTES = 300 * 1024;
export const NFR11_LIMIT_MS = 5_000;

export interface DocTiming {
  file: string;
  /** Bytes the browser uploaded (the file itself). */
  bytes: number;
  /** HTTP status and error code of each step; `error` is set when a step did not succeed. */
  uploadMs: number | null;
  extractMs: number | null;
  /** Upload plus extract, as the browser saw it, up to the end of the extract response. */
  totalMs: number | null;
  facts: number | null;
  error: string | null;
}

export interface ViewerTiming {
  bytes: number;
  firstRenderMs: number;
}

export interface Network {
  downKbit: number;
  upKbit: number;
  latencyMs: number;
}

/** Chrome's "Fast 3G" preset is about 1.6 Mbit/s down, 0.75 Mbit/s up, 562 ms latency. This is an approximation. */
export const FAST_3G: Network = { downKbit: 1600, upKbit: 750, latencyMs: 562 };

export const kbitToBytesPerSecond = (kbit: number) => Math.round((kbit * 1000) / 8);

const secs = (ms: number | null) => (ms === null ? "n/a" : `${(ms / 1000).toFixed(1)} s`);

export function slowest(docs: DocTiming[]): DocTiming | null {
  const ok = docs.filter((d) => d.error === null && d.totalMs !== null);
  return ok.length ? ok.reduce((a, b) => ((b.totalMs as number) > (a.totalMs as number) ? b : a)) : null;
}

export type Nfr10Verdict = { status: "WITHIN" | "OVER" | "INCOMPLETE" | "NOT MEASURED"; line: string };

/** NFR-10: the SLOWEST of the documents, within 30 s. Any failed document makes it INCOMPLETE, never WITHIN. */
export function nfr10Verdict(docs: DocTiming[]): Nfr10Verdict {
  if (docs.length === 0) return { status: "NOT MEASURED", line: "NFR-10: NOT MEASURED (no documents were run)" };
  const worst = slowest(docs);
  const failed = docs.filter((d) => d.error !== null);
  if (!worst) return { status: "NOT MEASURED", line: `NFR-10: NOT MEASURED (all ${docs.length} documents failed)` };
  const over = (worst.totalMs as number) > NFR10_LIMIT_MS;
  const head = `slowest ${secs(worst.totalMs)} of ${docs.length - failed.length} completed (${worst.file}); limit ${NFR10_LIMIT_MS / 1000} s`;
  if (over) return { status: "OVER", line: `NFR-10: OVER (${head}${failed.length ? `; ${failed.length} failed` : ""})` };
  if (failed.length) return { status: "INCOMPLETE", line: `NFR-10: INCOMPLETE (${head}; ${failed.length} failed and not timed)` };
  return { status: "WITHIN", line: `NFR-10: WITHIN (${head})` };
}

export function nfr11Verdict(v: ViewerTiming | null): { status: string; line: string } {
  if (!v) return { status: "SKIPPED", line: "NFR-11: SKIPPED: /v not built" };
  const ok = v.bytes < NFR11_LIMIT_BYTES && v.firstRenderMs < NFR11_LIMIT_MS;
  return { status: ok ? "WITHIN" : "OVER", line: `NFR-11: ${ok ? "WITHIN" : "OVER"} (${(v.bytes / 1024).toFixed(0)} KB, first render ${secs(v.firstRenderMs)}; limits 300 KB and 5 s)` };
}

export interface ReportInput {
  date: string;
  baseUrl: string;
  serverMode: string;
  /** Model(s) recorded by the server against the documents it extracted (document.model_version). */
  models: string[];
  network: Network;
  /** One unthrottled-baseline-free round trip under the throttle: the network floor for a tiny request. */
  floorMs: number | null;
  docs: DocTiming[];
  viewer: ViewerTiming | null;
}

export function renderThrottleReport(r: ReportInput): string {
  const v10 = nfr10Verdict(r.docs);
  const v11 = nfr11Verdict(r.viewer);
  const L: string[] = [
    "# Throttled-network measurements (NFR-10, NFR-11)",
    "",
    `- Date: ${r.date}`,
    `- Model recorded by the server: ${r.models.length ? r.models.map((m) => `\`${m}\``).join(", ") : "not recorded"}`,
    `- Server measured: \`${r.baseUrl}\` (${r.serverMode})`,
    `- Network: **an approximation of Chrome's Fast 3G preset**, applied to the browser with the Chrome DevTools Protocol: ${r.network.downKbit / 1000} Mbit/s down, ${r.network.upKbit / 1000} Mbit/s up, ${r.network.latencyMs} ms added latency. It is not a real mobile network.`,
    `- Network floor (one tiny request, \`GET /api/health\`, under the same throttle): ${secs(r.floorMs)}`,
    "- Synthetic documents only. Times are what the browser saw, from the start of the upload to the end of the extraction response. Only the browser-to-server link is throttled: the server's own calls to the database, storage and the AI service are not.",
    "",
    "## NFR-10: extraction within 30 s, slowest of the documents",
    "",
    `**${v10.line}**`,
    "",
    "| Document | Size | Upload | Extract | Total | Facts | Result |",
    "|---|---|---|---|---|---|---|",
    ...r.docs.map((d) => `| ${d.file} | ${(d.bytes / 1024).toFixed(0)} KB | ${secs(d.uploadMs)} | ${secs(d.extractMs)} | ${secs(d.totalMs)} | ${d.facts ?? "n/a"} | ${d.error ?? "ok"} |`),
    "",
    "## NFR-11: clinician first screen under 300 KB and 5 s",
    "",
    `**${v11.line}**`,
  ];
  if (r.viewer) L.push("", `Transferred ${(r.viewer.bytes / 1024).toFixed(0)} KB; first render ${secs(r.viewer.firstRenderMs)}.`);
  L.push("", "Re-run with `npm run throttle` (see scripts/throttle.ts). A number is written here only if this run measured it.", "");
  return L.join("\n");
}
