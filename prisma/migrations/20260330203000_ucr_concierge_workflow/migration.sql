ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'AWAITING_CUSTOMER_PAYMENT';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'CUSTOMER_PAYMENT_PENDING';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'CUSTOMER_PAID';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'QUEUED_FOR_PROCESSING';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'IN_PROCESS';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'OFFICIAL_PAYMENT_PENDING';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'OFFICIAL_PAID';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "UCRFilingStatus" ADD VALUE IF NOT EXISTS 'NEEDS_ATTENTION';

ALTER TYPE "UCRDocumentType" ADD VALUE IF NOT EXISTS 'OFFICIAL_RECEIPT';

CREATE TYPE "UCROfficialPaymentStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'PAID', 'FAILED');
CREATE TYPE "UCRWorkItemStatus" AS ENUM ('OPEN', 'CLAIMED', 'PROCESSING', 'WAITING_INTERNAL_INFO', 'DONE', 'FAILED');
CREATE TYPE "UCRCustomerPaymentStatus" AS ENUM (
  'NOT_STARTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);

ALTER TABLE "UCRFiling"
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "year" INTEGER,
ADD COLUMN "dbaName" TEXT,
ADD COLUMN "dotNumber" TEXT,
ADD COLUMN "vehicleCount" INTEGER,
ADD COLUMN "bracketCode" TEXT,
ADD COLUMN "customerPaymentStatus" "UCRCustomerPaymentStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "officialPaymentStatus" "UCROfficialPaymentStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "ucrAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "serviceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "processingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "totalCharged" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "pricingLockedAt" TIMESTAMP(3),
ADD COLUMN "customerPaidAt" TIMESTAMP(3),
ADD COLUMN "queuedAt" TIMESTAMP(3),
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "officialPaidAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "stripePaymentIntentId" TEXT,
ADD COLUMN "stripeChargeId" TEXT,
ADD COLUMN "officialReceiptUrl" TEXT,
ADD COLUMN "officialReceiptName" TEXT,
ADD COLUMN "officialReceiptMimeType" TEXT,
ADD COLUMN "officialReceiptSize" INTEGER,
ADD COLUMN "officialReceiptNumber" TEXT,
ADD COLUMN "officialConfirmation" TEXT,
ADD COLUMN "officialPaidByStaffId" TEXT,
ADD COLUMN "assignedToStaffId" TEXT,
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "customerVisibleNotes" TEXT;

UPDATE "UCRFiling"
SET
  "year" = COALESCE("year", "filingYear"),
  "dotNumber" = COALESCE("dotNumber", "usdotNumber"),
  "vehicleCount" = COALESCE("vehicleCount", "fleetSize"),
  "bracketCode" = COALESCE("bracketCode", "bracketLabel"),
  "ucrAmount" = COALESCE("ucrAmount", "feeAmount"),
  "totalCharged" = CASE
    WHEN COALESCE("totalCharged", 0) = 0 THEN COALESCE("feeAmount", 0)
    ELSE "totalCharged"
  END;

ALTER TABLE "UCRFiling"
ALTER COLUMN "year" SET NOT NULL;

CREATE UNIQUE INDEX "UCRFiling_stripeCheckoutSessionId_key" ON "UCRFiling"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "UCRFiling_stripePaymentIntentId_key" ON "UCRFiling"("stripePaymentIntentId");
CREATE INDEX "UCRFiling_organizationId_year_idx" ON "UCRFiling"("organizationId", "year");
CREATE INDEX "UCRFiling_year_idx" ON "UCRFiling"("year");
CREATE INDEX "UCRFiling_assignedToStaffId_idx" ON "UCRFiling"("assignedToStaffId");
CREATE INDEX "UCRFiling_customerPaymentStatus_idx" ON "UCRFiling"("customerPaymentStatus");
CREATE INDEX "UCRFiling_officialPaymentStatus_idx" ON "UCRFiling"("officialPaymentStatus");

CREATE TABLE "UCRAdminSetting" (
  "id" TEXT NOT NULL,
  "activeYear" INTEGER NOT NULL,
  "conciergeModeEnabled" BOOLEAN NOT NULL DEFAULT true,
  "allowCustomerCheckout" BOOLEAN NOT NULL DEFAULT true,
  "serviceFeeMode" TEXT NOT NULL DEFAULT 'FLAT',
  "defaultServiceFee" DECIMAL(10,2),
  "defaultProcessingFee" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UCRAdminSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UCRRateSnapshot" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "bracketCode" TEXT NOT NULL,
  "minVehicles" INTEGER NOT NULL,
  "maxVehicles" INTEGER,
  "ucrAmount" DECIMAL(10,2) NOT NULL,
  "serviceFee" DECIMAL(10,2) NOT NULL,
  "processingFee" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UCRRateSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UCRWorkItem" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "status" "UCRWorkItemStatus" NOT NULL DEFAULT 'OPEN',
  "priority" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UCRWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UCRFilingEvent" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "message" TEXT,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UCRFilingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UCRStatusTransition" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UCRStatusTransition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UCRRateSnapshot_filingId_key" ON "UCRRateSnapshot"("filingId");
CREATE INDEX "UCRWorkItem_filingId_idx" ON "UCRWorkItem"("filingId");
CREATE INDEX "UCRWorkItem_assignedToId_idx" ON "UCRWorkItem"("assignedToId");
CREATE INDEX "UCRWorkItem_status_idx" ON "UCRWorkItem"("status");
CREATE INDEX "UCRFilingEvent_filingId_createdAt_idx" ON "UCRFilingEvent"("filingId", "createdAt");
CREATE INDEX "UCRFilingEvent_eventType_idx" ON "UCRFilingEvent"("eventType");
CREATE INDEX "UCRStatusTransition_filingId_createdAt_idx" ON "UCRStatusTransition"("filingId", "createdAt");

ALTER TABLE "UCRRateSnapshot"
ADD CONSTRAINT "UCRRateSnapshot_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UCRWorkItem"
ADD CONSTRAINT "UCRWorkItem_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UCRFilingEvent"
ADD CONSTRAINT "UCRFilingEvent_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UCRStatusTransition"
ADD CONSTRAINT "UCRStatusTransition_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UCRAdminSetting" (
  "id",
  "activeYear",
  "conciergeModeEnabled",
  "allowCustomerCheckout",
  "serviceFeeMode",
  "createdAt",
  "updatedAt"
)
VALUES (
  'default-ucr-admin-setting',
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  true,
  true,
  'FLAT',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
