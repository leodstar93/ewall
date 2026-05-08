import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { currentYear } from "@/services/ucr/shared";

type UcrSettingsBody = {
  activeYear?: unknown;
  conciergeModeEnabled?: unknown;
  allowCustomerCheckout?: unknown;
  serviceFeeMode?: unknown;
  defaultServiceFee?: unknown;
  defaultProcessingFee?: unknown;
  disclosureText?: unknown;
};

function parseOptionalMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed.toFixed(2);
}

async function getOrCreateSettings() {
  const existing = await prisma.uCRAdminSetting.findFirst({
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existing) return existing;

  return prisma.uCRAdminSetting.create({
    data: {
      activeYear: currentYear(),
      conciergeModeEnabled: true,
      allowCustomerCheckout: true,
      serviceFeeMode: "FLAT",
    },
  });
}

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("ucr:manage_settings");
  if (!guard.ok) return guard.res;

  const settings = await getOrCreateSettings();
  return Response.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("ucr:manage_settings");
  if (!guard.ok) return guard.res;

  const settings = await getOrCreateSettings();
  const body = (await request.json()) as UcrSettingsBody;
  const activeYear =
    typeof body.activeYear === "number" ? body.activeYear : Number(body.activeYear);

  const updated = await prisma.uCRAdminSetting.update({
    where: { id: settings.id },
    data: {
      activeYear: Number.isInteger(activeYear) ? activeYear : settings.activeYear,
      conciergeModeEnabled:
        typeof body.conciergeModeEnabled === "boolean"
          ? body.conciergeModeEnabled
          : settings.conciergeModeEnabled,
      allowCustomerCheckout:
        typeof body.allowCustomerCheckout === "boolean"
          ? body.allowCustomerCheckout
          : settings.allowCustomerCheckout,
      serviceFeeMode:
        typeof body.serviceFeeMode === "string" && body.serviceFeeMode.trim()
          ? body.serviceFeeMode.trim().toUpperCase()
          : settings.serviceFeeMode,
      defaultServiceFee:
        parseOptionalMoney(body.defaultServiceFee) === null
          ? null
          : parseOptionalMoney(body.defaultServiceFee),
      defaultProcessingFee:
        parseOptionalMoney(body.defaultProcessingFee) === null
          ? null
          : parseOptionalMoney(body.defaultProcessingFee),
      disclosureText:
        typeof body.disclosureText === "undefined"
          ? settings.disclosureText
          : typeof body.disclosureText === "string"
            ? body.disclosureText.trim() || null
            : null,
    },
  });

  return Response.json({ settings: updated });
}
