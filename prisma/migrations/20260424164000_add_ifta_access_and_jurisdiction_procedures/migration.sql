CREATE TYPE "IftaAccessMode" AS ENUM ('SAVED_IN_SYSTEM', 'CONTACT_ME');

CREATE TYPE "IftaFilingMethod" AS ENUM ('MANUAL_PORTAL', 'PDF_UPLOAD', 'CSV_UPLOAD', 'API');

CREATE TYPE "IftaJurisdictionPaymentMethod" AS ENUM ('ACH', 'CARD', 'CHECK', 'MANUAL', 'UNKNOWN');

ALTER TABLE "CompanyProfile"
ADD COLUMN "iftaAccessMode" "IftaAccessMode" NOT NULL DEFAULT 'CONTACT_ME',
ADD COLUMN "iftaAccessNote" TEXT;

ALTER TABLE "IftaFiling"
ADD COLUMN "baseJurisdictionSnapshot" TEXT,
ADD COLUMN "iftaAccessModeSnapshot" "IftaAccessMode",
ADD COLUMN "jurisdictionProcedureSnapshot" JSONB,
ADD COLUMN "staffPaymentReceiptUrl" TEXT,
ADD COLUMN "staffPaymentConfirmationNumber" TEXT,
ADD COLUMN "staffCompletedAt" TIMESTAMP(3);

CREATE TABLE "IftaPortalCredential" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "usernameEncrypted" TEXT,
    "passwordEncrypted" TEXT,
    "pinEncrypted" TEXT,
    "notesEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaPortalCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IftaJurisdictionProcedure" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "portalUrl" TEXT,
    "filingMethod" "IftaFilingMethod" NOT NULL,
    "paymentMethod" "IftaJurisdictionPaymentMethod" NOT NULL,
    "requiresPortalLogin" BOOLEAN NOT NULL DEFAULT true,
    "requiresClientCredential" BOOLEAN NOT NULL DEFAULT true,
    "supportsUpload" BOOLEAN NOT NULL DEFAULT false,
    "staffInstructions" JSONB NOT NULL,
    "checklist" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaJurisdictionProcedure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IftaJurisdictionProcedure_jurisdiction_key"
ON "IftaJurisdictionProcedure"("jurisdiction");

CREATE INDEX "IftaPortalCredential_companyProfileId_idx"
ON "IftaPortalCredential"("companyProfileId");

CREATE INDEX "IftaPortalCredential_jurisdiction_idx"
ON "IftaPortalCredential"("jurisdiction");

CREATE INDEX "IftaPortalCredential_companyProfileId_jurisdiction_isActive_idx"
ON "IftaPortalCredential"("companyProfileId", "jurisdiction", "isActive");

ALTER TABLE "IftaPortalCredential"
ADD CONSTRAINT "IftaPortalCredential_companyProfileId_fkey"
FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
