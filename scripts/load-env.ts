// Scripts run outside Next.js, so load .env.local ourselves. Import this first in every script.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
