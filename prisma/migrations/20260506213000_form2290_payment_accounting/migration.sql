ALTER TABLE "Form2290Filing"
  ADD COLUMN IF NOT EXISTS "customerPaidAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerBalanceDue" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerCreditAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "Form2290Filing"
SET
  "customerPaidAmount" = CASE
    WHEN "paymentStatus" IN ('PAID', 'RECEIVED', 'WAIVED')
      THEN COALESCE("amountDue", 0) + COALESCE("serviceFeeAmount", 0)
    ELSE COALESCE("customerPaidAmount", 0)
  END,
  "customerBalanceDue" = CASE
    WHEN "paymentStatus" IN ('PAID', 'RECEIVED', 'WAIVED')
      THEN 0
    ELSE GREATEST(COALESCE("amountDue", 0) + COALESCE("serviceFeeAmount", 0) - COALESCE("customerPaidAmount", 0), 0)
  END,
  "customerCreditAmount" = CASE
    WHEN "paymentStatus" IN ('PAID', 'RECEIVED', 'WAIVED')
      THEN GREATEST(COALESCE("customerPaidAmount", 0) - (COALESCE("amountDue", 0) + COALESCE("serviceFeeAmount", 0)), 0)
    ELSE 0
  END;
