import { ImageResponse } from "next/og";

// The small status-bar badge on Android: must be white on transparent.
export const dynamic = "force-static";

const MARK =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="62 14" transform="rotate(-50 16 16)"/><circle cx="16" cy="16" r="4.6" fill="#ffffff"/></svg>`;

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not a page */}
        <img alt="" width={88} height={88} src={`data:image/svg+xml,${encodeURIComponent(MARK)}`} />
      </div>
    ),
    { width: 96, height: 96 },
  );
}
