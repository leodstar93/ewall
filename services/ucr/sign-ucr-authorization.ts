import { UCRAuthorizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SignUcrAuthorizationInput = {
  filingId: string;
  actorUserId: string;
  signerName: string;
  signerTitle: string;
  signatureText: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class UcrAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "UcrAuthorizationError";
  }
}

export async function signUcrAuthorization(input: SignUcrAuthorizationInput) {
  if (!input.signerName.trim()) {
    throw new UcrAuthorizationError("Signer name is required.", 400, "SIGNER_NAME_REQUIRED");
  }
  if (!input.signatureText.trim()) {
    throw new UcrAuthorizationError("Signature text is required.", 400, "SIGNATURE_TEXT_REQUIRED");
  }

  const filing = await prisma.uCRFiling.findUnique({
    where: { id: input.filingId },
    select: { id: true, userId: true, status: true },
  });

  if (!filing) {
    throw new UcrAuthorizationError("UCR filing not found.", 404, "FILING_NOT_FOUND");
  }

  const settings = await prisma.uCRAdminSetting.findFirst({
    orderBy: { createdAt: "desc" },
    select: { disclosureText: true },
  });

  return await prisma.$transaction(async (tx) => {
    const authorization = await tx.uCRClientAuthorization.upsert({
      where: { filingId: input.filingId },
      create: {
        filingId: input.filingId,
        status: UCRAuthorizationStatus.SIGNED,
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
        status: UCRAuthorizationStatus.SIGNED,
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

    await tx.uCRFilingEvent.create({
      data: {
        filingId: input.filingId,
        actorUserId: input.actorUserId,
        eventType: "AUTHORIZATION_SIGNED",
        metaJson: {
          signerName: input.signerName.trim(),
          signerTitle: input.signerTitle.trim(),
        },
      },
    });

    return authorization;
  });
}
