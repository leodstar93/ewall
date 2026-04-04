import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { IftaAutomationError } from "@/services/ifta-automation/shared";

export function canReviewAllIfta(perms: string[], isAdmin: boolean) {
  return isAdmin || perms.includes("ifta:review") || perms.includes("ifta:approve");
}

export async function getActorTenant(userId: string) {
  return ensureUserOrganization(userId);
}

export async function assertFilingAccess(input: {
  filingId: string;
  userId: string;
  canReviewAll: boolean;
}) {
  const filing = await prisma.iftaFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!filing) {
    throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
  }

  if (!input.canReviewAll) {
    const tenant = await ensureUserOrganization(input.userId);
    if (filing.tenantId !== tenant.id) {
      throw new IftaAutomationError("You do not have access to this filing.", 403, "IFTA_FORBIDDEN");
    }
  }

  return filing;
}

export async function assertExceptionAccess(input: {
  exceptionId: string;
  userId: string;
  canReviewAll: boolean;
}) {
  const exception = await prisma.iftaException.findUnique({
    where: { id: input.exceptionId },
    select: {
      id: true,
      filingId: true,
      filing: {
        select: {
          tenantId: true,
        },
      },
    },
  });

  if (!exception) {
    throw new IftaAutomationError("IFTA exception not found.", 404, "IFTA_EXCEPTION_NOT_FOUND");
  }

  if (!input.canReviewAll) {
    const tenant = await ensureUserOrganization(input.userId);
    if (exception.filing.tenantId !== tenant.id) {
      throw new IftaAutomationError("You do not have access to this exception.", 403, "IFTA_FORBIDDEN");
    }
  }

  return exception;
}

export async function buildFilingWhere(input: {
  userId: string;
  canReviewAll: boolean;
}): Promise<Prisma.IftaFilingWhereInput> {
  if (input.canReviewAll) {
    return {};
  }

  const tenant = await ensureUserOrganization(input.userId);
  return {
    tenantId: tenant.id,
  };
}

export async function buildSyncJobWhere(input: {
  userId: string;
  canReviewAll: boolean;
}) {
  if (input.canReviewAll) {
    return {};
  }

  const tenant = await ensureUserOrganization(input.userId);
  return {
    integrationAccount: {
      tenantId: tenant.id,
    },
  };
}
