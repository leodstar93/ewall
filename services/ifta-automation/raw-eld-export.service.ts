import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IftaAutomationError } from "@/services/ifta-automation/shared";

type RenderedExcel = {
  buffer: Buffer;
  fileName: string;
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
};

type SheetRow = Record<string, string | number | boolean | null>;
const EXCEL_CELL_TEXT_LIMIT = 32767;

function resolveTenantLabel(input: {
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
    "eld-client"
  );
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function toJsonText(value: Prisma.JsonValue | null | undefined) {
  if (value === null || typeof value === "undefined") return "";

  try {
    return clampCellText(JSON.stringify(value, null, 2));
  } catch {
    return clampCellText(String(value));
  }
}

function toText(value: unknown) {
  if (value === null || typeof value === "undefined") return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return clampCellText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return clampCellText(String(value));
}

function clampCellText(value: string) {
  if (value.length <= EXCEL_CELL_TEXT_LIMIT) {
    return value;
  }

  const suffix = `\n\n[TRUNCATED: original length ${value.length} exceeded Excel cell limit ${EXCEL_CELL_TEXT_LIMIT}]`;
  const allowedLength = Math.max(0, EXCEL_CELL_TEXT_LIMIT - suffix.length);
  return `${value.slice(0, allowedLength)}${suffix}`;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "eld-client";
}

function buildWidths(rows: SheetRow[]) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  return headers.map((header) => {
    const isJsonColumn = header.toLowerCase().includes("json");
    const maxContent = rows.slice(0, 100).reduce((max, row) => {
      const raw = row[header];
      const text = raw === null || typeof raw === "undefined" ? "" : String(raw);
      return Math.max(max, text.length);
    }, header.length);

    return {
      wch: Math.min(Math.max(header.length + 2, Math.min(maxContent + 2, isJsonColumn ? 80 : 36)), isJsonColumn ? 80 : 36),
    };
  });
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: SheetRow[]) {
  const safeRows = rows.length > 0 ? rows : [{ Info: "No records available." }];
  const worksheet = XLSX.utils.json_to_sheet(safeRows);
  worksheet["!cols"] = buildWidths(safeRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

export class RawEldExportService {
  static async downloadTenantExport(input: { tenantId: string }) : Promise<RenderedExcel> {
    const tenant = await prisma.companyProfile.findUnique({
      where: { id: input.tenantId },
      select: {
        id: true,
        name: true,
        legalName: true,
        dbaName: true,
        companyName: true,
        dotNumber: true,
        mcNumber: true,
        ein: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new IftaAutomationError("Client organization not found.", 404, "ELD_EXPORT_TENANT_NOT_FOUND");
    }

    const [
      accounts,
      syncJobs,
      webhookEvents,
      vehicles,
      drivers,
      rawTrips,
      rawFuelPurchases,
      filings,
    ] = await Promise.all([
      prisma.integrationAccount.findMany({
        where: { tenantId: input.tenantId },
        orderBy: [{ provider: "asc" }, { connectedAt: "desc" }],
        select: {
          id: true,
          provider: true,
          status: true,
          externalOrgId: true,
          externalOrgName: true,
          tokenExpiresAt: true,
          scopesJson: true,
          connectedAt: true,
          disconnectedAt: true,
          lastSuccessfulSyncAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          metadataJson: true,
          createdAt: true,
          updatedAt: true,
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
      }),
      prisma.integrationSyncJob.findMany({
        where: {
          integrationAccount: {
            is: {
              tenantId: input.tenantId,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          syncType: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          windowStart: true,
          windowEnd: true,
          recordsRead: true,
          recordsCreated: true,
          recordsUpdated: true,
          recordsFailed: true,
          errorMessage: true,
          summaryJson: true,
          createdAt: true,
          updatedAt: true,
          integrationAccount: {
            select: {
              provider: true,
              externalOrgName: true,
              externalOrgId: true,
            },
          },
        },
      }),
      prisma.integrationWebhookEvent.findMany({
        where: {
          integrationAccount: {
            is: {
              tenantId: input.tenantId,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          provider: true,
          eventType: true,
          externalEventId: true,
          signatureValid: true,
          processedAt: true,
          payloadJson: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.externalVehicle.findMany({
        where: {
          integrationAccount: {
            is: {
              tenantId: input.tenantId,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          externalId: true,
          number: true,
          vin: true,
          make: true,
          model: true,
          year: true,
          metricUnits: true,
          status: true,
          metadataJson: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
          integrationAccount: {
            select: {
              provider: true,
            },
          },
        },
      }),
      prisma.externalDriver.findMany({
        where: {
          integrationAccount: {
            is: {
              tenantId: input.tenantId,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          externalId: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          metadataJson: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
          integrationAccount: {
            select: {
              provider: true,
            },
          },
        },
      }),
      prisma.rawIftaTrip.findMany({
        where: {
          integrationAccount: {
            is: {
              tenantId: input.tenantId,
            },
          },
        },
        orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          externalTripId: true,
          externalVehicleId: true,
          tripDate: true,
          jurisdiction: true,
          startOdometer: true,
          endOdometer: true,
          calibratedStart: true,
          calibratedEnd: true,
          miles: true,
          payloadJson: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          integrationAccount: {
            select: {
              provider: true,
            },
          },
          externalVehicle: {
            select: {
              number: true,
              vin: true,
            },
          },
        },
      }),
      prisma.rawFuelPurchase.findMany({
        where: {
          integrationAccount: {
            is: {
              tenantId: input.tenantId,
            },
          },
        },
        orderBy: [{ purchasedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          externalPurchaseId: true,
          externalVehicleId: true,
          purchasedAt: true,
          jurisdiction: true,
          fuelType: true,
          gallons: true,
          taxPaid: true,
          amount: true,
          payloadJson: true,
          source: true,
          createdAt: true,
          updatedAt: true,
          integrationAccount: {
            select: {
              provider: true,
            },
          },
          externalVehicle: {
            select: {
              number: true,
              vin: true,
            },
          },
        },
      }),
      prisma.iftaFiling.findMany({
        where: {
          tenantId: input.tenantId,
          integrationAccountId: {
            not: null,
          },
        },
        orderBy: [{ year: "desc" }, { quarter: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          integrationAccountId: true,
          year: true,
          quarter: true,
          status: true,
          providerMode: true,
          submittedByUserId: true,
          assignedStaffUserId: true,
          periodStart: true,
          periodEnd: true,
          lastCalculatedAt: true,
          lastSyncedAt: true,
          approvedAt: true,
          totalDistance: true,
          totalFuelGallons: true,
          fleetMpg: true,
          totalTaxDue: true,
          totalTaxCredit: true,
          totalNetTax: true,
          notesInternal: true,
          notesClientVisible: true,
          createdAt: true,
          updatedAt: true,
          integrationAccount: {
            select: {
              provider: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const workbook = XLSX.utils.book_new();
    const tenantLabel = resolveTenantLabel({
      name: tenant.name,
      legalName: tenant.legalName,
      dbaName: tenant.dbaName,
      companyName: tenant.companyName,
      ownerName: tenant.user?.name ?? null,
      ownerEmail: tenant.user?.email ?? null,
    });

    appendSheet(workbook, "Summary", [
      {
        TenantId: tenant.id,
        Client: tenantLabel,
        Owner: tenant.user?.name ?? "",
        OwnerEmail: tenant.user?.email ?? "",
        DOT: tenant.dotNumber ?? "",
        MC: tenant.mcNumber ?? "",
        EIN: tenant.ein ?? "",
        ExportedAt: new Date().toISOString(),
      },
      {
        TenantId: "",
        Client: "Counts",
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "integration_accounts",
        Client: accounts.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "sync_jobs",
        Client: syncJobs.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "webhook_events",
        Client: webhookEvents.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "external_vehicles",
        Client: vehicles.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "external_drivers",
        Client: drivers.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "raw_ifta_trips",
        Client: rawTrips.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "raw_fuel_purchases",
        Client: rawFuelPurchases.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
      {
        TenantId: "ifta_filings",
        Client: filings.length,
        Owner: "",
        OwnerEmail: "",
        DOT: "",
        MC: "",
        EIN: "",
        ExportedAt: "",
      },
    ]);

    appendSheet(
      workbook,
      "Integration Accounts",
      accounts.map((account) => ({
        AccountId: account.id,
        Provider: account.provider,
        Status: account.status,
        ExternalOrgId: account.externalOrgId ?? "",
        ExternalOrgName: account.externalOrgName ?? "",
        TokenExpiresAt: toIso(account.tokenExpiresAt),
        ConnectedAt: toIso(account.connectedAt),
        DisconnectedAt: toIso(account.disconnectedAt),
        LastSuccessfulSyncAt: toIso(account.lastSuccessfulSyncAt),
        LastErrorAt: toIso(account.lastErrorAt),
        LastErrorMessage: account.lastErrorMessage ?? "",
        ScopesJson: toJsonText(account.scopesJson),
        MetadataJson: toJsonText(account.metadataJson),
        SyncJobsCount: account._count.syncJobs,
        WebhookEventsCount: account._count.webhookEvents,
        VehiclesCount: account._count.vehicles,
        DriversCount: account._count.drivers,
        RawTripsCount: account._count.rawTrips,
        RawFuelPurchasesCount: account._count.rawFuelPurchases,
        FilingsCount: account._count.filings,
        CreatedAt: toIso(account.createdAt),
        UpdatedAt: toIso(account.updatedAt),
      })),
    );

    appendSheet(
      workbook,
      "Sync Jobs",
      syncJobs.map((job) => ({
        SyncJobId: job.id,
        AccountId: job.integrationAccountId,
        Provider: job.integrationAccount.provider,
        ExternalOrgName: job.integrationAccount.externalOrgName ?? "",
        ExternalOrgId: job.integrationAccount.externalOrgId ?? "",
        SyncType: job.syncType,
        Status: job.status,
        StartedAt: toIso(job.startedAt),
        FinishedAt: toIso(job.finishedAt),
        WindowStart: toIso(job.windowStart),
        WindowEnd: toIso(job.windowEnd),
        RecordsRead: job.recordsRead,
        RecordsCreated: job.recordsCreated,
        RecordsUpdated: job.recordsUpdated,
        RecordsFailed: job.recordsFailed,
        ErrorMessage: job.errorMessage ?? "",
        SummaryJson: toJsonText(job.summaryJson),
        CreatedAt: toIso(job.createdAt),
        UpdatedAt: toIso(job.updatedAt),
      })),
    );

    appendSheet(
      workbook,
      "Webhook Events",
      webhookEvents.map((event) => ({
        EventId: event.id,
        AccountId: event.integrationAccountId ?? "",
        Provider: event.provider,
        EventType: event.eventType,
        ExternalEventId: event.externalEventId ?? "",
        SignatureValid:
          typeof event.signatureValid === "boolean" ? event.signatureValid : null,
        ProcessedAt: toIso(event.processedAt),
        ErrorMessage: event.errorMessage ?? "",
        PayloadJson: toJsonText(event.payloadJson),
        CreatedAt: toIso(event.createdAt),
      })),
    );

    appendSheet(
      workbook,
      "External Vehicles",
      vehicles.map((vehicle) => ({
        VehicleId: vehicle.id,
        AccountId: vehicle.integrationAccountId,
        Provider: vehicle.integrationAccount.provider,
        ExternalId: vehicle.externalId,
        UnitNumber: vehicle.number ?? "",
        VIN: vehicle.vin ?? "",
        Make: vehicle.make ?? "",
        Model: vehicle.model ?? "",
        Year: vehicle.year ?? "",
        MetricUnits:
          typeof vehicle.metricUnits === "boolean" ? vehicle.metricUnits : null,
        Status: vehicle.status ?? "",
        MetadataJson: toJsonText(vehicle.metadataJson),
        LastSyncedAt: toIso(vehicle.lastSyncedAt),
        CreatedAt: toIso(vehicle.createdAt),
        UpdatedAt: toIso(vehicle.updatedAt),
      })),
    );

    appendSheet(
      workbook,
      "External Drivers",
      drivers.map((driver) => ({
        DriverId: driver.id,
        AccountId: driver.integrationAccountId,
        Provider: driver.integrationAccount.provider,
        ExternalId: driver.externalId,
        FirstName: driver.firstName ?? "",
        LastName: driver.lastName ?? "",
        Email: driver.email ?? "",
        Status: driver.status ?? "",
        MetadataJson: toJsonText(driver.metadataJson),
        LastSyncedAt: toIso(driver.lastSyncedAt),
        CreatedAt: toIso(driver.createdAt),
        UpdatedAt: toIso(driver.updatedAt),
      })),
    );

    appendSheet(
      workbook,
      "Raw Trips",
      rawTrips.map((trip) => ({
        TripId: trip.id,
        AccountId: trip.integrationAccountId,
        Provider: trip.integrationAccount.provider,
        ExternalTripId: trip.externalTripId,
        ExternalVehicleId: trip.externalVehicleId ?? "",
        UnitNumber: trip.externalVehicle?.number ?? "",
        VIN: trip.externalVehicle?.vin ?? "",
        TripDate: toIso(trip.tripDate),
        Jurisdiction: trip.jurisdiction ?? "",
        StartOdometer: toText(trip.startOdometer),
        EndOdometer: toText(trip.endOdometer),
        CalibratedStart: toText(trip.calibratedStart),
        CalibratedEnd: toText(trip.calibratedEnd),
        Miles: toText(trip.miles),
        Source: trip.source,
        PayloadJson: toJsonText(trip.payloadJson),
        CreatedAt: toIso(trip.createdAt),
        UpdatedAt: toIso(trip.updatedAt),
      })),
    );

    appendSheet(
      workbook,
      "Raw Fuel Purchases",
      rawFuelPurchases.map((purchase) => ({
        PurchaseId: purchase.id,
        AccountId: purchase.integrationAccountId,
        Provider: purchase.integrationAccount.provider,
        ExternalPurchaseId: purchase.externalPurchaseId,
        ExternalVehicleId: purchase.externalVehicleId ?? "",
        UnitNumber: purchase.externalVehicle?.number ?? "",
        VIN: purchase.externalVehicle?.vin ?? "",
        PurchasedAt: toIso(purchase.purchasedAt),
        Jurisdiction: purchase.jurisdiction ?? "",
        FuelType: purchase.fuelType ?? "",
        Gallons: toText(purchase.gallons),
        TaxPaid: typeof purchase.taxPaid === "boolean" ? purchase.taxPaid : null,
        Amount: toText(purchase.amount),
        Source: purchase.source,
        PayloadJson: toJsonText(purchase.payloadJson),
        CreatedAt: toIso(purchase.createdAt),
        UpdatedAt: toIso(purchase.updatedAt),
      })),
    );

    appendSheet(
      workbook,
      "IFTA Filings",
      filings.map((filing) => ({
        FilingId: filing.id,
        AccountId: filing.integrationAccountId ?? "",
        Provider: filing.integrationAccount?.provider ?? "",
        AccountStatus: filing.integrationAccount?.status ?? "",
        Year: filing.year,
        Quarter: filing.quarter,
        Status: filing.status,
        ProviderMode: filing.providerMode ?? "",
        SubmittedByUserId: filing.submittedByUserId ?? "",
        AssignedStaffUserId: filing.assignedStaffUserId ?? "",
        PeriodStart: toIso(filing.periodStart),
        PeriodEnd: toIso(filing.periodEnd),
        LastCalculatedAt: toIso(filing.lastCalculatedAt),
        LastSyncedAt: toIso(filing.lastSyncedAt),
        ApprovedAt: toIso(filing.approvedAt),
        TotalDistance: toText(filing.totalDistance),
        TotalFuelGallons: toText(filing.totalFuelGallons),
        FleetMpg: toText(filing.fleetMpg),
        TotalTaxDue: toText(filing.totalTaxDue),
        TotalTaxCredit: toText(filing.totalTaxCredit),
        TotalNetTax: toText(filing.totalNetTax),
        NotesInternal: filing.notesInternal ?? "",
        NotesClientVisible: filing.notesClientVisible ?? "",
        CreatedAt: toIso(filing.createdAt),
        UpdatedAt: toIso(filing.updatedAt),
      })),
    );

    const fileName = `eld-raw-export-${sanitizeFileName(tenantLabel)}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return {
      buffer: XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Buffer,
      fileName,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }
}
