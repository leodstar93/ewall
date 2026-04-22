ALTER TABLE "BillingCharge"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "BillingCharge_idempotencyKey_key"
ON "BillingCharge"("idempotencyKey");
