-- CreateEnum
CREATE TYPE "IftaAuthorizationStatus" AS ENUM ('UNSIGNED', 'SIGNED', 'REVOKED');

-- CreateEnum
CREATE TYPE "UCRAuthorizationStatus" AS ENUM ('UNSIGNED', 'SIGNED', 'REVOKED');

-- AlterTable
ALTER TABLE "UCRAdminSetting" ADD COLUMN     "disclosureText" TEXT;

-- CreateTable
CREATE TABLE "IftaAdminSetting" (
    "id" TEXT NOT NULL,
    "disclosureText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaAdminSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaClientAuthorization" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "status" "IftaAuthorizationStatus" NOT NULL DEFAULT 'UNSIGNED',
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signatureText" TEXT,
    "disclosureText" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedByUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaClientAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UCRClientAuthorization" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "status" "UCRAuthorizationStatus" NOT NULL DEFAULT 'UNSIGNED',
    "signerName" TEXT,
    "signerTitle" TEXT,
    "signatureText" TEXT,
    "disclosureText" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedByUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UCRClientAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IftaClientAuthorization_filingId_key" ON "IftaClientAuthorization"("filingId");

-- CreateIndex
CREATE INDEX "IftaClientAuthorization_status_signedAt_idx" ON "IftaClientAuthorization"("status", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UCRClientAuthorization_filingId_key" ON "UCRClientAuthorization"("filingId");

-- CreateIndex
CREATE INDEX "UCRClientAuthorization_status_signedAt_idx" ON "UCRClientAuthorization"("status", "signedAt");

-- AddForeignKey
ALTER TABLE "IftaClientAuthorization" ADD CONSTRAINT "IftaClientAuthorization_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "IftaFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UCRClientAuthorization" ADD CONSTRAINT "UCRClientAuthorization_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
