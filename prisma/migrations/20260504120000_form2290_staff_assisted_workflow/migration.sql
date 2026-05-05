-- Form 2290 staff-assisted filing workflow.

ALTER TYPE "Form2290Status" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "Form2290Status" ADD VALUE IF NOT EXISTS 'READY_TO_FILE';
ALTER TYPE "Form2290Status" ADD VALUE IF NOT EXISTS 'FILED';
ALTER TYPE "Form2290Status" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "Form2290Status" ADD VALUE IF NOT EXISTS 'REOPENED';

ALTER TYPE "Form2290PaymentStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Form2290PaymentHandling') THEN
    CREATE TYPE "Form2290PaymentHandling" AS ENUM (
      'CUSTOMER_PAYS_PROVIDER',
      'EWALL_COLLECTS_AND_REMITTED',
      'NO_TAX_DUE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Form2290FilingMethod') THEN
    CREATE TYPE "Form2290FilingMethod" AS ENUM (
      'STAFF_ASSISTED_PROVIDER',
      'CUSTOMER_SELF_FILED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Form2290AuthorizationStatus') THEN
    CREATE TYPE "Form2290AuthorizationStatus" AS ENUM (
      'UNSIGNED',
      'SIGNED',
      'REVOKED'
    );
  END IF;
END $$;

ALTER TYPE "Form2290DocumentType" ADD VALUE IF NOT EXISTS 'AUTHORIZATION';
ALTER TYPE "Form2290DocumentType" ADD VALUE IF NOT EXISTS 'PROVIDER_CONFIRMATION';

ALTER TABLE "Form2290Setting"
  ADD COLUMN IF NOT EXISTS "serviceFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "allowCustomerPaysProvider" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowEwallCollectsAndRemits" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "requireSchedule1ForCompliance" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "authorizationText" TEXT,
  ADD COLUMN IF NOT EXISTS "providerName" TEXT,
  ADD COLUMN IF NOT EXISTS "providerUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "operationalInstructions" TEXT;

ALTER TABLE "Form2290Filing"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "filingMethod" "Form2290FilingMethod" NOT NULL DEFAULT 'STAFF_ASSISTED_PROVIDER',
  ADD COLUMN IF NOT EXISTS "paymentHandling" "Form2290PaymentHandling" NOT NULL DEFAULT 'CUSTOMER_PAYS_PROVIDER',
  ADD COLUMN IF NOT EXISTS "serviceFeeAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
  ADD COLUMN IF NOT EXISTS "efileProviderName" TEXT,
  ADD COLUMN IF NOT EXISTS "efileProviderUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "efileConfirmationNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "staffInstructionsSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "claimedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readyToFileAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentReceivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "filedExternallyAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Form2290Filing_organizationId_fkey'
  ) THEN
    ALTER TABLE "Form2290Filing"
      ADD CONSTRAINT "Form2290Filing_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "CompanyProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Form2290FilingVehicle" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "truckId" TEXT,
  "vinSnapshot" TEXT NOT NULL,
  "unitNumberSnapshot" TEXT,
  "grossWeightSnapshot" INTEGER,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Form2290FilingVehicle_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Form2290FilingVehicle_filingId_fkey'
  ) THEN
    ALTER TABLE "Form2290FilingVehicle"
      ADD CONSTRAINT "Form2290FilingVehicle_filingId_fkey"
      FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Form2290ClientAuthorization" (
  "id" TEXT NOT NULL,
  "filingId" TEXT NOT NULL,
  "status" "Form2290AuthorizationStatus" NOT NULL DEFAULT 'UNSIGNED',
  "signerName" TEXT,
  "signerTitle" TEXT,
  "signatureText" TEXT,
  "authorizationText" TEXT,
  "signedAt" TIMESTAMP(3),
  "signedByUserId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Form2290ClientAuthorization_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Form2290ClientAuthorization_filingId_fkey'
  ) THEN
    ALTER TABLE "Form2290ClientAuthorization"
      ADD CONSTRAINT "Form2290ClientAuthorization_filingId_fkey"
      FOREIGN KEY ("filingId") REFERENCES "Form2290Filing"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Form2290ClientAuthorization_filingId_key"
  ON "Form2290ClientAuthorization"("filingId");
CREATE INDEX IF NOT EXISTS "Form2290ClientAuthorization_status_signedAt_idx"
  ON "Form2290ClientAuthorization"("status", "signedAt");
CREATE INDEX IF NOT EXISTS "Form2290FilingVehicle_filingId_idx"
  ON "Form2290FilingVehicle"("filingId");
CREATE INDEX IF NOT EXISTS "Form2290FilingVehicle_truckId_idx"
  ON "Form2290FilingVehicle"("truckId");
CREATE INDEX IF NOT EXISTS "Form2290Filing_organizationId_idx"
  ON "Form2290Filing"("organizationId");
CREATE INDEX IF NOT EXISTS "Form2290Filing_claimedByUserId_status_idx"
  ON "Form2290Filing"("claimedByUserId", "status");
