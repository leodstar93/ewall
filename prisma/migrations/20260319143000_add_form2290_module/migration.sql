ALTER TABLE "Document"
ADD COLUMN "category" TEXT;

CREATE INDEX "Document_category_idx" ON "Document"("category");

ALTER TABLE "Truck"
ADD COLUMN "grossWeight" INTEGER,
ADD COLUMN "is2290Eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "make" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "year" INTEGER;

CREATE INDEX "Truck_vin_idx" ON "Truck"("vin");

CREATE TYPE "Form2290Status" AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'NEEDS_CORRECTION',
  'SUBMITTED',
  'PAID',
  'COMPLIANT',
  'EXPIRED'
);

CREATE TYPE "Form2290PaymentStatus" AS ENUM (
  'UNPAID',
  'PENDING',
  'PAID',
  'WAIVED'
);

CREATE TYPE "Form2290DocumentType" AS ENUM (
  'SUPPORTING_DOC',
  'SCHEDULE_1',
  'PAYMENT_PROOF'
);

CREATE TABLE "Form2290Setting" (
  "id" TEXT NOT NULL,
  "minimumEligibleWeight" INTEGER NOT NULL DEFAULT 55000,
  "expirationWarningDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Form2290Setting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Form2290TaxPeriod" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "filingDeadline" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Form2290TaxPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Form2290Filing" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "truckId" TEXT NOT NULL,
  "taxPeriodId" TEXT NOT NULL,
  "status" "Form2290Status" NOT NULL DEFAULT 'DRAFT',
  "paymentStatus" "Form2290PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "vinSnapshot" TEXT NOT NULL,
  "unitNumberSnapshot" TEXT,
  "grossWeightSnapshot" INTEGER,
  "firstUsedMonth" INTEGER,
  "firstUsedYear" INTEGER,
  "amountDue" DECIMAL(10,2),
  "filedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "compliantAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "schedule1DocumentId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Form2290Filing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Form2290Correction" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Form2290Correction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Form2290Document" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "type" "Form2290DocumentType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Form2290Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Form2290ActivityLog" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Form2290ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Form2290TaxPeriod_startDate_endDate_idx" ON "Form2290TaxPeriod"("startDate", "endDate");
CREATE INDEX "Form2290TaxPeriod_isActive_idx" ON "Form2290TaxPeriod"("isActive");
CREATE UNIQUE INDEX "Form2290TaxPeriod_single_active_idx" ON "Form2290TaxPeriod"("isActive") WHERE "isActive" = true;

CREATE INDEX "Form2290Filing_userId_idx" ON "Form2290Filing"("userId");
CREATE INDEX "Form2290Filing_truckId_idx" ON "Form2290Filing"("truckId");
CREATE INDEX "Form2290Filing_taxPeriodId_idx" ON "Form2290Filing"("taxPeriodId");
CREATE INDEX "Form2290Filing_status_paymentStatus_idx" ON "Form2290Filing"("status", "paymentStatus");
CREATE UNIQUE INDEX "Form2290Filing_truckId_taxPeriodId_key" ON "Form2290Filing"("truckId", "taxPeriodId");

CREATE INDEX "Form2290Correction_filingId_resolved_idx" ON "Form2290Correction"("filingId", "resolved");
CREATE INDEX "Form2290Document_filingId_idx" ON "Form2290Document"("filingId");
CREATE INDEX "Form2290Document_documentId_idx" ON "Form2290Document"("documentId");
CREATE UNIQUE INDEX "Form2290Document_filingId_documentId_key" ON "Form2290Document"("filingId", "documentId");
CREATE INDEX "Form2290ActivityLog_filingId_createdAt_idx" ON "Form2290ActivityLog"("filingId", "createdAt");

ALTER TABLE "Form2290Filing"
ADD CONSTRAINT "Form2290Filing_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Form2290Filing"
ADD CONSTRAINT "Form2290Filing_truckId_fkey"
FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Form2290Filing"
ADD CONSTRAINT "Form2290Filing_taxPeriodId_fkey"
FOREIGN KEY ("taxPeriodId") REFERENCES "Form2290TaxPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Form2290Filing"
ADD CONSTRAINT "Form2290Filing_schedule1DocumentId_fkey"
FOREIGN KEY ("schedule1DocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Form2290Correction"
ADD CONSTRAINT "Form2290Correction_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Form2290Document"
ADD CONSTRAINT "Form2290Document_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Form2290Document"
ADD CONSTRAINT "Form2290Document_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Form2290ActivityLog"
ADD CONSTRAINT "Form2290ActivityLog_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
