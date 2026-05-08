import { IftaAuthorizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SignIftaAuthorizationInput = {
  filingId: string;
  actorUserId: string;
  signerName: string;
  signerTitle: string;
  signatureText: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class IftaAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "IftaAuthorizationError";
  }
}

export async function signIftaAuthorization(input: SignIftaAuthorizationInput) {
  if (!input.signerName.trim()) {
    throw new IftaAuthorizationError("Signer name is required.", 400, "SIGNER_NAME_REQUIRED");
  }
  if (!input.signatureText.trim()) {
    throw new IftaAuthorizationError("Signature text is required.", 400, "SIGNATURE_TEXT_REQUIRED");
  }

  const filing = await prisma.iftaFiling.findUnique({
    where: { id: input.filingId },
    select: { id: true, tenantId: true, status: true },
  });

  if (!filing) {
    throw new IftaAuthorizationError("IFTA filing not found.", 404, "FILING_NOT_FOUND");
  }

  const settings = await prisma.iftaAdminSetting.findFirst({
    orderBy: { createdAt: "desc" },
    select: { disclosureText: true },
  });

  return await prisma.$transaction(async (tx) => {
    const authorization = await tx.iftaClientAuthorization.upsert({
      where: { filingId: input.filingId },
      create: {
        filingId: input.filingId,
        status: IftaAuthorizationStatus.SIGNED,
        signerName: input.signerName.trim(),
        signerTitle: input.signerTitle.trim(),
        signatureText: input.signatureText.trim(),
        disclosureText: settings?.disclosureText ?? null,
        signedAt: new Date(),
        signedByUserId: input.actorUserId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      update: {
        status: IftaAuthorizationStatus.SIGNED,
        signerName: input.signerName.trim(),
        signerTitle: input.signerTitle.trim(),
        signatureText: input.signatureText.trim(),
        disclosureText: settings?.disclosureText ?? null,
        signedAt: new Date(),
        signedByUserId: input.actorUserId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });

    await tx.iftaAuditLog.create({
      data: {
        filingId: input.filingId,
        actorUserId: input.actorUserId,
        action: "filing.authorization_signed",
        payloadJson: {
          signerName: input.signerName.trim(),
          signerTitle: input.signerTitle.trim(),
        },
      },
    });

    return authorization;
  });
}
