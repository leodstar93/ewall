CREATE TYPE "Form2290ProcessingMode" AS ENUM ('STAFF_ASSISTED', 'SELF_SERVICE', 'HYBRID');

ALTER TABLE "Form2290Setting"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "processingMode" "Form2290ProcessingMode" NOT NULL DEFAULT 'STAFF_ASSISTED',
  ADD COLUMN "requirePaymentBeforeSubmit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "collectIrsTaxEstimate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "howToProcessClient" TEXT,
  ADD COLUMN "howToProcessStaff" TEXT,
  ADD COLUMN "internalStaffChecklist" TEXT;

ALTER TABLE "Form2290Filing"
  ADD COLUMN "defaultPaymentMethodId" TEXT,
  ADD COLUMN "howToProcessClientSnapshot" TEXT,
  ADD COLUMN "howToProcessStaffSnapshot" TEXT,
  ADD COLUMN "internalStaffChecklistSnapshot" TEXT,
  ADD COLUMN "taxableGrossWeightSnapshot" INTEGER,
  ADD COLUMN "loggingVehicle" BOOLEAN,
  ADD COLUMN "suspendedVehicle" BOOLEAN,
  ADD COLUMN "confirmationAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "irsTaxEstimate" DECIMAL(10, 2);

UPDATE "Form2290Filing"
SET "status" = CASE "status"::text
  WHEN 'PENDING_REVIEW' THEN 'SUBMITTED'
  WHEN 'IN_REVIEW' THEN 'IN_PROCESS'
  WHEN 'NEEDS_CORRECTION' THEN 'NEED_ATTENTION'
  WHEN 'READY_TO_FILE' THEN 'IN_PROCESS'
  WHEN 'FILED' THEN 'IN_PROCESS'
  WHEN 'PAID' THEN 'IN_PROCESS'
  WHEN 'COMPLIANT' THEN 'FINALIZED'
  WHEN 'EXPIRED' THEN 'IN_PROCESS'
  WHEN 'CANCELLED' THEN 'IN_PROCESS'
  WHEN 'REOPENED' THEN 'DRAFT'
  ELSE "status"::text
END::"Form2290Status";

ALTER TABLE "Form2290Filing"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE TEXT USING "status"::text;

DROP TYPE "Form2290Status";
CREATE TYPE "Form2290Status" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_PROCESS', 'NEED_ATTENTION', 'FINALIZED');

ALTER TABLE "Form2290Filing"
  ALTER COLUMN "status" TYPE "Form2290Status" USING "status"::"Form2290Status",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE INDEX "Form2290Filing_defaultPaymentMethodId_idx" ON "Form2290Filing"("defaultPaymentMethodId");
