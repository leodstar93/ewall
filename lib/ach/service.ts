import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeFinancialAccessAudit } from "@/lib/ach/audit";
import {
  ACH_AUTHORIZATION_STATUSES,
  ACH_PAYMENT_METHOD_STATUSES,
  ACH_PAYMENT_PROVIDER,
  ACH_PAYMENT_TYPE,
  FILING_PAYMENT_USAGE_STATUSES,
  FINANCIAL_AUDIT_ACTIONS,
  FINANCIAL_AUDIT_RESOURCES,
  type FilingPaymentUsageStatus,
  type FilingType,
} from "@/lib/ach/constants";
import { ACH_CONSENT_TEXT, ACH_CONSENT_VERSION } from "@/lib/ach/consent";
import {
  computeAchChecksum,
  decryptAchSecret,
  encryptAchSecret,
  getCurrentAchKeyMetadata,
} from "@/lib/ach/encryption";
import { AchServiceError } from "@/lib/ach/errors";
import { resolveFilingTarget } from "@/lib/ach/filing-targets";
import type { RequestMetadata } from "@/lib/ach/request-metadata";
import { assertRevealRateLimit } from "@/lib/ach/reveal-rate-limit";
import {
  normalizeAchCreatePayload,
  normalizeConsentPayload,
  normalizeFilingUsageCreatePayload,
  normalizeFilingUsageUpdatePayload,
  normalizeRevealReason,
} from "@/lib/ach/validation";
import { ensureUserOrganization, getUserOrganizationId } from "@/lib/services/organization.service";

const ACTIVE_ACH_METHOD_STATUSES = [
  ACH_PAYMENT_METHOD_STATUSES.ACTIVE,
  ACH_PAYMENT_METHOD_STATUSES.PENDING_AUTHORIZATION,
  ACH_PAYMENT_METHOD_STATUSES.INACTIVE,
  ACH_PAYMENT_METHOD_STATUSES.REVOKED,
] as const;

type PaymentMethodSummary = {
  accountType: string | null;
  authorizationAcceptedAt: string | null;
  authorizationStatus: string | null;
  authorized: boolean;
  bankName: string | null;
  brand: string | null;
  createdAt: string;
  holderName: string | null;
  id: string;
  isDefault: boolean;
  label: string | null;
  last4: string | null;
  maskedAccount: string | null;
  maskedRouting: string | null;
  paypalEmail: string | null;
  provider: string;
  status: string;
  type: string;
  updatedAt: string;
};

type FilingPaymentUsageSummary = {
  amount: string | null;
  confirmationNumber: string | null;
  createdAt: string;
  id: string;
  notes: string | null;
  paymentDate: string | null;
  paymentMethod: PaymentMethodSummary;
  portalName: string | null;
  receiptDocument: {
    id: string;
    name: string;
  } | null;
  status: string;
  updatedAt: string;
  usageType: string;
  usedBy: {
    email: string | null;
    id: string;
    name: string | null;
  };
};

type FilingPaymentWorkspace = {
  filing: {
    defaultUsageType: string;
    filingId: string;
    filingType: FilingType;
    title: string;
    userId: string;
  };
  methods: PaymentMethodSummary[];
  usages: FilingPaymentUsageSummary[];
};

function isAchPaymentMethod(method: {
  provider: string;
  type: string;
}) {
  return method.provider === ACH_PAYMENT_PROVIDER || method.type === ACH_PAYMENT_TYPE;
}

function maskAccount(last4: string | null) {
  return last4 ? `********${last4}` : null;
}

function maskRouting(last4: string | null | undefined) {
  return last4 ? `*****${last4}` : null;
}

function latestAuthorizationStatus(
  authorizations: Array<{ acceptedAt: Date; status: string }> | undefined,
) {
  return authorizations?.[0] ?? null;
}

function formatPaymentMethod(method: {
  accountType: string | null;
  authorizations?: Array<{
    acceptedAt: Date;
    status: string;
  }>;
  bankName: string | null;
  brand: string | null;
  createdAt: Date;
  holderName: string | null;
  id: string;
  isDefault: boolean;
  label: string | null;
  last4: string | null;
  paypalEmail: string | null;
  provider: string;
  secureVault?: {
    routingLast4: string;
  } | null;
  status: string;
  type: string;
  updatedAt: Date;
}): PaymentMethodSummary {
  const latestAuthorization = latestAuthorizationStatus(method.authorizations);
  const achMethod = isAchPaymentMethod(method);

  return {
    accountType: method.accountType,
    authorizationAcceptedAt: latestAuthorization?.acceptedAt.toISOString() ?? null,
    authorizationStatus: latestAuthorization?.status ?? null,
    authorized: achMethod
      ? latestAuthorization?.status === ACH_AUTHORIZATION_STATUSES.ACTIVE &&
        method.status === ACH_PAYMENT_METHOD_STATUSES.ACTIVE
      : true,
    bankName: method.bankName,
    brand: method.brand,
    createdAt: method.createdAt.toISOString(),
    holderName: method.holderName,
    id: method.id,
    isDefault: method.isDefault,
    label: method.label,
    last4: method.last4,
    maskedAccount: achMethod
      ? maskAccount(method.last4)
      : method.last4
        ? `**** ${method.last4}`
        : null,
    maskedRouting: achMethod ? maskRouting(method.secureVault?.routingLast4) : null,
    paypalEmail: method.paypalEmail,
    provider: method.provider,
    status: method.status,
    type: method.type,
    updatedAt: method.updatedAt.toISOString(),
  };
}

function formatUsageAmount(amount: Prisma.Decimal | null) {
  return amount ? amount.toString() : null;
}

async function getAchMethodForOrganization(
  organizationId: string,
  paymentMethodId: string,
) {
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: {
      id: paymentMethodId,
      organizationId,
      provider: ACH_PAYMENT_PROVIDER,
    },
    include: {
      authorizations: {
        orderBy: {
          acceptedAt: "desc",
        },
        take: 1,
      },
      secureVault: {
        select: {
          accountNumberEncrypted: true,
          id: true,
          routingLast4: true,
          routingNumberEncrypted: true,
        },
      },
    },
  });

  if (!paymentMethod) {
    throw new AchServiceError("ACH payment method not found.", 404);
  }

  return paymentMethod;
}

async function getAchMethodById(paymentMethodId: string) {
  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: {
      id: paymentMethodId,
      provider: ACH_PAYMENT_PROVIDER,
    },
    include: {
      authorizations: {
        orderBy: {
          acceptedAt: "desc",
        },
        take: 1,
      },
      secureVault: {
        select: {
          accountNumberEncrypted: true,
          id: true,
          routingLast4: true,
          routingNumberEncrypted: true,
        },
      },
    },
  });

  if (!paymentMethod) {
    throw new AchServiceError("ACH payment method not found.", 404);
  }

  return paymentMethod;
}

async function ensureReceiptDocumentExists(receiptDocumentId: string | null) {
  if (!receiptDocumentId) return;

  const receiptDocument = await prisma.document.findUnique({
    where: { id: receiptDocumentId },
    select: { id: true },
  });

  if (!receiptDocument) {
    throw new AchServiceError("Receipt document not found.", 404);
  }
}

function formatFilingPaymentUsage(usage: {
  amount: Prisma.Decimal | null;
  confirmationNumber: string | null;
  createdAt: Date;
  id: string;
  notes: string | null;
  paymentDate: Date | null;
  paymentMethod: {
    accountType: string | null;
    authorizations?: Array<{
      acceptedAt: Date;
      status: string;
    }>;
    bankName: string | null;
    brand: string | null;
    createdAt: Date;
    holderName: string | null;
    id: string;
    isDefault: boolean;
    label: string | null;
    last4: string | null;
    paypalEmail: string | null;
    provider: string;
    secureVault?: {
      routingLast4: string;
    } | null;
    status: string;
    type: string;
    updatedAt: Date;
  };
  portalName: string | null;
  receiptDocument: {
    id: string;
    name: string;
  } | null;
  status: string;
  updatedAt: Date;
  usageType: string;
  usedBy: {
    email: string | null;
    id: string;
    name: string | null;
  };
}): FilingPaymentUsageSummary {
  return {
    amount: formatUsageAmount(usage.amount),
    confirmationNumber: usage.confirmationNumber,
    createdAt: usage.createdAt.toISOString(),
    id: usage.id,
    notes: usage.notes,
    paymentDate: usage.paymentDate?.toISOString() ?? null,
    paymentMethod: formatPaymentMethod(usage.paymentMethod),
    portalName: usage.portalName,
    receiptDocument: usage.receiptDocument
      ? {
          id: usage.receiptDocument.id,
          name: usage.receiptDocument.name,
        }
      : null,
    status: usage.status,
    updatedAt: usage.updatedAt.toISOString(),
    usageType: usage.usageType,
    usedBy: usage.usedBy,
  };
}

export async function listUserPaymentMethods(userId: string) {
  const organization = await ensureUserOrganization(userId);
  const methods = await prisma.paymentMethod.findMany({
    where: {
      organizationId: organization.id,
    },
    include: {
      authorizations: {
        orderBy: {
          acceptedAt: "desc",
        },
        take: 1,
      },
      secureVault: {
        select: {
          routingLast4: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return methods.map(formatPaymentMethod);
}

export async function createAchPaymentMethod(
  userId: string,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  const organization = await ensureUserOrganization(userId);
  const payload = normalizeAchCreatePayload(rawInput);
  const encryptionMetadata = getCurrentAchKeyMetadata();
  const routingNumberEncrypted = encryptAchSecret(payload.routingNumber);
  const accountNumberEncrypted = encryptAchSecret(payload.accountNumber);
  const checksum = computeAchChecksum(payload.routingNumber, payload.accountNumber);

  const paymentMethod = await prisma.$transaction(async (tx) => {
    const secureVault = await tx.achSecureVault.create({
      data: {
        accountNumberEncrypted,
        checksum,
        encryptionKeyId: encryptionMetadata.keyId,
        encryptionVersion: encryptionMetadata.version,
        routingLast4: payload.routingNumber.slice(-4),
        routingNumberEncrypted,
        userId,
      },
    });

    const createdMethod = await tx.paymentMethod.create({
      data: {
        accountType: payload.accountType,
        bankName: payload.bankName,
        holderName: payload.holderName,
        isDefault: false,
        label: payload.label,
        last4: payload.accountNumber.slice(-4),
        organizationId: organization.id,
        provider: ACH_PAYMENT_PROVIDER,
        secureVaultId: secureVault.id,
        status: ACH_PAYMENT_METHOD_STATUSES.PENDING_AUTHORIZATION,
        type: ACH_PAYMENT_TYPE,
        userId,
      },
      include: {
        authorizations: {
          orderBy: {
            acceptedAt: "desc",
          },
          take: 1,
        },
        secureVault: {
          select: {
            routingLast4: true,
          },
        },
      },
    });

    await writeFinancialAccessAudit(tx, {
      action: FINANCIAL_AUDIT_ACTIONS.CREATE,
      actorUserId: userId,
      ipAddress: requestMetadata.ipAddress,
      paymentMethodId: createdMethod.id,
      resourceId: secureVault.id,
      resourceType: FINANCIAL_AUDIT_RESOURCES.ACH_VAULT,
      targetUserId: userId,
      userAgent: requestMetadata.userAgent,
    });

    return createdMethod;
  });

  return formatPaymentMethod(paymentMethod);
}

export async function authorizeAchPaymentMethod(
  actorUserId: string,
  paymentMethodId: string,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  const organization = await ensureUserOrganization(actorUserId);
  const payload = normalizeConsentPayload(rawInput);

  if (
    payload.consentVersion !== ACH_CONSENT_VERSION ||
    payload.consentText !== ACH_CONSENT_TEXT
  ) {
    throw new AchServiceError("Consent version is invalid or expired.");
  }

  const paymentMethod = await getAchMethodForOrganization(organization.id, paymentMethodId);
  if (paymentMethod.userId !== actorUserId) {
    throw new AchServiceError("You can only authorize your own ACH payment methods.", 403);
  }

  const updatedMethod = await prisma.$transaction(async (tx) => {
    await tx.achAuthorization.updateMany({
      where: {
        paymentMethodId,
        status: ACH_AUTHORIZATION_STATUSES.ACTIVE,
      },
      data: {
        status: ACH_AUTHORIZATION_STATUSES.SUPERSEDED,
      },
    });

    const authorization = await tx.achAuthorization.create({
      data: {
        acceptedAt: new Date(),
        acceptedByUserId: actorUserId,
        consentText: payload.consentText,
        consentVersion: payload.consentVersion,
        ipAddress: requestMetadata.ipAddress,
        paymentMethodId,
        status: ACH_AUTHORIZATION_STATUSES.ACTIVE,
        userAgent: requestMetadata.userAgent,
        userId: actorUserId,
      },
    });

    const method = await tx.paymentMethod.update({
      where: { id: paymentMethodId },
      data: {
        status: ACH_PAYMENT_METHOD_STATUSES.ACTIVE,
      },
      include: {
        authorizations: {
          orderBy: {
            acceptedAt: "desc",
          },
          take: 1,
        },
        secureVault: {
          select: {
            routingLast4: true,
          },
        },
      },
    });

    await writeFinancialAccessAudit(tx, {
      action: FINANCIAL_AUDIT_ACTIONS.AUTHORIZE,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      paymentMethodId,
      resourceId: authorization.id,
      resourceType: FINANCIAL_AUDIT_RESOURCES.ACH_AUTHORIZATION,
      targetUserId: actorUserId,
      userAgent: requestMetadata.userAgent,
    });

    return method;
  });

  return formatPaymentMethod(updatedMethod);
}

export async function revokeAchPaymentMethod(
  actorUserId: string,
  paymentMethodId: string,
  requestMetadata: RequestMetadata,
) {
  const organization = await ensureUserOrganization(actorUserId);
  const paymentMethod = await getAchMethodForOrganization(organization.id, paymentMethodId);

  if (paymentMethod.userId !== actorUserId) {
    throw new AchServiceError("You can only revoke your own ACH payment methods.", 403);
  }

  const revokedMethod = await prisma.$transaction(async (tx) => {
    await tx.achAuthorization.updateMany({
      where: {
        paymentMethodId,
        status: ACH_AUTHORIZATION_STATUSES.ACTIVE,
      },
      data: {
        status: ACH_AUTHORIZATION_STATUSES.REVOKED,
      },
    });

    const method = await tx.paymentMethod.update({
      where: { id: paymentMethodId },
      data: {
        isDefault: false,
        status: ACH_PAYMENT_METHOD_STATUSES.REVOKED,
      },
      include: {
        authorizations: {
          orderBy: {
            acceptedAt: "desc",
          },
          take: 1,
        },
        secureVault: {
          select: {
            routingLast4: true,
          },
        },
      },
    });

    await writeFinancialAccessAudit(tx, {
      action: FINANCIAL_AUDIT_ACTIONS.REVOKE,
      actorUserId,
      ipAddress: requestMetadata.ipAddress,
      paymentMethodId,
      resourceId: paymentMethodId,
      resourceType: FINANCIAL_AUDIT_RESOURCES.PAYMENT_METHOD,
      targetUserId: actorUserId,
      userAgent: requestMetadata.userAgent,
    });

    return method;
  });

  return formatPaymentMethod(revokedMethod);
}

export async function getMaskedAchPaymentMethod(
  actorUserId: string,
  paymentMethodId: string,
  requestMetadata: RequestMetadata,
) {
  const organization = await ensureUserOrganization(actorUserId);
  const paymentMethod = await getAchMethodForOrganization(organization.id, paymentMethodId);

  if (paymentMethod.userId !== actorUserId) {
    throw new AchServiceError("You can only view your own ACH payment methods.", 403);
  }

  await writeFinancialAccessAudit(prisma, {
    action: FINANCIAL_AUDIT_ACTIONS.VIEW_MASKED,
    actorUserId,
    ipAddress: requestMetadata.ipAddress,
    paymentMethodId,
    resourceId: paymentMethod.secureVault?.id ?? paymentMethodId,
    resourceType: FINANCIAL_AUDIT_RESOURCES.ACH_VAULT,
    targetUserId: paymentMethod.userId,
    userAgent: requestMetadata.userAgent,
  });

  return formatPaymentMethod(paymentMethod);
}

export async function revealAchPaymentMethod(
  actorUserId: string,
  paymentMethodId: string,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  const paymentMethod = await getAchMethodById(paymentMethodId);
  const reason = normalizeRevealReason(rawInput);

  if (!paymentMethod.secureVault) {
    throw new AchServiceError("Secure ACH vault record is unavailable.", 500);
  }

  if (paymentMethod.status !== ACH_PAYMENT_METHOD_STATUSES.ACTIVE) {
    throw new AchServiceError("Only active ACH payment methods can be revealed.");
  }

  const activeAuthorization = paymentMethod.authorizations.find(
    (authorization) => authorization.status === ACH_AUTHORIZATION_STATUSES.ACTIVE,
  );
  if (!activeAuthorization) {
    throw new AchServiceError("ACH authorization is required before revealing bank data.");
  }

  assertRevealRateLimit(actorUserId, paymentMethodId);

  const routingNumber = decryptAchSecret(paymentMethod.secureVault.routingNumberEncrypted);
  const accountNumber = decryptAchSecret(paymentMethod.secureVault.accountNumberEncrypted);

  await writeFinancialAccessAudit(prisma, {
    action: FINANCIAL_AUDIT_ACTIONS.REVEAL,
    actorUserId,
    ipAddress: requestMetadata.ipAddress,
    paymentMethodId,
    reason,
    resourceId: paymentMethod.secureVault.id,
    resourceType: FINANCIAL_AUDIT_RESOURCES.ACH_VAULT,
    targetUserId: paymentMethod.userId,
    userAgent: requestMetadata.userAgent,
  });

  return {
    accountNumber,
    accountType: paymentMethod.accountType,
    bankName: paymentMethod.bankName,
    expiresInSeconds: 60,
    holderName: paymentMethod.holderName,
    paymentMethodId: paymentMethod.id,
    routingNumber,
  };
}

export async function getFilingPaymentWorkspace(
  filingType: FilingType,
  filingId: string,
): Promise<FilingPaymentWorkspace> {
  const filing = await resolveFilingTarget(filingType, filingId);
  const organizationId = await getUserOrganizationId(filing.userId);

  const [methods, usages] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: {
        organizationId,
        provider: ACH_PAYMENT_PROVIDER,
        status: {
          in: [...ACTIVE_ACH_METHOD_STATUSES],
        },
      },
      include: {
        authorizations: {
          orderBy: {
            acceptedAt: "desc",
          },
          take: 1,
        },
        secureVault: {
          select: {
            routingLast4: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    }),
    prisma.filingPaymentUsage.findMany({
      where: {
        filingId,
        filingType,
      },
      include: {
        paymentMethod: {
          include: {
            authorizations: {
              orderBy: {
                acceptedAt: "desc",
              },
              take: 1,
            },
            secureVault: {
              select: {
                routingLast4: true,
              },
            },
          },
        },
        receiptDocument: {
          select: {
            id: true,
            name: true,
          },
        },
        usedBy: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    filing: {
      defaultUsageType: filing.defaultUsageType,
      filingId: filing.filingId,
      filingType: filing.filingType,
      title: filing.title,
      userId: filing.userId,
    },
    methods: methods.map(formatPaymentMethod),
    usages: usages.map(formatFilingPaymentUsage),
  };
}

export async function createFilingPaymentUsage(
  actorUserId: string,
  filingType: FilingType,
  filingId: string,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  const filing = await resolveFilingTarget(filingType, filingId);
  const payload = normalizeFilingUsageCreatePayload(rawInput);
  const organizationId = await getUserOrganizationId(filing.userId);
  const paymentMethod = await getAchMethodForOrganization(
    organizationId,
    payload.paymentMethodId,
  );

  const latestAuthorization = latestAuthorizationStatus(paymentMethod.authorizations);
  if (
    paymentMethod.status !== ACH_PAYMENT_METHOD_STATUSES.ACTIVE ||
    latestAuthorization?.status !== ACH_AUTHORIZATION_STATUSES.ACTIVE
  ) {
    throw new AchServiceError(
      "Only active, authorized ACH payment methods can be used for manual payment.",
    );
  }

  const usage = await prisma.filingPaymentUsage.create({
    data: {
      amount:
        typeof payload.amount === "number"
          ? new Prisma.Decimal(payload.amount)
          : null,
      filingId,
      filingType,
      notes: payload.notes,
      paymentMethodId: paymentMethod.id,
      portalName: payload.portalName,
      status: FILING_PAYMENT_USAGE_STATUSES.PROCESSING,
      targetUserId: filing.userId,
      usageType: payload.usageType,
      usedByUserId: actorUserId,
    },
    include: {
      paymentMethod: {
        include: {
          authorizations: {
            orderBy: {
              acceptedAt: "desc",
            },
            take: 1,
          },
          secureVault: {
            select: {
              routingLast4: true,
            },
          },
        },
      },
      receiptDocument: {
        select: {
          id: true,
          name: true,
        },
      },
      usedBy: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
  });

  await writeFinancialAccessAudit(prisma, {
    action: FINANCIAL_AUDIT_ACTIONS.USE_FOR_PAYMENT,
    actorUserId,
    filingId,
    filingType,
    ipAddress: requestMetadata.ipAddress,
    paymentMethodId: paymentMethod.id,
    reason: payload.notes,
    resourceId: usage.id,
    resourceType: FINANCIAL_AUDIT_RESOURCES.FILING,
    targetUserId: filing.userId,
    userAgent: requestMetadata.userAgent,
  });

  return formatFilingPaymentUsage(usage);
}

async function updateFilingPaymentUsage(
  actorUserId: string,
  filingType: FilingType,
  filingId: string,
  usageId: string,
  status: FilingPaymentUsageStatus,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  const payload = normalizeFilingUsageUpdatePayload(rawInput);
  const filing = await resolveFilingTarget(filingType, filingId);
  await ensureReceiptDocumentExists(payload.receiptDocumentId);

  const usage = await prisma.filingPaymentUsage.findFirst({
    where: {
      filingId,
      filingType,
      id: usageId,
    },
    include: {
      paymentMethod: {
        include: {
          authorizations: {
            orderBy: {
              acceptedAt: "desc",
            },
            take: 1,
          },
          secureVault: {
            select: {
              routingLast4: true,
            },
          },
        },
      },
      receiptDocument: {
        select: {
          id: true,
          name: true,
        },
      },
      usedBy: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
  });

  if (!usage) {
    throw new AchServiceError("Filing payment usage not found.", 404);
  }

  const paymentDate =
    status === FILING_PAYMENT_USAGE_STATUSES.PAID
      ? payload.paymentDate
        ? new Date(payload.paymentDate)
        : new Date()
      : payload.paymentDate
        ? new Date(payload.paymentDate)
        : null;

  if (paymentDate && Number.isNaN(paymentDate.getTime())) {
    throw new AchServiceError("Payment date is invalid.");
  }

  const updatedUsage = await prisma.filingPaymentUsage.update({
    where: {
      id: usageId,
    },
    data: {
      confirmationNumber: payload.confirmationNumber,
      notes: payload.notes,
      paymentDate,
      receiptDocumentId: payload.receiptDocumentId,
      status,
    },
    include: {
      paymentMethod: {
        include: {
          authorizations: {
            orderBy: {
              acceptedAt: "desc",
            },
            take: 1,
          },
          secureVault: {
            select: {
              routingLast4: true,
            },
          },
        },
      },
      receiptDocument: {
        select: {
          id: true,
          name: true,
        },
      },
      usedBy: {
        select: {
          email: true,
          id: true,
          name: true,
        },
      },
    },
  });

  await writeFinancialAccessAudit(prisma, {
    action: FINANCIAL_AUDIT_ACTIONS.UPDATE,
    actorUserId,
    filingId,
    filingType,
    ipAddress: requestMetadata.ipAddress,
    paymentMethodId: usage.paymentMethodId,
    reason: payload.notes,
    resourceId: usageId,
    resourceType: FINANCIAL_AUDIT_RESOURCES.FILING,
    targetUserId: filing.userId,
    userAgent: requestMetadata.userAgent,
  });

  return formatFilingPaymentUsage(updatedUsage);
}

export async function completeFilingPaymentUsage(
  actorUserId: string,
  filingType: FilingType,
  filingId: string,
  usageId: string,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  return updateFilingPaymentUsage(
    actorUserId,
    filingType,
    filingId,
    usageId,
    FILING_PAYMENT_USAGE_STATUSES.PAID,
    rawInput,
    requestMetadata,
  );
}

export async function failFilingPaymentUsage(
  actorUserId: string,
  filingType: FilingType,
  filingId: string,
  usageId: string,
  rawInput: unknown,
  requestMetadata: RequestMetadata,
) {
  return updateFilingPaymentUsage(
    actorUserId,
    filingType,
    filingId,
    usageId,
    FILING_PAYMENT_USAGE_STATUSES.FAILED,
    rawInput,
    requestMetadata,
  );
}
