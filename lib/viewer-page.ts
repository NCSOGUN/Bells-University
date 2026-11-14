// Server-side helper for the clinician pages /v and /v/referral (docs/HANDOVER-DEV-A.md section 2).
// Reads the HttpOnly itan_v cookie, builds a Request for getViewerFromRequest, and re-checks the share on every page load.
import { cookies } from "next/headers";
import { getViewerFromRequest } from "@/lib/share/service";
import { VIEWER_COOKIE } from "@/lib/share/session";

export async function loadViewer() {
  const store = await cookies();
  const token = store.get(VIEWER_COOKIE)?.value;
  const request = new Request("http://itan.local/", { headers: token ? { cookie: `${VIEWER_COOKIE}=${token}` } : {} });
  return getViewerFromRequest(request);
}
