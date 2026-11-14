"use client";
// Prepare a capture for upload (FR-02, NFR-09): re-encode on the device so EXIF and location are dropped, longest edge
// 1600 px, JPEG quality stepped down until 500 KB or less. PDFs pass through unchanged (4 MB server limit).
export const TARGET_BYTES = 500 * 1024;
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 1024 * 1024;

export class CaptureError extends Error {}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new CaptureError("This photo could not be prepared. Please try again."))), "image/jpeg", quality);
  });
}

export async function prepareCapture(file: File): Promise<Blob> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new CaptureError("This PDF is larger than 4 MB. Please use a smaller file.");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new CaptureError("Please choose a photo or a PDF.");

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let edge = 1600;
  let best: Blob | null = null;
  for (let pass = 0; pass < 3; pass++) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new CaptureError("This browser cannot prepare photos.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const q of [0.85, 0.75, 0.65, 0.55, 0.45]) {
      best = await toBlob(canvas, q);
      if (best.size <= TARGET_BYTES) {
        bitmap.close();
        return best;
      }
    }
    edge = Math.round(edge * 0.75);
  }
  bitmap.close();
  if (best && best.size <= MAX_IMAGE_BYTES) return best;
  throw new CaptureError("This photo is too large to send. Please retake it a little further away.");
}
