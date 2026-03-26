ALTER TABLE "OrganizationSubscription"
ADD COLUMN "paymentMethodId" TEXT,
ADD COLUMN "lastPaymentAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastPaymentError" TEXT,
ADD COLUMN "canceledAt" TIMESTAMP(3);

CREATE TABLE "BillingCharge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "provider" "BillingProvider" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "externalPaymentId" TEXT,
    "externalOrderId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "billedForStart" TIMESTAMP(3),
    "billedForEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationSubscription_paymentMethodId_idx" ON "OrganizationSubscription"("paymentMethodId");
CREATE INDEX "OrganizationSubscription_currentPeriodEnd_status_idx" ON "OrganizationSubscription"("currentPeriodEnd", "status");
CREATE INDEX "BillingCharge_organizationId_createdAt_idx" ON "BillingCharge"("organizationId", "createdAt");
CREATE INDEX "BillingCharge_subscriptionId_createdAt_idx" ON "BillingCharge"("subscriptionId", "createdAt");
CREATE INDEX "BillingCharge_paymentMethodId_idx" ON "BillingCharge"("paymentMethodId");

ALTER TABLE "OrganizationSubscription"
ADD CONSTRAINT "OrganizationSubscription_paymentMethodId_fkey"
FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillingCharge"
ADD CONSTRAINT "BillingCharge_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingCharge"
ADD CONSTRAINT "BillingCharge_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingCharge"
ADD CONSTRAINT "BillingCharge_paymentMethodId_fkey"
FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
