import "dotenv/config";
import { defineConfig } from "prisma/config";

const sandboxDatasourceUrl = process.env["SANDBOX_DATABASE_URL"]?.trim();

if (!sandboxDatasourceUrl) {
  throw new Error(
    "SANDBOX_DATABASE_URL is required for sandbox Prisma operations. Refusing to fall back to production.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "prisma/seed.ts",
  },
  datasource: {
    url: sandboxDatasourceUrl,
  },
});
