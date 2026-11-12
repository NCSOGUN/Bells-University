// Freeze item 3: read the function region from the deployed response. No database access.
export const runtime = "nodejs";

export function GET() {
  return Response.json({
    ok: true,
    region: process.env.VERCEL_REGION ?? "local",
    node: process.version,
  });
}
