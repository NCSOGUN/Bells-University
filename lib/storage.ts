// Private document storage (Locked decision L14). Path: records/{record_id}/{document_id}.{ext}
// in the private bucket `documents`. Signed URLs live SIGNED_URL_SECONDS. Server only.
import { SIGNED_URL_SECONDS } from "@/lib/config";
import { DOCUMENTS_BUCKET, serviceClient } from "@/lib/supabase";

export interface DocumentStorage {
  put(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
  signedUrl(path: string): Promise<string>;
}

export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };

export const storagePath = (recordId: string, documentId: string, mime: string) =>
  `records/${recordId}/${documentId}.${EXT[mime]}`;

export const supabaseStorage: DocumentStorage = {
  async put(path, bytes, mime) {
    const { error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`storage put failed: ${error.name}`);
  },
  async get(path) {
    const { data, error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).download(path);
    if (error || !data) throw new Error(`storage get failed: ${error?.name ?? "no data"}`);
    return new Uint8Array(await data.arrayBuffer());
  },
  async remove(path) {
    await serviceClient().storage.from(DOCUMENTS_BUCKET).remove([path]);
  },
  async signedUrl(path) {
    const { data, error } = await serviceClient().storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error || !data) throw new Error(`signed url failed: ${error?.name ?? "no data"}`);
    return data.signedUrl;
  },
};
