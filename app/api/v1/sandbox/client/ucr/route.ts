import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
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

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: getSandboxErrorStatus(error) });
}

export async function GET() {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();

    const filings = await ctx.db.uCRFiling.findMany({
      where: {
        userId: actingUserId,
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
    return toErrorResponse(error, "Failed to load sandbox UCR filings");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actingUserId, ctx } = await buildSandboxActingUserContext();
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

    const filing = await createUcrFiling(
      { db: ctx.db },
      {
        userId: actingUserId,
        filingYear,
        legalName,
        usdotNumber: normalizeOptionalText(body.usdotNumber),
        mcNumber: normalizeOptionalText(body.mcNumber),
        fein: normalizeOptionalText(body.fein),
        baseState: sanitizeStateCode(body.baseState),
        entityType,
        interstateOperation:
          typeof body.interstateOperation === "boolean"
            ? body.interstateOperation
            : true,
        fleetSize,
        clientNotes: normalizeOptionalText(body.clientNotes),
      },
    );

    await createSandboxAuditFromContext(ctx, {
      action: "sandbox.ucr.client.create",
      entityType: "UCRFiling",
      entityId: filing.id,
      metadataJson: {
        filingYear: filing.filingYear,
        legalName: filing.legalName,
      },
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create sandbox UCR filing");
  }
}
