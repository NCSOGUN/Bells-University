// GET /api/hospitals: hospitals a patient can link (C14, FR-25). Signed-in only.
import { getAccountId } from "@/lib/auth";
import { json, unauthenticated, withErrors } from "@/lib/http";
import { listHospitals } from "@/lib/links/service";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request) => {
  if (!(await getAccountId(request))) return unauthenticated();
  return json({ hospitals: await listHospitals() });
});
