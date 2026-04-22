CREATE TABLE "UCRCustomerPaymentAttempt" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "externalOrderId" TEXT,
    "externalPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UCRCustomerPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UCRCustomerPaymentAttempt_idempotencyKey_key"
ON "UCRCustomerPaymentAttempt"("idempotencyKey");

CREATE UNIQUE INDEX "UCRCustomerPaymentAttempt_stripeCheckoutSessionId_key"
ON "UCRCustomerPaymentAttempt"("stripeCheckoutSessionId");

CREATE UNIQUE INDEX "UCRCustomerPaymentAttempt_stripePaymentIntentId_key"
ON "UCRCustomerPaymentAttempt"("stripePaymentIntentId");

CREATE UNIQUE INDEX "UCRCustomerPaymentAttempt_externalOrderId_key"
ON "UCRCustomerPaymentAttempt"("externalOrderId");

CREATE UNIQUE INDEX "UCRCustomerPaymentAttempt_externalPaymentId_key"
ON "UCRCustomerPaymentAttempt"("externalPaymentId");

CREATE INDEX "UCRCustomerPaymentAttempt_filingId_createdAt_idx"
ON "UCRCustomerPaymentAttempt"("filingId", "createdAt");

CREATE INDEX "UCRCustomerPaymentAttempt_filingId_status_idx"
ON "UCRCustomerPaymentAttempt"("filingId", "status");

ALTER TABLE "UCRCustomerPaymentAttempt"
ADD CONSTRAINT "UCRCustomerPaymentAttempt_filingId_fkey"
FOREIGN KEY ("filingId") REFERENCES "UCRFiling"("id") ON DELETE CASCADE ON UPDATE CASCADE;
