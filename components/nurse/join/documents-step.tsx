"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, RefreshCw } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import {
  NURSE_DOCUMENTS,
  RESUBMISSION,
  patchNurseOnboarding,
  type NurseDocumentKey,
} from "@/lib/nurse-onboarding";
import { routes } from "@/lib/routes";
import { useTimers } from "@/lib/use-timers";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { JoinShell } from "./join-shell";

// §4.3: each simulated upload takes 1.2s with a progress bar.
const UPLOAD_MS = 1200;

export function NurseDocumentsStep() {
  return (
    <JoinShell
      step="Documents"
      back={{ href: routes.nurseSignup, label: "Your details" }}
      title="Upload your documents"
      description="A member of our team checks all three before you can take visits."
    >
      <Documents />
    </JoinShell>
  );
}

function Documents() {
  const { state, update } = useDemo();
  const router = useRouter();
  const { after } = useTimers();
  const [uploading, setUploading] = useState<NurseDocumentKey[]>([]);
  const uploaded = state.nurseOnboarding.uploaded ?? [];
  const resubmitting = state.nurseOnboarding.status === "needs_resubmission";
  const allUploaded = NURSE_DOCUMENTS.every((d) => uploaded.includes(d.key));

  const markUploaded = (key: NurseDocumentKey) => {
    setUploading((current) => current.filter((k) => k !== key));
    update((prev) => {
      const done = prev.nurseOnboarding.uploaded ?? [];
      return done.includes(key) ? prev : patchNurseOnboarding(prev, { uploaded: [...done, key] });
    });
  };

  const upload = (key: NurseDocumentKey) => {
    setUploading((current) => [...current, key]);
    after(UPLOAD_MS, () => markUploaded(key));
  };

  const submit = () => {
    update((prev) => patchNurseOnboarding(prev, { status: "in_review", reviewedAt: undefined }));
    router.push(routes.nursePending);
  };

  return (
    <div className="space-y-5">
      {resubmitting && (
        <p role="status" className="rounded-2xl border-2 border-amber bg-amber/10 p-4 text-navy">
          <strong>Please upload your proof of address again.</strong> {RESUBMISSION.reason}
        </p>
      )}

      <ul className="space-y-3">
        {NURSE_DOCUMENTS.map((doc) => {
          const isUploading = uploading.includes(doc.key);
          const isUploaded = uploaded.includes(doc.key) && !isUploading;
          const tileState = isUploading ? "uploading" : isUploaded ? "uploaded" : "idle";
          return (
            <li
              key={doc.key}
              className={`rounded-2xl border-2 p-4 transition-colors duration-150 ${
                tileState === "uploaded" ? "border-teal bg-teal-tint" : "border-line bg-surface"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    tileState === "uploaded" ? "bg-teal" : "bg-bg"
                  } text-navy`}
                >
                  {tileState === "uploaded" ? <CheckCircle2 className="size-5" /> : <FileUp className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-sans text-body font-semibold text-navy">{doc.label}</h2>
                    <Chip tone={tileState === "uploaded" ? "teal" : tileState === "uploading" ? "amber" : "neutral"} className="bg-surface">
                      {tileState === "uploaded" ? "Uploaded" : tileState === "uploading" ? "Uploading" : "Not uploaded"}
                    </Chip>
                  </div>
                  <p className="mt-0.5 text-small">{doc.hint}</p>

                  {tileState === "uploading" ? (
                    <div className="mt-3">
                      <div
                        role="progressbar"
                        aria-label={`Uploading ${doc.label}`}
                        className="h-2 overflow-hidden rounded-full bg-line"
                      >
                        <div className="h-full w-full origin-left rounded-full bg-teal motion-safe:animate-progress" />
                      </div>
                      <button
                        type="button"
                        onClick={() => markUploaded(doc.key)}
                        className="mt-1 inline-flex min-h-11 items-center text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4"
                      >
                        Skip
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant={tileState === "uploaded" ? "ghost" : "secondary"}
                      onClick={() => upload(doc.key)}
                      className={tileState === "uploaded" ? "mt-1 min-h-11 px-0" : "mt-3"}
                    >
                      {tileState === "uploaded" ? (
                        <>
                          <RefreshCw aria-hidden className="size-4" />
                          Replace {doc.noun}
                        </>
                      ) : (
                        <>
                          <FileUp aria-hidden className="size-4" />
                          Upload {doc.noun}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-small">
        This demo doesn&apos;t send any files. Tapping a document simulates the upload.
      </p>
      <div>
        <Button onClick={submit} disabled={!allUploaded || uploading.length > 0} className="w-full" aria-describedby="docs-status">
          Send for review
        </Button>
        <p id="docs-status" role="status" className="mt-2 text-center text-small">
          {allUploaded
            ? "All three documents are ready."
            : `${uploaded.length} of ${NURSE_DOCUMENTS.length} uploaded. Upload all three to continue.`}
        </p>
      </div>
    </div>
  );
}
