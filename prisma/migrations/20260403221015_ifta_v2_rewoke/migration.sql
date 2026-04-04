-- CreateEnum
CREATE TYPE "ELDProvider" AS ENUM ('MOTIVE', 'SAMSARA', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IftaFilingStatus" AS ENUM ('DRAFT', 'SYNCING', 'DATA_READY', 'NEEDS_REVIEW', 'READY_FOR_REVIEW', 'IN_REVIEW', 'CHANGES_REQUESTED', 'SNAPSHOT_READY', 'APPROVED', 'REOPENED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IftaExceptionSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'BLOCKING');

-- CreateEnum
CREATE TYPE "IftaExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "RawRecordSource" AS ENUM ('API', 'WEBHOOK', 'IMPORT', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "IftaSnapshotStatus" AS ENUM ('DRAFT', 'FROZEN', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "ELDProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "externalOrgId" TEXT,
    "externalOrgName" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopesJson" JSONB,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncJob" (
    "id" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationAccountId" TEXT,
    "provider" "ELDProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "signatureValid" BOOLEAN,
    "processedAt" TIMESTAMP(3),
    "payloadJson" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalVehicle" (
    "id" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "number" TEXT,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" TEXT,
    "metricUnits" BOOLEAN,
    "status" TEXT,
    "metadataJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalDriver" (
    "id" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "status" TEXT,
    "metadataJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaFiling" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationAccountId" TEXT,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" "IftaFilingStatus" NOT NULL DEFAULT 'DRAFT',
    "providerMode" TEXT,
    "submittedByUserId" TEXT,
    "assignedStaffUserId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "lastCalculatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "totalDistance" DECIMAL(14,2),
    "totalFuelGallons" DECIMAL(14,3),
    "fleetMpg" DECIMAL(10,4),
    "totalTaxDue" DECIMAL(14,2),
    "totalTaxCredit" DECIMAL(14,2),
    "totalNetTax" DECIMAL(14,2),
    "notesInternal" TEXT,
    "notesClientVisible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaFilingVehicle" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "externalVehicleId" TEXT,
    "unitNumber" TEXT,
    "vin" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaFilingVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawIftaTrip" (
    "id" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "externalTripId" TEXT NOT NULL,
    "externalVehicleId" TEXT,
    "tripDate" TIMESTAMP(3),
    "jurisdiction" TEXT,
    "startOdometer" DECIMAL(14,2),
    "endOdometer" DECIMAL(14,2),
    "calibratedStart" DECIMAL(14,2),
    "calibratedEnd" DECIMAL(14,2),
    "miles" DECIMAL(14,2),
    "payloadJson" JSONB NOT NULL,
    "source" "RawRecordSource" NOT NULL DEFAULT 'API',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawIftaTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawFuelPurchase" (
    "id" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "externalPurchaseId" TEXT NOT NULL,
    "externalVehicleId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "jurisdiction" TEXT,
    "fuelType" TEXT,
    "gallons" DECIMAL(14,3),
    "taxPaid" BOOLEAN,
    "amount" DECIMAL(14,2),
    "payloadJson" JSONB NOT NULL,
    "source" "RawRecordSource" NOT NULL DEFAULT 'API',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawFuelPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaDistanceLine" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "filingVehicleId" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "tripDate" TIMESTAMP(3),
    "taxableMiles" DECIMAL(14,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaDistanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaFuelLine" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "filingVehicleId" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3),
    "fuelType" TEXT,
    "gallons" DECIMAL(14,3) NOT NULL,
    "taxPaid" BOOLEAN,
    "sourceType" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaFuelLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaJurisdictionSummary" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "totalMiles" DECIMAL(14,2) NOT NULL,
    "taxableGallons" DECIMAL(14,3) NOT NULL,
    "taxPaidGallons" DECIMAL(14,3) NOT NULL,
    "taxRate" DECIMAL(10,5) NOT NULL,
    "taxDue" DECIMAL(14,2) NOT NULL,
    "taxCredit" DECIMAL(14,2) NOT NULL,
    "netTax" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaJurisdictionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaQuarterSnapshot" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "IftaSnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "frozenAt" TIMESTAMP(3),
    "frozenByUserId" TEXT,
    "filingDataJson" JSONB NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaQuarterSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaException" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "severity" "IftaExceptionSeverity" NOT NULL,
    "status" "IftaExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "jurisdiction" TEXT,
    "vehicleRef" TEXT,
    "sourceRefId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,

    CONSTRAINT "IftaException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaAuditLog" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IftaAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationAccount_tenantId_provider_idx" ON "IntegrationAccount"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_tenantId_provider_key" ON "IntegrationAccount"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationSyncJob_integrationAccountId_status_idx" ON "IntegrationSyncJob"("integrationAccountId", "status");

-- CreateIndex
CREATE INDEX "IntegrationSyncJob_createdAt_idx" ON "IntegrationSyncJob"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEvent_provider_eventType_idx" ON "IntegrationWebhookEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEvent_createdAt_idx" ON "IntegrationWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ExternalVehicle_integrationAccountId_idx" ON "ExternalVehicle"("integrationAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalVehicle_integrationAccountId_externalId_key" ON "ExternalVehicle"("integrationAccountId", "externalId");

-- CreateIndex
CREATE INDEX "ExternalDriver_integrationAccountId_idx" ON "ExternalDriver"("integrationAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDriver_integrationAccountId_externalId_key" ON "ExternalDriver"("integrationAccountId", "externalId");

-- CreateIndex
CREATE INDEX "IftaFiling_tenantId_status_idx" ON "IftaFiling"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IftaFiling_tenantId_year_quarter_key" ON "IftaFiling"("tenantId", "year", "quarter");

-- CreateIndex
CREATE INDEX "IftaFilingVehicle_filingId_idx" ON "IftaFilingVehicle"("filingId");

-- CreateIndex
CREATE UNIQUE INDEX "IftaFilingVehicle_filingId_externalVehicleId_key" ON "IftaFilingVehicle"("filingId", "externalVehicleId");

-- CreateIndex
CREATE INDEX "RawIftaTrip_integrationAccountId_tripDate_idx" ON "RawIftaTrip"("integrationAccountId", "tripDate");

-- CreateIndex
CREATE UNIQUE INDEX "RawIftaTrip_integrationAccountId_externalTripId_jurisdictio_key" ON "RawIftaTrip"("integrationAccountId", "externalTripId", "jurisdiction");

-- CreateIndex
CREATE INDEX "RawFuelPurchase_integrationAccountId_purchasedAt_idx" ON "RawFuelPurchase"("integrationAccountId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RawFuelPurchase_integrationAccountId_externalPurchaseId_key" ON "RawFuelPurchase"("integrationAccountId", "externalPurchaseId");

-- CreateIndex
CREATE INDEX "IftaDistanceLine_filingId_jurisdiction_idx" ON "IftaDistanceLine"("filingId", "jurisdiction");

-- CreateIndex
CREATE INDEX "IftaDistanceLine_filingId_filingVehicleId_idx" ON "IftaDistanceLine"("filingId", "filingVehicleId");

-- CreateIndex
CREATE INDEX "IftaFuelLine_filingId_jurisdiction_idx" ON "IftaFuelLine"("filingId", "jurisdiction");

-- CreateIndex
CREATE INDEX "IftaFuelLine_filingId_filingVehicleId_idx" ON "IftaFuelLine"("filingId", "filingVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "IftaJurisdictionSummary_filingId_jurisdiction_key" ON "IftaJurisdictionSummary"("filingId", "jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "IftaQuarterSnapshot_filingId_version_key" ON "IftaQuarterSnapshot"("filingId", "version");

-- CreateIndex
CREATE INDEX "IftaException_filingId_status_severity_idx" ON "IftaException"("filingId", "status", "severity");

-- CreateIndex
CREATE INDEX "IftaAuditLog_filingId_createdAt_idx" ON "IftaAuditLog"("filingId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookEvent" ADD CONSTRAINT "IntegrationWebhookEvent_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalVehicle" ADD CONSTRAINT "ExternalVehicle_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalDriver" ADD CONSTRAINT "ExternalDriver_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaFiling" ADD CONSTRAINT "IftaFiling_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaFiling" ADD CONSTRAINT "IftaFiling_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaFilingVehicle" ADD CONSTRAINT "IftaFilingVehicle_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaFilingVehicle" ADD CONSTRAINT "IftaFilingVehicle_externalVehicleId_fkey" FOREIGN KEY ("externalVehicleId") REFERENCES "ExternalVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawIftaTrip" ADD CONSTRAINT "RawIftaTrip_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawIftaTrip" ADD CONSTRAINT "RawIftaTrip_externalVehicleId_fkey" FOREIGN KEY ("externalVehicleId") REFERENCES "ExternalVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawFuelPurchase" ADD CONSTRAINT "RawFuelPurchase_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawFuelPurchase" ADD CONSTRAINT "RawFuelPurchase_externalVehicleId_fkey" FOREIGN KEY ("externalVehicleId") REFERENCES "ExternalVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaDistanceLine" ADD CONSTRAINT "IftaDistanceLine_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaDistanceLine" ADD CONSTRAINT "IftaDistanceLine_filingVehicleId_fkey" FOREIGN KEY ("filingVehicleId") REFERENCES "IftaFilingVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaFuelLine" ADD CONSTRAINT "IftaFuelLine_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaFuelLine" ADD CONSTRAINT "IftaFuelLine_filingVehicleId_fkey" FOREIGN KEY ("filingVehicleId") REFERENCES "IftaFilingVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaJurisdictionSummary" ADD CONSTRAINT "IftaJurisdictionSummary_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaQuarterSnapshot" ADD CONSTRAINT "IftaQuarterSnapshot_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaException" ADD CONSTRAINT "IftaException_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaAuditLog" ADD CONSTRAINT "IftaAuditLog_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
