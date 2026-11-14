"use client";
// The patient's own source image, cropped to where one fact was read (FR-05, NFR-16). The box is [ymin, xmin, ymax, xmax]
// on a 0 to 1000 scale of the page (docs/api.md FactDTO). If there is no box, or the file is a PDF, only the printed
// quote is shown, so a wrong crop can never mislead. The image comes from a 60-second signed URL behind /api.
import { useEffect, useState } from "react";

interface Props {
  imageUrl: string;
  box: number[] | null;
  quote: string | null;
  /** PDFs cannot be cropped in an <img>; show the quote and let the person open the original. */
  isPdf?: boolean;
}

const PAD = 25; // context around the box, in thousandths of the page

export function SourceCrop({ imageUrl, box, quote, isPdf }: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const canCrop = !isPdf && box && box.length === 4 && box.every((n) => Number.isFinite(n));

  useEffect(() => {
    if (!canCrop) return;
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setFailed(true);
    img.src = imageUrl;
  }, [imageUrl, canCrop]);

  let crop: React.ReactNode = null;
  if (canCrop && natural && !failed) {
    const [y0, x0, y1, x1] = box!;
    const ymin = Math.max(0, Math.min(y0, y1) - PAD);
    const ymax = Math.min(1000, Math.max(y0, y1) + PAD);
    const xmin = Math.max(0, Math.min(x0, x1) - PAD);
    const xmax = Math.min(1000, Math.max(x0, x1) + PAD);
    const w = (xmax - xmin) / 1000;
    const h = (ymax - ymin) / 1000;
    if (w > 0 && h > 0) {
      const aspect = (w * natural.w) / (h * natural.h);
      crop = (
        <div className="relative w-full overflow-hidden rounded-md border border-line bg-sunk" style={{ aspectRatio: String(aspect), maxHeight: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="The part of your document this item was read from"
            className="absolute max-w-none"
            style={{ width: `${100 / w}%`, left: `${(-xmin / 1000 / w) * 100}%`, top: `${(-ymin / 1000 / h) * 100}%` }}
          />
        </div>
      );
    }
  }

  return (
    <figure className="grid gap-1.5">
      {crop}
      {quote ? (
        <figcaption className="text-sm text-muted">
          As printed: <span className="printed text-ink">&ldquo;{quote}&rdquo;</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
