import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requireAdminSettingsApiAccess("ifta:settings");
  if (!guard.ok) return guard.res;

  try {
    const [jurisdictions, procedures] = await Promise.all([
      prisma.jurisdiction.findMany({
        where: {
          isActive: true,
          isIftaMember: true,
        },
        select: {
          code: true,
          name: true,
          countryCode: true,
        },
        orderBy: [{ countryCode: "asc" }, { code: "asc" }],
      }),
      prisma.iftaJurisdictionProcedure.findMany({
        select: {
          jurisdiction: true,
          title: true,
          portalUrl: true,
          filingMethod: true,
          paymentMethod: true,
          requiresPortalLogin: true,
          requiresClientCredential: true,
          supportsUpload: true,
          staffInstructions: true,
          checklist: true,
          isActive: true,
          updatedAt: true,
        },
      }),
    ]);

    const procedureByJurisdiction = new Map(
      procedures.map((procedure) => [procedure.jurisdiction, procedure]),
    );

    const rows = jurisdictions.map((jurisdiction) => {
      const procedure = procedureByJurisdiction.get(jurisdiction.code) ?? null;
      return {
        jurisdiction: jurisdiction.code,
        name: jurisdiction.name,
        countryCode: jurisdiction.countryCode,
        hasProcedure: Boolean(procedure),
        title: procedure?.title ?? null,
        portalUrl: procedure?.portalUrl ?? null,
        filingMethod: procedure?.filingMethod ?? "MANUAL_PORTAL",
        paymentMethod: procedure?.paymentMethod ?? "UNKNOWN",
        requiresPortalLogin: procedure?.requiresPortalLogin ?? true,
        requiresClientCredential: procedure?.requiresClientCredential ?? true,
        supportsUpload: procedure?.supportsUpload ?? false,
        staffInstructions: procedure?.staffInstructions ?? { steps: [] },
        checklist: procedure?.checklist ?? [],
        isActive: procedure?.isActive ?? false,
        updatedAt: procedure?.updatedAt?.toISOString() ?? null,
      };
    });

    return Response.json({ rows });
  } catch (error) {
    console.error("Error fetching IFTA jurisdiction procedures:", error);
    return Response.json(
      { error: "Failed to fetch IFTA process settings" },
      { status: 500 },
    );
  }
}
