// POST /api/documents: multipart upload {record_id, client_upload_id, file} (FR-02, NFR-09, NFR-12).
import { getHolderActor } from "@/lib/auth";
import { uploadDocument } from "@/lib/documents/service";
import { denied, errorResponse, isUuid, json, unauthenticated, withErrors } from "@/lib/http";
import { can } from "@/lib/policy";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("invalid_request", "Send multipart/form-data with record_id, client_upload_id and file.", 400);
  }
  const recordId = String(form.get("record_id") ?? "");
  const clientUploadId = String(form.get("client_upload_id") ?? "");
  const file = form.get("file");
  if (!isUuid(recordId) || !isUuid(clientUploadId) || !(file instanceof Blob)) {
    return errorResponse("invalid_request", "Invalid or missing fields: record_id, client_upload_id, file", 400);
  }

  const d = can(actor, "upload_document", { recordId });
  if (!d.allowed) return denied(d);

  const result = await uploadDocument({
    recordId,
    clientUploadId,
    mime: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return errorResponse(result.code, result.message, result.status);
  return json(result.data, result.status);
});
