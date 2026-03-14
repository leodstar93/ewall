-- CreateEnum
CREATE TYPE "UCRFilingStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CORRECTION_REQUESTED',
  'RESUBMITTED',
  'PENDING_PROOF',
  'APPROVED',
  'COMPLIANT',
  'REJECTED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "UCREntityType" AS ENUM (
  'MOTOR_CARRIER',
  'BROKER',
  'FREIGHT_FORWARDER',
  'LEASING_COMPANY'
);

-- CreateEnum
CREATE TYPE "UCRDocumentType" AS ENUM (
  'REGISTRATION_PROOF',
  'PAYMENT_RECEIPT',
  'SUPPORTING_DOCUMENT',
  'CORRECTION_ATTACHMENT',
  'OTHER'
);

-- CreateTable
CREATE TABLE "UCRRateBracket" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "minVehicles" INTEGER NOT NULL,
  "maxVehicles" INTEGER NOT NULL,
  "feeAmount" DECIMAL(10,2) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UCRRateBracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCRFiling" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "filingYear" INTEGER NOT NULL,
  "legalName" TEXT NOT NULL,
  "usdotNumber" TEXT,
  "mcNumber" TEXT,
  "fein" TEXT,
  "baseState" TEXT,
  "entityType" "UCREntityType" NOT NULL,
  "interstateOperation" BOOLEAN NOT NULL DEFAULT true,
  "fleetSize" INTEGER NOT NULL,
  "bracketLabel" TEXT,
  "feeAmount" DECIMAL(10,2) NOT NULL,
  "status" "UCRFilingStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewStartedAt" TIMESTAMP(3),
  "correctionRequestedAt" TIMESTAMP(3),
  "resubmittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "compliantAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "clientNotes" TEXT,
  "staffNotes" TEXT,
  "correctionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UCRFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCRDocument" (
  "id" TEXT NOT NULL,
  "ucrFilingId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "filePath" TEXT NOT NULL,
  "mimeType" TEXT,
  "size" INTEGER,
  "type" "UCRDocumentType" NOT NULL DEFAULT 'OTHER',
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UCRDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UCRRateBracket_year_active_idx" ON "UCRRateBracket"("year", "active");

-- CreateIndex
CREATE UNIQUE INDEX "UCRRateBracket_year_minVehicles_maxVehicles_key"
ON "UCRRateBracket"("year", "minVehicles", "maxVehicles");

-- CreateIndex
CREATE INDEX "UCRFiling_userId_filingYear_idx" ON "UCRFiling"("userId", "filingYear");

-- CreateIndex
CREATE INDEX "UCRFiling_status_idx" ON "UCRFiling"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UCRFiling_userId_filingYear_key" ON "UCRFiling"("userId", "filingYear");

-- CreateIndex
CREATE INDEX "UCRDocument_ucrFilingId_type_idx" ON "UCRDocument"("ucrFilingId", "type");

-- AddForeignKey
ALTER TABLE "UCRFiling"
ADD CONSTRAINT "UCRFiling_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UCRDocument"
ADD CONSTRAINT "UCRDocument_ucrFilingId_fkey"
FOREIGN KEY ("ucrFilingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
