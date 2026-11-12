// POST /api/consent: record AI-processing consent before first capture (NFR-03). GET: current status.
// Extraction is refused with 403 consent_required until this is set (Locked decision L23).
import { getAccountId } from "@/lib/auth";
import { json, unauthenticated, withErrors } from "@/lib/http";
import { ensureAccount, getAiConsentAt, recordAiConsent } from "@/lib/records";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request) => {
  const accountId = await getAccountId(request);
  if (!accountId) return unauthenticated();
  await ensureAccount(accountId);
  return json({ ai_consent_at: await getAiConsentAt(accountId) });
});

export const POST = withErrors(async (request: Request) => {
  const accountId = await getAccountId(request);
  if (!accountId) return unauthenticated();
  return json({ ai_consent_at: await recordAiConsent(accountId) });
});
