import { UCREntityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { getCompanyProfile } from "@/lib/services/company.service";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { createUcrFiling } from "@/services/ucr/createUcrFiling";
import {
  normalizeOptionalText,
  parseFilingYear,
  parseNonNegativeInt,
  sanitizeStateCode,
  UcrServiceError,
  ucrFilingInclude,
} from "@/services/ucr/shared";

type CreateUcrFilingBody = {
  year?: unknown;
  legalName?: unknown;
  dbaName?: unknown;
  dotNumber?: unknown;
  mcNumber?: unknown;
  fein?: unknown;
  baseState?: unknown;
  entityType?: unknown;
  interstateOperation?: unknown;
  vehicleCount?: unknown;
  clientNotes?: unknown;
};

function getMissingCompanyInfo(input: {
  legalName?: string | null;
  dotNumber?: string | null;
  baseState?: string | null;
}) {
  const missing: string[] = [];

  if (!input.legalName?.trim()) missing.push("Legal company name");
  if (!input.dotNumber?.trim()) missing.push("DOT number");
  if (!input.baseState?.trim()) missing.push("Base state");

  return missing;
}

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
  const guard = await requireApiPermission("ucr:read_own");
  if (!guard.ok) return guard.res;

  try {
    const filings = await prisma.uCRFiling.findMany({
      where: {
        userId: guard.session.user.id ?? "",
      },
      include: ucrFilingInclude,
      orderBy: [{ year: "desc" }, { updatedAt: "desc" }],
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
    const year = parseFilingYear(body.year);
    const userId = guard.session.user.id ?? "";
    const companyProfile = userId ? await getCompanyProfile(userId) : null;
    const organization = userId ? await ensureUserOrganization(userId) : null;
    const legalNameInput =
      typeof body.legalName === "string" ? body.legalName.trim() : "";
    const legalName = legalNameInput || companyProfile?.legalName || companyProfile?.companyName || "";
    const dotNumber = normalizeOptionalText(body.dotNumber) ?? companyProfile?.dotNumber ?? null;
    const mcNumber = normalizeOptionalText(body.mcNumber) ?? companyProfile?.mcNumber ?? null;
    const fein = normalizeOptionalText(body.fein) ?? companyProfile?.ein ?? null;
    const baseState = sanitizeStateCode(body.baseState) ?? companyProfile?.state ?? null;
    const vehicleCount =
      parseNonNegativeInt(body.vehicleCount) ??
      (companyProfile?.trucksCount ? parseNonNegativeInt(companyProfile.trucksCount) : null);
    const entityType = UCREntityType.MOTOR_CARRIER;
    const missingCompanyInfo = getMissingCompanyInfo({
      legalName,
      dotNumber,
      baseState,
    });

    if (!year) {
      return Response.json({ error: "Invalid year" }, { status: 400 });
    }

    if (!vehicleCount) {
      return Response.json({ error: "Invalid vehicleCount" }, { status: 400 });
    }

    if (missingCompanyInfo.length > 0) {
      return Response.json(
        {
          error: "Complete Company Info before creating a UCR filing.",
          details: missingCompanyInfo.map((field) => `${field} is required in Company Info.`),
        },
        { status: 400 },
      );
    }

    const filing = await createUcrFiling({
      userId,
      organizationId: organization?.id ?? null,
      year,
      legalName,
      dbaName: normalizeOptionalText(body.dbaName) ?? companyProfile?.dbaName ?? null,
      dotNumber,
      mcNumber,
      fein,
      baseState,
      entityType,
      interstateOperation:
        typeof body.interstateOperation === "boolean" ? body.interstateOperation : true,
      vehicleCount,
      clientNotes: normalizeOptionalText(body.clientNotes),
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create UCR filing");
  }
}
