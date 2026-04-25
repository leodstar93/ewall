import {
  IftaFilingMethod,
  IftaJurisdictionPaymentMethod,
} from "@prisma/client";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { prisma } from "@/lib/prisma";

type ProcedureBody = {
  title?: unknown;
  portalUrl?: unknown;
  filingMethod?: unknown;
  paymentMethod?: unknown;
  requiresPortalLogin?: unknown;
  requiresClientCredential?: unknown;
  supportsUpload?: unknown;
  staffInstructions?: unknown;
  checklist?: unknown;
  isActive?: unknown;
};

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) return null;
  return normalized;
}

function normalizeRequiredString(value: unknown, maxLength: number) {
  const normalized = normalizeOptionalString(value, maxLength);
  return normalized && normalized.length > 0 ? normalized : null;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function parseFilingMethod(value: unknown) {
  return typeof value === "string" &&
    Object.values(IftaFilingMethod).includes(value as IftaFilingMethod)
    ? (value as IftaFilingMethod)
    : null;
}

function parsePaymentMethod(value: unknown) {
  return typeof value === "string" &&
    Object.values(IftaJurisdictionPaymentMethod).includes(
      value as IftaJurisdictionPaymentMethod,
    )
    ? (value as IftaJurisdictionPaymentMethod)
    : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return null;

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return items;
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ jurisdiction: string }> },
) {
  const guard = await requireAdminSettingsApiAccess("ifta:settings");
  if (!guard.ok) return guard.res;

  try {
    const { jurisdiction: rawJurisdiction } = await context.params;
    const jurisdiction = rawJurisdiction.trim().toUpperCase();
    if (!jurisdiction) {
      return Response.json({ error: "Jurisdiction is required" }, { status: 400 });
    }

    const jurisdictionRecord = await prisma.jurisdiction.findUnique({
      where: { code: jurisdiction },
      select: {
        code: true,
        isActive: true,
        isIftaMember: true,
      },
    });

    if (!jurisdictionRecord || !jurisdictionRecord.isActive || !jurisdictionRecord.isIftaMember) {
      return Response.json({ error: "Invalid IFTA jurisdiction" }, { status: 404 });
    }

    const body = (await request.json()) as ProcedureBody;
    const title = normalizeRequiredString(body.title, 180);
    const portalUrl =
      typeof body.portalUrl === "string" && body.portalUrl.trim().length === 0
        ? null
        : normalizeOptionalString(body.portalUrl, 500);
    const filingMethod = parseFilingMethod(body.filingMethod);
    const paymentMethod = parsePaymentMethod(body.paymentMethod);
    const staffSteps = normalizeStringArray(body.staffInstructions);
    const checklist = normalizeStringArray(body.checklist) ?? [];

    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    if (!filingMethod) {
      return Response.json({ error: "Invalid filing method" }, { status: 400 });
    }

    if (!paymentMethod) {
      return Response.json({ error: "Invalid payment method" }, { status: 400 });
    }

    if (!staffSteps || staffSteps.length === 0) {
      return Response.json(
        { error: "At least one staff instruction step is required" },
        { status: 400 },
      );
    }

    const saved = await prisma.iftaJurisdictionProcedure.upsert({
      where: { jurisdiction },
      update: {
        title,
        portalUrl,
        filingMethod,
        paymentMethod,
        requiresPortalLogin: parseBoolean(body.requiresPortalLogin, true),
        requiresClientCredential: parseBoolean(body.requiresClientCredential, true),
        supportsUpload: parseBoolean(body.supportsUpload, false),
        staffInstructions: {
          steps: staffSteps,
        },
        checklist,
        isActive: parseBoolean(body.isActive, true),
      },
      create: {
        jurisdiction,
        title,
        portalUrl,
        filingMethod,
        paymentMethod,
        requiresPortalLogin: parseBoolean(body.requiresPortalLogin, true),
        requiresClientCredential: parseBoolean(body.requiresClientCredential, true),
        supportsUpload: parseBoolean(body.supportsUpload, false),
        staffInstructions: {
          steps: staffSteps,
        },
        checklist,
        isActive: parseBoolean(body.isActive, true),
      },
    });

    return Response.json({ procedure: saved });
  } catch (error) {
    console.error("Error saving IFTA jurisdiction procedure:", error);
    return Response.json(
      { error: "Failed to save IFTA process settings" },
      { status: 500 },
    );
  }
}
