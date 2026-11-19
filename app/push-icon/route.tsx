import { ImageResponse } from "next/og";

// The app icon shown beside a visit notification: the CareCircle mark on white.
export const dynamic = "force-static";

const MARK =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#0d7a73" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="62 14" transform="rotate(-50 16 16)"/><circle cx="16" cy="16" r="4.4" fill="#0a2e45"/></svg>`;

export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not a page */}
        <img alt="" width={150} height={150} src={`data:image/svg+xml,${encodeURIComponent(MARK)}`} />
      </div>
    ),
    { width: 192, height: 192 },
  );
}
