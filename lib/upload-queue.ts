"use client";
// Device-side upload queue (FR-02, FR-16, NFR-12). A capture is saved in IndexedDB FIRST, then uploaded. If the
// connection drops the item stays queued and is retried with the SAME client_upload_id, so the server never makes a
// duplicate document. The queue retries on app open, on the browser's online event and on "Retry now".
import { del, get, set, keys } from "idb-keyval";
import { ApiFailure, apiFetch } from "@/lib/client-api";
import type { UploadDocumentResponse } from "@/lib/api-types";

export interface QueueItem {
  id: string; // client_upload_id
  recordId: string;
  blob: Blob;
  name: string;
  status: "queued" | "uploading" | "failed";
  attempts: number;
  error: string | null;
  createdAt: number;
}

const PREFIX = "itan-upload:";
const EVENT = "itan-queue-changed";
const changed = () => window.dispatchEvent(new Event(EVENT));
export const onQueueChange = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
};

export async function enqueue(recordId: string, blob: Blob, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const item: QueueItem = { id, recordId, blob, name, status: "queued", attempts: 0, error: null, createdAt: Date.now() };
  await set(PREFIX + id, item);
  changed();
  return id;
}

export async function listQueue(): Promise<QueueItem[]> {
  const all = await keys();
  const items: QueueItem[] = [];
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      const v = await get<QueueItem>(k);
      if (v) items.push(v);
    }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

let running = false;

/** Upload everything waiting. Returns the document ids created in this run. Safe to call often. */
export async function processQueue(): Promise<string[]> {
  if (running) return [];
  running = true;
  const created: string[] = [];
  try {
    for (const item of await listQueue()) {
      // An item left as "uploading" by a closed tab is treated as queued: the in-tab `running` flag already stops two
      // runs in one tab, and the server makes a retry with the same client_upload_id safe.
      await set(PREFIX + item.id, { ...item, status: "uploading", error: null });
      changed();
      try {
        const form = new FormData();
        form.append("record_id", item.recordId);
        form.append("client_upload_id", item.id);
        form.append("file", item.blob, item.name);
        const res = await apiFetch("/api/documents", { method: "POST", body: form });
        if (!res.ok) {
          let code = "upload_failed";
          let message = "The upload did not go through.";
          try {
            const b = (await res.json()) as { error?: { code: string; message: string } };
            if (b.error) {
              code = b.error.code;
              message = b.error.message;
            }
          } catch {
            // keep defaults
          }
          // Permanent refusals stay in the queue as "failed" so the person can see and remove them; others retry.
          const permanent = ["unsupported_type", "file_too_large", "invalid_request", "not_found", "client_upload_id_conflict"].includes(code);
          await set(PREFIX + item.id, { ...item, status: permanent ? "failed" : "queued", attempts: item.attempts + 1, error: message });
        } else {
          const body = (await res.json()) as UploadDocumentResponse;
          created.push(body.document_id);
          await del(PREFIX + item.id);
        }
      } catch (e) {
        const offline = e instanceof TypeError || e instanceof ApiFailure;
        await set(PREFIX + item.id, { ...item, status: "queued", attempts: item.attempts + 1, error: offline ? "Waiting for a connection." : "The upload did not go through." });
      }
      changed();
    }
  } finally {
    running = false;
  }
  return created;
}

export async function removeFromQueue(id: string) {
  await del(PREFIX + id);
  changed();
}
