-- AlterTable
ALTER TABLE "AchAuthorization" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AchSecureVault" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FilingPaymentUsage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;
