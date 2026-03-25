import type { ServiceContext } from "@/lib/db/types";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import {
  assertSandboxOnly,
  clearSandboxData,
  ensureSandboxBaseData,
  listSandboxDemoUsers,
} from "@/services/sandbox/shared";

export async function resetSandbox(ctx: ServiceContext) {
  assertSandboxOnly(ctx);

  await clearSandboxData(ctx.db);
  await ensureSandboxBaseData(ctx.db);

  const [scenarioCount, demoUsers] = await Promise.all([
    ctx.db.sandboxScenario.count(),
    listSandboxDemoUsers(ctx.db),
  ]);

  await createSandboxAuditFromContext(ctx, {
    action: "sandbox.reset",
    entityType: "SandboxEnvironment",
    metadataJson: {
      strategy: "delete_and_reseed",
      demoUsers: demoUsers.map((user) => user.email),
      scenarioCount,
    },
  });

  return {
    strategy: "delete_and_reseed" as const,
    scenarioCount,
    demoUsers,
  };
}
