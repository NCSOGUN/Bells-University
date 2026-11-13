// GET /api/facilities: the short static list used to choose a referral destination (FR-20). Any signed-in account.
import { getAccountId } from "@/lib/auth";
import { json, unauthenticated, withErrors } from "@/lib/http";
import { listFacilities } from "@/lib/referral/queries";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request) => {
  if (!(await getAccountId(request))) return unauthenticated();
  return json({ facilities: await listFacilities() });
});
