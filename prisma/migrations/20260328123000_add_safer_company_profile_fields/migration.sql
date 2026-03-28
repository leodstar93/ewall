ALTER TABLE "CompanyProfile"
ADD COLUMN "companyName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "addressLine1" TEXT,
ADD COLUMN "addressLine2" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "zipCode" TEXT,
ADD COLUMN "mailingAddressRaw" TEXT,
ADD COLUMN "saferStatus" TEXT,
ADD COLUMN "saferEntityType" TEXT,
ADD COLUMN "saferOperatingStatus" TEXT,
ADD COLUMN "saferPowerUnits" INTEGER,
ADD COLUMN "saferDrivers" INTEGER,
ADD COLUMN "saferMcs150Mileage" INTEGER,
ADD COLUMN "saferMileageYear" INTEGER,
ADD COLUMN "saferLastFetchedAt" TIMESTAMP(3),
ADD COLUMN "saferAutoFilled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "saferNeedsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "saferRawSnapshot" JSONB;

CREATE INDEX "CompanyProfile_dotNumber_idx" ON "CompanyProfile"("dotNumber");
CREATE INDEX "CompanyProfile_mcNumber_idx" ON "CompanyProfile"("mcNumber");
