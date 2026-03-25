import type { Prisma } from "@prisma/client";
import type { AppEnvironment, DbClient, ServiceContext } from "@/lib/db/types";

type CreateSandboxAuditInput = {
  db: DbClient;
  environment: AppEnvironment;
  actorUserId: string;
  actingAsUserId?: string | null;
  actingAsRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

export async function createSandboxAudit(input: CreateSandboxAuditInput) {
  if (input.environment !== "sandbox") {
    throw new Error("AUDIT_ONLY_ALLOWED_IN_SANDBOX");
  }

  return input.db.sandboxAuditLog.create({
    data: {
      environment: input.environment,
      actorUserId: input.actorUserId,
      actingAsUserId: input.actingAsUserId ?? null,
      actingAsRole: input.actingAsRole ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadataJson: input.metadataJson,
    },
  });
}

export async function createSandboxAuditFromContext(
  ctx: ServiceContext,
  input: Omit<CreateSandboxAuditInput, "db" | "environment" | "actorUserId" | "actingAsUserId" | "actingAsRole">,
) {
  return createSandboxAudit({
    db: ctx.db,
    environment: ctx.environment,
    actorUserId: ctx.actorUserId,
    actingAsUserId: ctx.actingAsUserId,
    actingAsRole: ctx.actingAsRole,
    ...input,
  });
}
