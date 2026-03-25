import type { ServiceContext } from "@/lib/db/types";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
import {
  assertSandboxOnly,
  ensureSandboxBaseData,
  seedSandboxScenario,
  upsertSandboxScenarioCatalog,
} from "@/services/sandbox/shared";

export async function loadScenario(ctx: ServiceContext, scenarioKey: string) {
  assertSandboxOnly(ctx);

  await ensureSandboxBaseData(ctx.db);
  await upsertSandboxScenarioCatalog(ctx.db);

  const scenario = await ctx.db.sandboxScenario.findUnique({
    where: { key: scenarioKey },
    select: {
      key: true,
      name: true,
      moduleKey: true,
      description: true,
      isActive: true,
    },
  });

  if (!scenario?.isActive) {
    throw new Error("SCENARIO_NOT_FOUND");
  }

  const result = await seedSandboxScenario(ctx, scenarioKey);

  await createSandboxAuditFromContext(ctx, {
    action: "sandbox.scenario.load",
    entityType: "SandboxScenario",
    entityId: scenario.key,
    metadataJson: {
      scenarioKey: scenario.key,
      scenarioName: scenario.name,
      moduleKey: scenario.moduleKey,
      seededEntityType: result.entityType ?? null,
      seededEntityId: result.entityId ?? null,
      ...((result.metadata as Record<string, unknown> | undefined) ?? {}),
    },
  });

  return {
    scenario,
    seeded: result,
  };
}
