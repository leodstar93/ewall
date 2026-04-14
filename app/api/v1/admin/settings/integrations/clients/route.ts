import { prisma } from "@/lib/prisma";
import { requireAdminSettingsApiAccess } from "@/lib/admin-settings-access";

function resolveClientLabel(input: {
  name: string | null;
  legalName: string | null;
  dbaName: string | null;
  companyName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}) {
  return (
    input.name?.trim() ||
    input.legalName?.trim() ||
    input.dbaName?.trim() ||
    input.companyName?.trim() ||
    input.ownerName?.trim() ||
    input.ownerEmail?.trim() ||
    "Unnamed client"
  );
}

export async function GET() {
  const access = await requireAdminSettingsApiAccess("settings:read");
  if (!access.ok) return access.res;

  const companies = await prisma.companyProfile.findMany({
    where: {
      eldIntegrationAccounts: {
        some: {},
      },
    },
    orderBy: [{ companyName: "asc" }, { legalName: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      legalName: true,
      dbaName: true,
      companyName: true,
      dotNumber: true,
      mcNumber: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      eldIntegrationAccounts: {
        orderBy: [{ connectedAt: "desc" }, { provider: "asc" }],
        select: {
          id: true,
          provider: true,
          status: true,
          connectedAt: true,
          lastSuccessfulSyncAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          _count: {
            select: {
              syncJobs: true,
              webhookEvents: true,
              vehicles: true,
              drivers: true,
              rawTrips: true,
              rawFuelPurchases: true,
              filings: true,
            },
          },
        },
      },
    },
  });

  const clients = companies.map((company) => {
    const displayName = resolveClientLabel({
      name: company.name,
      legalName: company.legalName,
      dbaName: company.dbaName,
      companyName: company.companyName,
      ownerName: company.user?.name ?? null,
      ownerEmail: company.user?.email ?? null,
    });

    const counts = company.eldIntegrationAccounts.reduce(
      (acc, account) => {
        acc.syncJobs += account._count.syncJobs;
        acc.webhookEvents += account._count.webhookEvents;
        acc.vehicles += account._count.vehicles;
        acc.drivers += account._count.drivers;
        acc.rawTrips += account._count.rawTrips;
        acc.rawFuelPurchases += account._count.rawFuelPurchases;
        acc.filings += account._count.filings;
        return acc;
      },
      {
        syncJobs: 0,
        webhookEvents: 0,
        vehicles: 0,
        drivers: 0,
        rawTrips: 0,
        rawFuelPurchases: 0,
        filings: 0,
      },
    );

    const lastSyncAt = company.eldIntegrationAccounts.reduce<string | null>((latest, account) => {
      const current = account.lastSuccessfulSyncAt?.toISOString() ?? null;
      if (!current) return latest;
      if (!latest) return current;
      return current > latest ? current : latest;
    }, null);

    return {
      id: company.id,
      displayName,
      dotNumber: company.dotNumber ?? null,
      mcNumber: company.mcNumber ?? null,
      ownerName: company.user?.name ?? null,
      ownerEmail: company.user?.email ?? null,
      providers: company.eldIntegrationAccounts.map((account) => ({
        id: account.id,
        provider: account.provider,
        status: account.status,
        connectedAt: account.connectedAt?.toISOString() ?? null,
        lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
        lastErrorAt: account.lastErrorAt?.toISOString() ?? null,
        lastErrorMessage: account.lastErrorMessage ?? null,
      })),
      accountCount: company.eldIntegrationAccounts.length,
      counts,
      lastSyncAt,
    };
  });

  return Response.json({ clients });
}
