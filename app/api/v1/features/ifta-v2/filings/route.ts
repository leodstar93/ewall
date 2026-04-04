import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/rbac-api";
import { buildFilingWhere, canReviewAllIfta, getActorTenant } from "@/services/ifta-automation/access";
import { CanonicalNormalizationService } from "@/services/ifta-automation/canonical-normalization.service";
import { getCurrentQuarter } from "@/services/ifta-automation/shared";
import { handleIftaAutomationError, parseProvider } from "@/services/ifta-automation/http";

export async function GET() {
  const guard = await requireApiPermission("ifta:read");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const canReviewAll = canReviewAllIfta(guard.perms, guard.isAdmin);
    const where = await buildFilingWhere({
      userId,
      canReviewAll,
    });
    const filings = await prisma.iftaFiling.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        integrationAccount: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastSuccessfulSyncAt: true,
            lastErrorMessage: true,
          },
        },
        _count: {
          select: {
            distanceLines: true,
            fuelLines: true,
            exceptions: true,
            snapshots: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { quarter: "desc" }, { updatedAt: "desc" }],
    });

    return Response.json({ filings });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to load IFTA filings.");
  }
}

export async function POST(request: Request) {
  const guard = await requireApiPermission("ifta:write");
  if (!guard.ok) return guard.res;

  try {
    const userId = guard.session.user.id ?? "";
    if (!userId) {
      return Response.json({ error: "Invalid session." }, { status: 400 });
    }

    const body = (await request.json()) as {
      year?: unknown;
      quarter?: unknown;
      provider?: unknown;
    };
    const currentQuarter = getCurrentQuarter();
    const year =
      typeof body.year === "number" && Number.isInteger(body.year)
        ? body.year
        : currentQuarter.year;
    const quarter =
      typeof body.quarter === "number" && Number.isInteger(body.quarter)
        ? body.quarter
        : currentQuarter.quarter;
    const provider = typeof body.provider === "undefined" ? null : parseProvider(body.provider);
    const tenant = await getActorTenant(userId);
    const integrationAccount = provider
      ? await prisma.integrationAccount.findUnique({
          where: {
            tenantId_provider: {
              tenantId: tenant.id,
              provider,
            },
          },
          select: { id: true },
        })
      : null;
    const filing = await CanonicalNormalizationService.ensureFiling({
      tenantId: tenant.id,
      integrationAccountId: integrationAccount?.id ?? null,
      year,
      quarter,
    });

    return Response.json({ filing }, { status: 201 });
  } catch (error) {
    return handleIftaAutomationError(error, "Failed to create or load the IFTA filing.");
  }
}
