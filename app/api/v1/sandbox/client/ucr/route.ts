import { UCREntityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { buildSandboxActingUserContext, getSandboxErrorStatus } from "@/lib/sandbox/server";
import { getCompanyProfile } from "@/lib/services/company.service";
import { createSandboxAuditFromContext } from "@/services/sandbox/createSandboxAudit";
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
    const companyProfile = actingUserId ? await getCompanyProfile(actingUserId) : null;
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

    const filing = await createUcrFiling(
      { db: ctx.db },
      {
        userId: actingUserId,
        filingYear,
        legalName,
        usdotNumber,
        mcNumber,
        fein,
        baseState,
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
