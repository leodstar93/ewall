ALTER TABLE "Jurisdiction"
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "isIftaMember" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "IftaTaxRate"
ADD COLUMN "source" TEXT,
ADD COLUMN "sourceQuarterKey" TEXT,
ADD COLUMN "sourceFileUrl" TEXT,
ADD COLUMN "importedAt" TIMESTAMP(3),
ADD COLUMN "importedById" TEXT,
ADD COLUMN "notes" TEXT;

CREATE TABLE "IftaTaxRateImportRun" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "insertedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedById" TEXT,
    CONSTRAINT "IftaTaxRateImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IftaTaxRateImportRun_year_quarter_executedAt_idx" ON "IftaTaxRateImportRun"("year", "quarter", "executedAt");
