import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";

async function getOrCreateSettings() {
  const existing = await prisma.iftaAdminSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (existing) return existing;

  return prisma.iftaAdminSetting.create({ data: {} });
}

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("ifta:settings");
  if (!guard.ok) return guard.res;

  const settings = await getOrCreateSettings();
  return Response.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSettingsApiAccess("ifta:settings");
  if (!guard.ok) return guard.res;

  const settings = await getOrCreateSettings();
  const body = (await request.json().catch(() => ({}))) as { disclosureText?: unknown };

  const updated = await prisma.iftaAdminSetting.update({
    where: { id: settings.id },
    data: {
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
