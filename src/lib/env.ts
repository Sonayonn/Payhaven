/**
 * Environment variable loader + validator.
 *
 * Loaded once at startup. Anything that reads process.env directly elsewhere
 * is a bug — use the `env` export from this module instead.
 *
 * This is the trust boundary for environment configuration
 * (see CONVENTIONS.md §2).
 */

import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"), "must be https"),
  SOLANA_WS_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("wss://"), "must be wss"),
  TREASURY_SECRET_KEY_B58: z
    .string()
    .min(80, "Looks too short to be a base58-encoded 64-byte key")
    .max(100, "Looks too long to be a base58-encoded 64-byte key"),
  NEXT_PUBLIC_PRIVY_APP_ID: z
    .string()
    .min(20, "Privy App ID looks too short"),
  PRIVY_APP_SECRET: z
    .string()
    .min(20, "Privy App Secret looks too short"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SUPABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"), "must be https"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(100, "Supabase service role key looks too short"),
  PRIVY_AUTHORIZATION_KEY: z.string().min(1), 
  PRIVY_AUTHORIZATION_PUBLIC_KEY: z.string().min(1),
});

// Parse once at module load. Throws a helpful error if anything is missing
// or malformed — server won't start with broken config. That's intentional.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `\n Invalid environment configuration:\n${issues}\n\n` +
      `Check .env.local against .env.example.\n`,
  );
}

export const env = parsed.data;
export type Env = typeof env;