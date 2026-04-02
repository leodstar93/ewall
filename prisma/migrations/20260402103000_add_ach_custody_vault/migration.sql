-- AlterTable
ALTER TABLE "PaymentMethod"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'card',
ADD COLUMN "label" TEXT,
ADD COLUMN "bankName" TEXT,
ADD COLUMN "holderName" TEXT,
ADD COLUMN "accountType" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "secureVaultId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing external payment methods.
UPDATE "PaymentMethod"
SET "type" = 'paypal'
WHERE "provider" = 'paypal';

-- CreateTable
CREATE TABLE "AchSecureVault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routingNumberEncrypted" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "routingLast4" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL,
    "encryptionKeyId" TEXT NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchSecureVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccessAudit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "paymentMethodId" TEXT,
    "filingType" TEXT,
    "filingId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilingPaymentUsage" (
    "id" TEXT NOT NULL,
    "filingType" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "usedByUserId" TEXT NOT NULL,
    "usageType" TEXT NOT NULL,
    "portalName" TEXT,
    "amount" DECIMAL(12,2),
    "paymentDate" TIMESTAMP(3),
    "confirmationNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "receiptDocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilingPaymentUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_secureVaultId_key" ON "PaymentMethod"("secureVaultId");

-- CreateIndex
CREATE INDEX "PaymentMethod_type_status_idx" ON "PaymentMethod"("type", "status");

-- CreateIndex
CREATE INDEX "AchSecureVault_userId_createdAt_idx" ON "AchSecureVault"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AchSecureVault_encryptionKeyId_encryptionVersion_idx" ON "AchSecureVault"("encryptionKeyId", "encryptionVersion");

-- CreateIndex
CREATE INDEX "AchAuthorization_userId_acceptedAt_idx" ON "AchAuthorization"("userId", "acceptedAt");

-- CreateIndex
CREATE INDEX "AchAuthorization_paymentMethodId_status_idx" ON "AchAuthorization"("paymentMethodId", "status");

-- CreateIndex
CREATE INDEX "AchAuthorization_consentVersion_idx" ON "AchAuthorization"("consentVersion");

-- CreateIndex
CREATE INDEX "FinancialAccessAudit_actorUserId_createdAt_idx" ON "FinancialAccessAudit"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAccessAudit_targetUserId_createdAt_idx" ON "FinancialAccessAudit"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAccessAudit_paymentMethodId_createdAt_idx" ON "FinancialAccessAudit"("paymentMethodId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAccessAudit_filingType_filingId_idx" ON "FinancialAccessAudit"("filingType", "filingId");

-- CreateIndex
CREATE INDEX "FinancialAccessAudit_action_createdAt_idx" ON "FinancialAccessAudit"("action", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAccessAudit_createdAt_idx" ON "FinancialAccessAudit"("createdAt");

-- CreateIndex
CREATE INDEX "FilingPaymentUsage_filingType_filingId_createdAt_idx" ON "FilingPaymentUsage"("filingType", "filingId", "createdAt");

-- CreateIndex
CREATE INDEX "FilingPaymentUsage_paymentMethodId_createdAt_idx" ON "FilingPaymentUsage"("paymentMethodId", "createdAt");

-- CreateIndex
CREATE INDEX "FilingPaymentUsage_usedByUserId_createdAt_idx" ON "FilingPaymentUsage"("usedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FilingPaymentUsage_targetUserId_createdAt_idx" ON "FilingPaymentUsage"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FilingPaymentUsage_status_createdAt_idx" ON "FilingPaymentUsage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentMethod"
ADD CONSTRAINT "PaymentMethod_secureVaultId_fkey" FOREIGN KEY ("secureVaultId") REFERENCES "AchSecureVault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchSecureVault"
ADD CONSTRAINT "AchSecureVault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchAuthorization"
ADD CONSTRAINT "AchAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchAuthorization"
ADD CONSTRAINT "AchAuthorization_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchAuthorization"
ADD CONSTRAINT "AchAuthorization_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccessAudit"
ADD CONSTRAINT "FinancialAccessAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccessAudit"
ADD CONSTRAINT "FinancialAccessAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccessAudit"
ADD CONSTRAINT "FinancialAccessAudit_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingPaymentUsage"
ADD CONSTRAINT "FilingPaymentUsage_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingPaymentUsage"
ADD CONSTRAINT "FilingPaymentUsage_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingPaymentUsage"
ADD CONSTRAINT "FilingPaymentUsage_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingPaymentUsage"
ADD CONSTRAINT "FilingPaymentUsage_receiptDocumentId_fkey" FOREIGN KEY ("receiptDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
