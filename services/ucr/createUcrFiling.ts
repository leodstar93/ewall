import { Prisma, UCREntityType, UCRFilingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient, ServiceContext } from "@/lib/db/types";
import { getUcrRateForFleet } from "@/services/ucr/getUcrRateForFleet";
import { UcrServiceError, sanitizeStateCode } from "@/services/ucr/shared";

type CreateUcrFilingInput = {
  userId: string;
  filingYear: number;
  legalName: string;
  usdotNumber?: string | null;
  mcNumber?: string | null;
  fein?: string | null;
  baseState?: string | null;
  entityType: UCREntityType;
  interstateOperation?: boolean;
  fleetSize: number;
  clientNotes?: string | null;
};

function resolveDb(ctxOrDb?: Pick<ServiceContext, "db"> | DbClient | null) {
  if (!ctxOrDb) return prisma;
  if ("db" in ctxOrDb) return ctxOrDb.db;
  return ctxOrDb;
}

export async function createUcrFiling(
  input: CreateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.create>>>;
export async function createUcrFiling(
  ctx: Pick<ServiceContext, "db">,
  input: CreateUcrFilingInput,
): Promise<Awaited<ReturnType<typeof prisma.uCRFiling.create>>>;
export async function createUcrFiling(
  ctxOrInput: Pick<ServiceContext, "db"> | CreateUcrFilingInput,
  maybeInput?: CreateUcrFilingInput,
) {
  const input = maybeInput ?? (ctxOrInput as CreateUcrFilingInput);
  const db = resolveDb(maybeInput ? (ctxOrInput as Pick<ServiceContext, "db">) : null);

  const legalName = input.legalName.trim();
  if (!legalName) {
    throw new UcrServiceError("Legal name is required", 400, "LEGAL_NAME_REQUIRED");
  }

  const rate = await getUcrRateForFleet({ db }, {
    year: input.filingYear,
    fleetSize: input.fleetSize,
  });

  try {
    return await db.uCRFiling.create({
      data: {
        userId: input.userId,
        filingYear: input.filingYear,
        legalName,
        usdotNumber: input.usdotNumber?.trim() || null,
        mcNumber: input.mcNumber?.trim() || null,
        fein: input.fein?.trim() || null,
        baseState: sanitizeStateCode(input.baseState) ?? null,
        entityType: input.entityType,
        interstateOperation: input.interstateOperation ?? true,
        fleetSize: input.fleetSize,
        bracketLabel: rate.bracketLabel,
        feeAmount: new Prisma.Decimal(rate.feeAmount),
        status: UCRFilingStatus.DRAFT,
        clientNotes: input.clientNotes?.trim() || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        documents: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
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
