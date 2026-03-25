import type { DbClient } from "@/lib/db/types";

const REQUIRED_SANDBOX_TABLES = [
  "User",
  "Role",
  "Permission",
  "UserRole",
  "RolePermission",
  "Jurisdiction",
  "IftaTaxRate",
  "UCRRateBracket",
  "Form2290Setting",
  "Form2290TaxPeriod",
  "SandboxScenario",
  "SandboxAuditLog",
  "SandboxImpersonationSession",
] as const;

export type SandboxSchemaStatus = {
  isReady: boolean;
  missingTables: string[];
};

export async function getSandboxSchemaStatus(
  db: DbClient,
): Promise<SandboxSchemaStatus> {
  const tableList = REQUIRED_SANDBOX_TABLES.map((tableName) => `'${tableName}'`).join(", ");
  const existingTables = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (${tableList})
  `);

  const existingTableNames = new Set(existingTables.map((row) => row.table_name));
  const missingTables = REQUIRED_SANDBOX_TABLES.filter(
    (tableName) => !existingTableNames.has(tableName),
  );

  return {
    isReady: missingTables.length === 0,
    missingTables: [...missingTables],
  };
}
