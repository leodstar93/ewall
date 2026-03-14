import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { createUcrFiling } from "@/services/ucr/createUcrFiling";
import {
  normalizeOptionalText,
  parseEntityType,
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
    const fleetSize = parseNonNegativeInt(body.fleetSize);
    const entityType = parseEntityType(body.entityType);
    const legalName =
      typeof body.legalName === "string" ? body.legalName.trim() : "";

    if (!filingYear) {
      return Response.json({ error: "Invalid filingYear" }, { status: 400 });
    }

    if (!entityType) {
      return Response.json({ error: "Invalid entityType" }, { status: 400 });
    }

    if (fleetSize === null) {
      return Response.json({ error: "Invalid fleetSize" }, { status: 400 });
    }

    if (!legalName) {
      return Response.json({ error: "legalName is required" }, { status: 400 });
    }

    const filing = await createUcrFiling({
      userId: guard.session.user.id ?? "",
      filingYear,
      legalName,
      usdotNumber: normalizeOptionalText(body.usdotNumber),
      mcNumber: normalizeOptionalText(body.mcNumber),
      fein: normalizeOptionalText(body.fein),
      baseState: sanitizeStateCode(body.baseState),
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
