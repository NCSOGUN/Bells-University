// `npm run storage:init`: create (or update) the private `documents` bucket. Idempotent.
import "./load-env";
import { DOCUMENTS_BUCKET, serviceClient } from "../lib/supabase";

const options = {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
};

async function main() {
  const sb = serviceClient();
  const { data, error } = await sb.storage.getBucket(DOCUMENTS_BUCKET);
  if (data && !error) {
    const upd = await sb.storage.updateBucket(DOCUMENTS_BUCKET, options);
    if (upd.error) throw upd.error;
    console.log(`Bucket "${DOCUMENTS_BUCKET}" exists; settings updated (private, 5 MB, jpeg/png/pdf).`);
    return;
  }
  const created = await sb.storage.createBucket(DOCUMENTS_BUCKET, options);
  if (created.error) throw created.error;
  console.log(`Bucket "${DOCUMENTS_BUCKET}" created (private, 5 MB, jpeg/png/pdf).`);
}

main().catch((e) => {
  console.error("storage:init failed:", (e as Error).message);
  process.exit(1);
});
