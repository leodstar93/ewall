import type { Prisma } from "@prisma/client";

type AuditDb = {
  financialAccessAudit: {
    create: (args: Prisma.FinancialAccessAuditCreateArgs) => Promise<unknown>;
  };
};

type WriteFinancialAccessAuditInput = {
  action: string;
  actorUserId: string;
  filingId?: string | null;
  filingType?: string | null;
  ipAddress?: string | null;
  paymentMethodId?: string | null;
  reason?: string | null;
  resourceId: string;
  resourceType: string;
  targetUserId?: string | null;
  userAgent?: string | null;
};

export async function writeFinancialAccessAudit(
  db: AuditDb,
  input: WriteFinancialAccessAuditInput,
) {
  return db.financialAccessAudit.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      filingId: input.filingId ?? null,
      filingType: input.filingType ?? null,
      ipAddress: input.ipAddress ?? null,
      paymentMethodId: input.paymentMethodId ?? null,
      reason: input.reason ?? null,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      targetUserId: input.targetUserId ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
