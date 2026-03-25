import { Prisma, UCREntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import { canEditUcrFiling } from "@/lib/ucr-workflow";
import { UcrServiceError, sanitizeStateCode, ucrFilingInclude } from "@/services/ucr/shared";

type UpdateUcrFilingInput = {
  filingId: string;
  actorUserId: string;
  filingYear?: number;
  legalName?: string;
  usdotNumber?: string | null;
  mcNumber?: string | null;
  fein?: string | null;
  baseState?: string | null;
  entityType?: UCREntityType;
  interstateOperation?: boolean;
  fleetSize?: number;
  clientNotes?: string | null;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function updateUcrFiling(
  input: UpdateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function updateUcrFiling(
  ctx: Pick<ServiceContext, "db">,
  input: UpdateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.update>>>;
export async function updateUcrFiling(
  ctxOrInput: Pick<ServiceContext, "db"> | UpdateUcrFilingInput,
  maybeInput?: UpdateUcrFilingInput,
) {
  const input = maybeInput ?? (ctxOrInput as UpdateUcrFilingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const existing = await db.uCRFiling.findUnique({
    where: { id: input.filingId },
    include: ucrFilingInclude,
  });

  if (!existing) {
    throw new UcrServiceError("UCR filing not found", 404, "FILING_NOT_FOUND");
  }

  if (existing.userId !== input.actorUserId) {
    throw new UcrServiceError("Forbidden", 403, "FORBIDDEN");
  }

  if (!canEditUcrFiling(existing.status)) {
    throw new UcrServiceError(
      "This filing is no longer editable.",
      409,
      "FILING_NOT_EDITABLE",
    );
  }

  const filingYear = input.filingYear ?? existing.filingYear;
  const fleetSize = input.fleetSize ?? existing.fleetSize;
  const rate = await getUcrRateForFleet({ db }, { year: filingYear, fleetSize });

  try {
    return await db.uCRFiling.update({
      where: { id: input.filingId },
      data: {
        filingYear,
        legalName:
          typeof input.legalName === "string"
            ? input.legalName.trim()
            : existing.legalName,
        usdotNumber:
          typeof input.usdotNumber === "undefined"
            ? undefined
            : input.usdotNumber?.trim() || null,
        mcNumber:
          typeof input.mcNumber === "undefined"
            ? undefined
            : input.mcNumber?.trim() || null,
        fein:
          typeof input.fein === "undefined"
            ? undefined
            : input.fein?.trim() || null,
        baseState:
          typeof input.baseState === "undefined"
            ? undefined
            : sanitizeStateCode(input.baseState) ?? null,
        entityType: input.entityType ?? existing.entityType,
        interstateOperation:
          typeof input.interstateOperation === "boolean"
            ? input.interstateOperation
            : existing.interstateOperation,
        fleetSize,
        bracketLabel: rate.bracketLabel,
        feeAmount: new Prisma.Decimal(rate.feeAmount),
        clientNotes:
          typeof input.clientNotes === "undefined"
            ? undefined
            : input.clientNotes?.trim() || null,
      },
      include: ucrFilingInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UcrServiceError(
        "A UCR filing already exists for that year.",
        409,
        "DUPLICATE_FILING",
      );
    }
    throw error;
  }
}
