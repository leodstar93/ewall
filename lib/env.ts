import { z } from "zod";

// schema for all of the environment variables your app expects
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // database connection string used by Prisma
  DATABASE_URL: z.string().url(),
  SANDBOX_DATABASE_URL: z.string().url().optional(),

  // secret used by NextAuth (NextAuth v5 uses AUTH_SECRET)
  AUTH_SECRET: z.string().min(1),

  // port to run the server on (for non‑Vercel deployments)
  PORT: z.string().default("3000"),

  // add additional environment variables here
  SANDBOX_EMAIL_REDIRECT_TO: z.string().email().optional(),
});

type Env = z.infer<typeof envSchema>;

// parse once at startup – throws if any required variable is missing/invalid
export const env: Env = envSchema.parse(process.env);
