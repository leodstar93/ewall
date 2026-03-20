-- CreateEnum
CREATE TYPE "TruckVehicleType" AS ENUM ('TRACTOR', 'STRAIGHT_TRUCK', 'SEMI_TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "TruckOperationType" AS ENUM ('INTRASTATE', 'INTERSTATE');

-- CreateEnum
CREATE TYPE "DmvRegistrationType" AS ENUM ('NEVADA_ONLY', 'IRP');

-- CreateEnum
CREATE TYPE "DmvFilingType" AS ENUM ('INITIAL', 'RENEWAL');

-- CreateEnum
CREATE TYPE "DmvRegistrationStatus" AS ENUM (
  'DRAFT',
  'WAITING_CLIENT_DOCS',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'READY_FOR_FILING',
  'SUBMITTED',
  'APPROVED',
  'ACTIVE',
  'EXPIRED',
  'REJECTED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "DmvRenewalStatus" AS ENUM (
  'NOT_OPEN',
  'OPEN',
  'WAITING_CLIENT_DOCS',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'READY_FOR_FILING',
  'SUBMITTED',
  'APPROVED',
  'COMPLETED',
  'REJECTED',
  'OVERDUE'
);

-- CreateEnum
CREATE TYPE "DmvRequirementStatus" AS ENUM ('MISSING', 'UPLOADED', 'APPROVED', 'REJECTED', 'WAIVED');

-- CreateEnum
CREATE TYPE "DmvDocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DmvMileageSource" AS ENUM ('MANUAL', 'IMPORT', 'ELD', 'PRIOR_JURISDICTION');

-- CreateEnum
CREATE TYPE "DmvActorType" AS ENUM ('SYSTEM', 'CLIENT', 'STAFF', 'ADMIN');

-- AlterTable
ALTER TABLE "Truck"
ADD COLUMN "statePlate" TEXT,
ADD COLUMN "axleCount" INTEGER,
ADD COLUMN "vehicleType" "TruckVehicleType",
ADD COLUMN "operationType" "TruckOperationType" NOT NULL DEFAULT 'INTRASTATE',
ADD COLUMN "isInterstate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "DmvRegistration" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "registrationType" "DmvRegistrationType" NOT NULL,
  "filingType" "DmvFilingType" NOT NULL DEFAULT 'INITIAL',
  "status" "DmvRegistrationStatus" NOT NULL DEFAULT 'DRAFT',
  "dmvAccountNumber" TEXT,
  "fleetNumber" TEXT,
  "cabCardNumber" TEXT,
  "plateNumber" TEXT,
  "jurisdictionBase" TEXT DEFAULT 'NV',
  "effectiveDate" TIMESTAMP(3),
  "expirationDate" TIMESTAMP(3),
  "registrationMonth" INTEGER,
  "declaredGrossWeight" INTEGER,
  "apportioned" BOOLEAN NOT NULL DEFAULT false,
  "establishedBusinessOk" BOOLEAN,
  "carrierRelocated" BOOLEAN NOT NULL DEFAULT false,
  "dotNumber" TEXT,
  "mcNumber" TEXT,
  "fein" TEXT,
  "nevadaAddress" TEXT,
  "lastSubmittedAt" TIMESTAMP(3),
  "lastApprovedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DmvRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRenewal" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "cycleYear" INTEGER NOT NULL,
  "status" "DmvRenewalStatus" NOT NULL DEFAULT 'NOT_OPEN',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "openedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "internalNotes" TEXT,
  "clientNotes" TEXT,
  "correctionReason" TEXT,
  "mileageSource" "DmvMileageSource",
  "totalMiles" INTEGER,
  "nvMiles" INTEGER,
  "mileageDataJson" JSONB,
  "feeEstimateJson" JSONB,
  "resultJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DmvRenewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRegistrationJurisdiction" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "jurisdictionId" TEXT,
  "jurisdictionCode" TEXT NOT NULL,
  "declaredWeight" INTEGER,
  "estimatedMiles" INTEGER,
  "actualMiles" INTEGER,

  CONSTRAINT "DmvRegistrationJurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRequirementTemplate" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "appliesToType" "DmvRegistrationType",
  "appliesToRenewal" BOOLEAN NOT NULL DEFAULT true,
  "appliesToInitial" BOOLEAN NOT NULL DEFAULT true,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DmvRequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRequirementSnapshot" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "renewalId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL,
  "status" "DmvRequirementStatus" NOT NULL DEFAULT 'MISSING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DmvRequirementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRegistrationDocument" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "requirementCode" TEXT,
  "documentId" TEXT NOT NULL,
  "status" "DmvDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DmvRegistrationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvRenewalDocument" (
  "id" TEXT NOT NULL,
  "renewalId" TEXT NOT NULL,
  "requirementCode" TEXT,
  "documentId" TEXT NOT NULL,
  "status" "DmvDocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DmvRenewalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvActivity" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT,
  "renewalId" TEXT,
  "actorUserId" TEXT,
  "actorType" "DmvActorType" NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "message" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DmvActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DmvFeeRule" (
  "id" TEXT NOT NULL,
  "registrationType" "DmvRegistrationType",
  "jurisdictionCode" TEXT,
  "vehicleType" "TruckVehicleType",
  "minWeight" INTEGER,
  "maxWeight" INTEGER,
  "amount" DECIMAL(10,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DmvFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DmvRegistration_userId_idx" ON "DmvRegistration"("userId");
CREATE INDEX "DmvRegistration_truckId_idx" ON "DmvRegistration"("truckId");
CREATE INDEX "DmvRegistration_status_idx" ON "DmvRegistration"("status");
CREATE INDEX "DmvRegistration_expirationDate_idx" ON "DmvRegistration"("expirationDate");
CREATE INDEX "DmvRegistration_registrationType_idx" ON "DmvRegistration"("registrationType");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRenewal_registrationId_cycleYear_key" ON "DmvRenewal"("registrationId", "cycleYear");
CREATE INDEX "DmvRenewal_dueDate_idx" ON "DmvRenewal"("dueDate");
CREATE INDEX "DmvRenewal_status_idx" ON "DmvRenewal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRegistrationJurisdiction_registrationId_jurisdictionCode_key" ON "DmvRegistrationJurisdiction"("registrationId", "jurisdictionCode");
CREATE INDEX "DmvRegistrationJurisdiction_registrationId_idx" ON "DmvRegistrationJurisdiction"("registrationId");
CREATE INDEX "DmvRegistrationJurisdiction_jurisdictionId_idx" ON "DmvRegistrationJurisdiction"("jurisdictionId");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRequirementTemplate_code_key" ON "DmvRequirementTemplate"("code");
CREATE INDEX "DmvRequirementTemplate_active_sortOrder_idx" ON "DmvRequirementTemplate"("active", "sortOrder");
CREATE INDEX "DmvRequirementTemplate_appliesToType_idx" ON "DmvRequirementTemplate"("appliesToType");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRequirementSnapshot_registrationId_renewalId_code_key" ON "DmvRequirementSnapshot"("registrationId", "renewalId", "code");
CREATE INDEX "DmvRequirementSnapshot_registrationId_idx" ON "DmvRequirementSnapshot"("registrationId");
CREATE INDEX "DmvRequirementSnapshot_renewalId_idx" ON "DmvRequirementSnapshot"("renewalId");
CREATE INDEX "DmvRequirementSnapshot_status_idx" ON "DmvRequirementSnapshot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRegistrationDocument_registrationId_documentId_key" ON "DmvRegistrationDocument"("registrationId", "documentId");
CREATE INDEX "DmvRegistrationDocument_registrationId_idx" ON "DmvRegistrationDocument"("registrationId");
CREATE INDEX "DmvRegistrationDocument_documentId_idx" ON "DmvRegistrationDocument"("documentId");
CREATE INDEX "DmvRegistrationDocument_requirementCode_idx" ON "DmvRegistrationDocument"("requirementCode");

-- CreateIndex
CREATE UNIQUE INDEX "DmvRenewalDocument_renewalId_documentId_key" ON "DmvRenewalDocument"("renewalId", "documentId");
CREATE INDEX "DmvRenewalDocument_renewalId_idx" ON "DmvRenewalDocument"("renewalId");
CREATE INDEX "DmvRenewalDocument_documentId_idx" ON "DmvRenewalDocument"("documentId");
CREATE INDEX "DmvRenewalDocument_requirementCode_idx" ON "DmvRenewalDocument"("requirementCode");

-- CreateIndex
CREATE INDEX "DmvActivity_registrationId_idx" ON "DmvActivity"("registrationId");
CREATE INDEX "DmvActivity_renewalId_idx" ON "DmvActivity"("renewalId");
CREATE INDEX "DmvActivity_createdAt_idx" ON "DmvActivity"("createdAt");

-- CreateIndex
CREATE INDEX "DmvFeeRule_registrationType_active_idx" ON "DmvFeeRule"("registrationType", "active");
CREATE INDEX "DmvFeeRule_jurisdictionCode_active_idx" ON "DmvFeeRule"("jurisdictionCode", "active");

-- AddForeignKey
ALTER TABLE "DmvRegistration"
ADD CONSTRAINT "DmvRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRegistration"
ADD CONSTRAINT "DmvRegistration_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewal"
ADD CONSTRAINT "DmvRenewal_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRegistrationJurisdiction"
ADD CONSTRAINT "DmvRegistrationJurisdiction_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRegistrationJurisdiction"
ADD CONSTRAINT "DmvRegistrationJurisdiction_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DmvRequirementSnapshot"
ADD CONSTRAINT "DmvRequirementSnapshot_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRequirementSnapshot"
ADD CONSTRAINT "DmvRequirementSnapshot_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "DmvRenewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRegistrationDocument"
ADD CONSTRAINT "DmvRegistrationDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRegistrationDocument"
ADD CONSTRAINT "DmvRegistrationDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalDocument"
ADD CONSTRAINT "DmvRenewalDocument_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "DmvRenewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvRenewalDocument"
ADD CONSTRAINT "DmvRenewalDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvActivity"
ADD CONSTRAINT "DmvActivity_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "DmvRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DmvActivity"
ADD CONSTRAINT "DmvActivity_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "DmvRenewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
