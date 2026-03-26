import { UCREntityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { getCompanyProfile } from "@/lib/services/company.service";
import { createUcrFiling } from "@/services/ucr/createUcrFiling";
import {
  normalizeOptionalText,
  parseFilingYear,
  parseNonNegativeInt,
  sanitizeStateCode,
  UcrServiceError,
} from "@/services/ucr/shared";

type CreateUcrFilingBody = {
  filingYear?: unknown;
  legalName?: unknown;
  usdotNumber?: unknown;
  mcNumber?: unknown;
  fein?: unknown;
  baseState?: unknown;
  entityType?: unknown;
  interstateOperation?: unknown;
  fleetSize?: unknown;
  clientNotes?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof UcrServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  const guard = await requireApiPermission("ucr:read");
  if (!guard.ok) return guard.res;

  try {
    const filings = await prisma.uCRFiling.findMany({
      where: {
        userId: guard.session.user.id ?? "",
      },
      include: {
        documents: {
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ filingYear: "desc" }, { updatedAt: "desc" }],
    });

    return Response.json({ filings });
  } catch (error) {
    return toErrorResponse(error, "Failed to load UCR filings");
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("ucr:create");
  if (!guard.ok) return guard.res;

  try {
    const body = (await request.json()) as CreateUcrFilingBody;
    const filingYear = parseFilingYear(body.filingYear);
    const userId = guard.session.user.id ?? "";
    const companyProfile = userId ? await getCompanyProfile(userId) : null;
    const legalNameInput =
      typeof body.legalName === "string" ? body.legalName.trim() : "";
    const legalName = legalNameInput || companyProfile?.legalName || "";
    const usdotNumber = normalizeOptionalText(body.usdotNumber) ?? companyProfile?.dotNumber ?? null;
    const mcNumber = normalizeOptionalText(body.mcNumber) ?? companyProfile?.mcNumber ?? null;
    const fein = normalizeOptionalText(body.fein) ?? companyProfile?.ein ?? null;
    const baseState = sanitizeStateCode(body.baseState) ?? companyProfile?.state ?? null;
    const fleetSize =
      parseNonNegativeInt(body.fleetSize) ??
      (companyProfile?.trucksCount ? parseNonNegativeInt(companyProfile.trucksCount) : null);
    const entityType = UCREntityType.MOTOR_CARRIER;

    if (!filingYear) {
      return Response.json({ error: "Invalid filingYear" }, { status: 400 });
    }

    if (fleetSize === null) {
      return Response.json({ error: "Invalid fleetSize" }, { status: 400 });
    }

    if (!legalName) {
      return Response.json({ error: "legalName is required" }, { status: 400 });
    }

    const filing = await createUcrFiling({
      userId,
      filingYear,
      legalName,
      usdotNumber,
      mcNumber,
      fein,
      baseState,
      entityType,
      interstateOperation:
        typeof body.interstateOperation === "boolean" ? body.interstateOperation : true,
      fleetSize,
      clientNotes: normalizeOptionalText(body.clientNotes),
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create UCR filing");
  }
}
