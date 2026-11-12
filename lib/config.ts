// C01 platform skeleton, NFR-02. Typed, validated env access.
// Validation is lazy (first call to env()), so `npm run build` works on a machine with no keys.
// Secrets are read here and nowhere else. Never log the returned object (Locked decision L31).
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  MIGRATION_DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  SHARE_PEPPER: z.string().min(16),
  DEMO_PASSWORD: z.string().min(8),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated environment. Throws a message naming the bad variables (never their values). */
export function env(): Env {
  if (cached) return cached;
  // Treat empty strings as unset so a blank line in .env.local reads as "missing".
  const source = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Missing or invalid environment variables: ${names.join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests only: forget the cached environment. */
export function resetEnvCache(): void {
  cached = undefined;
}

// Constants (design sections 7 to 9, Locked decisions L10, L11, L13, L14, L24, L29).
export const DEFAULT_SHARE_MINUTES = 60;
export const MAX_REFERRAL_EXPIRY_DAYS = 7; // open decision, section 17 item 15
export const RATE_LIMIT_FAILS = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const SIGNED_URL_SECONDS = 60;
export const VIEWER_SESSION_MINUTES = 30;
export const MAX_IMAGE_BYTES = 1_048_576; // 1 MB
export const MAX_PDF_BYTES = 4_194_304; // 4 MB
export const MAX_FEED_BYTES = 1_048_576; // 1 MB
