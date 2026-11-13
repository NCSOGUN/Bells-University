// `npm run fixtures`: renders the SYNTHETIC demo documents and their answer keys (P1, freeze item 12).
// HTML -> PDF or PNG with Playwright driving an INSTALLED Chrome (or Edge): no browser download needed.
// "Photo" fixtures are then degraded with sharp to look like phone photos: rotation, shear, uneven lighting,
// noise, slight softness and JPEG compression. They are written as JPEG, 500 KB or less, long edge 1600 px or
// less: the same shape the app's device-side re-encoding sends.
// NO real patient data: every name, number and facility in tools/fixtures/specs.ts is invented (hard rule 8).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import sharp from "sharp";
import { FIXTURES, type FixtureSpec, type Render } from "./fixtures/specs";

const OUT = path.join("tools", "fixtures");
const MAX_BYTES = 500 * 1024;
const MAX_EDGE = 1600;
const DESK = "#6b6258";

/** Small seeded PRNG so a re-run produces the same noise. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function launch(): Promise<Browser> {
  for (const channel of ["chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // try the next one
    }
  }
  console.error("No installed Chrome or Edge could be launched.");
  console.error("Install Playwright's own Chromium with:  npx playwright install chromium   (about 200 to 300 MB)");
  process.exit(1);
}

type Photo = Extract<Render, { kind: "photo" }>;

async function degrade(png: Buffer, r: Photo): Promise<Buffer> {
  const rnd = mulberry32(r.seed);

  // 1. Tilt and shear on a desk-coloured background (the corners a phone photo shows).
  let img = await sharp(png).flatten({ background: "#ffffff" }).rotate(r.rotate, { background: DESK }).png().toBuffer();
  img = await sharp(img).affine([[1, Math.tan((r.skew * Math.PI) / 180)], [0, 1]], { background: DESK }).png().toBuffer();

  // 2. Fit inside the size the app sends.
  img = await sharp(img).resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside" }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(img).metadata();

  // 3. Uneven lighting: a soft dark gradient from one edge.
  const [x1, y1, x2, y2] = r.shade === "left" ? [0, 0, 1, 0.2] : r.shade === "right" ? [1, 0, 0, 0.2] : [0, 1, 0.2, 0];
  const shade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="0" stop-color="#000" stop-opacity="0.34"/><stop offset="0.65" stop-color="#000" stop-opacity="0"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

  // 4. Sensor noise: per-pixel brightness between (255 - amplitude) and 255, multiplied over the image.
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const v = 255 - Math.floor(rnd() * r.noise);
    noise[i * 3] = noise[i * 3 + 1] = noise[i * 3 + 2] = v;
  }

  let out = sharp(img).composite([
    { input: shade, blend: "over" },
    { input: noise, raw: { width, height, channels: 3 }, blend: "multiply" },
  ]);
  // 5. Slight camera softness always; heavy blur for the blurred fixture.
  out = sharp(await out.png().toBuffer()).blur(Math.max(0.8, r.blur));

  // 6. JPEG, lowering quality until it fits the size budget.
  for (const quality of [72, 62, 52, 42, 32]) {
    const jpg = await out.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpg.byteLength <= MAX_BYTES) return jpg;
  }
  throw new Error("could not fit the photo under 500 KB");
}

async function render(browser: Browser, f: FixtureSpec): Promise<{ file: string; bytes: number }> {
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 2 });
  try {
    await page.setContent(f.html, { waitUntil: "load" });
    const file = path.join(OUT, f.key.file);
    if (f.render.kind === "pdf") {
      const pdf = await page.pdf({ width: "800px", height: "1100px", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
      writeFileSync(file, pdf);
      return { file, bytes: pdf.byteLength };
    }
    const png = await page.screenshot({ fullPage: true, type: "png" });
    const jpg = await degrade(png, f.render);
    writeFileSync(file, jpg);
    return { file, bytes: jpg.byteLength };
  } finally {
    await page.close();
  }
}

async function main(): Promise<number> {
  mkdirSync(path.join(OUT, "keys"), { recursive: true });
  const browser = await launch();
  try {
    for (const f of FIXTURES) {
      const { file, bytes } = await render(browser, f);
      writeFileSync(path.join(OUT, "keys", `${f.id}.json`), JSON.stringify(f.key, null, 2) + "\n");
      console.log(`${f.id.padEnd(24)} ${path.basename(file).padEnd(30)} ${(bytes / 1024).toFixed(0).padStart(4)} KB`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${FIXTURES.length} synthetic fixtures and answer keys written to ${OUT}`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error("fixtures failed:", (e as Error).message);
    process.exitCode = 1;
  },
);
