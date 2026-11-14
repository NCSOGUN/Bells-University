// Shown when the viewer session or its share is gone: expired, ended by the patient, or no cookie. Hook-free.
import { LinkButton, Notice } from "@/components/ui";

export function NoLongerValid() {
  return (
    <div className="mx-auto grid max-w-md gap-4 py-10">
      <Notice tone="warn" role="alert" title="This access is no longer valid.">
        The code may have expired, or the patient may have ended it. Ask the patient for a new code.
      </Notice>
      <div>
        <LinkButton href="/c" variant="primary">
          Enter a new code
        </LinkButton>
      </div>
    </div>
  );
}
