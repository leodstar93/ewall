import { NextRequest } from "next/server";
import { Form2290ProcessingMode } from "@prisma/client";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { parseNonNegativeInteger, parsePositiveInteger } from "@/lib/validations/form2290";
import { list2290SettingsBundle, update2290Settings } from "@/services/form2290/settings.service";
import { Form2290ServiceError, getForm2290Settings } from "@/services/form2290/shared";

type UpdateSettingsBody = {
  minimumEligibleWeight?: unknown;
  expirationWarningDays?: unknown;
  serviceFeeCents?: unknown;
  enabled?: unknown;
  processingMode?: unknown;
  requirePaymentBeforeSubmit?: unknown;
  collectIrsTaxEstimate?: unknown;
  allowCustomerPaysProvider?: unknown;
  allowEwallCollectsAndRemits?: unknown;
  requireSchedule1ForCompliance?: unknown;
  authorizationText?: unknown;
  providerName?: unknown;
  providerUrl?: unknown;
  operationalInstructions?: unknown;
  howToProcessClient?: unknown;
  howToProcessStaff?: unknown;
  internalStaffChecklist?: unknown;
};

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Form2290ServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const { settings, taxPeriods } = await list2290SettingsBundle();
    return Response.json({ settings, taxPeriods });
  } catch (error) {
    return toErrorResponse(error, "Failed to load Form 2290 settings");
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("compliance2290:manage_settings");
  if (!guard.ok) return guard.res;

  try {
    const existing = await getForm2290Settings();
    const body = (await request.json()) as UpdateSettingsBody;
    const minimumEligibleWeight =
      typeof body.minimumEligibleWeight === "undefined"
        ? existing.minimumEligibleWeight
        : parsePositiveInteger(body.minimumEligibleWeight);
    const expirationWarningDays =
      typeof body.expirationWarningDays === "undefined"
        ? existing.expirationWarningDays
        : parseNonNegativeInteger(body.expirationWarningDays);
    const serviceFeeCents =
      typeof body.serviceFeeCents === "undefined"
        ? existing.serviceFeeCents
        : parseNonNegativeInteger(body.serviceFeeCents);

    if (minimumEligibleWeight === null) {
      return Response.json({ error: "Invalid minimumEligibleWeight" }, { status: 400 });
    }
    if (expirationWarningDays === null) {
      return Response.json({ error: "Invalid expirationWarningDays" }, { status: 400 });
    }
    if (serviceFeeCents === null) {
      return Response.json({ error: "Invalid serviceFeeCents" }, { status: 400 });
    }

    const settings = await update2290Settings({
      minimumEligibleWeight,
      expirationWarningDays,
      serviceFeeCents,
      enabled:
        typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
      processingMode:
        typeof body.processingMode === "string" &&
        Object.values(Form2290ProcessingMode).includes(body.processingMode as Form2290ProcessingMode)
          ? (body.processingMode as Form2290ProcessingMode)
          : existing.processingMode,
      requirePaymentBeforeSubmit:
        typeof body.requirePaymentBeforeSubmit === "boolean"
          ? body.requirePaymentBeforeSubmit
          : existing.requirePaymentBeforeSubmit,
      collectIrsTaxEstimate:
        typeof body.collectIrsTaxEstimate === "boolean"
          ? body.collectIrsTaxEstimate
          : existing.collectIrsTaxEstimate,
      allowCustomerPaysProvider:
        typeof body.allowCustomerPaysProvider === "boolean"
          ? body.allowCustomerPaysProvider
          : existing.allowCustomerPaysProvider,
      allowEwallCollectsAndRemits:
        typeof body.allowEwallCollectsAndRemits === "boolean"
          ? body.allowEwallCollectsAndRemits
          : existing.allowEwallCollectsAndRemits,
      requireSchedule1ForCompliance:
        typeof body.requireSchedule1ForCompliance === "boolean"
          ? body.requireSchedule1ForCompliance
          : existing.requireSchedule1ForCompliance,
      authorizationText:
        typeof body.authorizationText === "string"
          ? body.authorizationText
          : existing.authorizationText,
      providerName: typeof body.providerName === "string" ? body.providerName : existing.providerName,
      providerUrl: typeof body.providerUrl === "string" ? body.providerUrl : existing.providerUrl,
      operationalInstructions:
        typeof body.operationalInstructions === "string"
          ? body.operationalInstructions
          : existing.operationalInstructions,
      howToProcessClient:
        typeof body.howToProcessClient === "string"
          ? body.howToProcessClient
          : existing.howToProcessClient,
      howToProcessStaff:
        typeof body.howToProcessStaff === "string"
          ? body.howToProcessStaff
          : existing.howToProcessStaff,
      internalStaffChecklist:
        typeof body.internalStaffChecklist === "string"
          ? body.internalStaffChecklist
          : existing.internalStaffChecklist,
    });

    return Response.json({ settings });
  } catch (error) {
    return toErrorResponse(error, "Failed to update Form 2290 settings");
  }
}
