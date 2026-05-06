-- Drop Form2290FilingVehicle → Form2290RateTable FK and column
ALTER TABLE "Form2290FilingVehicle" DROP CONSTRAINT IF EXISTS "Form2290FilingVehicle_rateTableId_fkey";
ALTER TABLE "Form2290FilingVehicle" DROP COLUMN IF EXISTS "rateTableId";
DROP INDEX IF EXISTS "Form2290FilingVehicle_rateTableId_idx";

-- Add loggingMultiplier to Form2290TaxPeriod
ALTER TABLE "Form2290TaxPeriod"
  ADD COLUMN IF NOT EXISTS "loggingMultiplier" DECIMAL(5,4) NOT NULL DEFAULT 0.75;

-- Drop old Form2290Rate (was linked to Form2290RateTable)
DROP TABLE IF EXISTS "Form2290Rate";

-- Drop Form2290RateTable
DROP TABLE IF EXISTS "Form2290RateTable";

-- Create new Form2290Rate linked directly to Form2290TaxPeriod
CREATE TABLE "Form2290Rate" (
  "id"          TEXT         NOT NULL,
  "taxPeriodId" TEXT         NOT NULL,
  "category"    TEXT         NOT NULL,
  "weightMin"   INTEGER      NOT NULL,
  "weightMax"   INTEGER,
  "annualCents" INTEGER      NOT NULL,
  "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "Form2290Rate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Form2290Rate"
  ADD CONSTRAINT "Form2290Rate_taxPeriodId_fkey"
  FOREIGN KEY ("taxPeriodId") REFERENCES "Form2290TaxPeriod"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Form2290Rate_taxPeriodId_category_key"
  ON "Form2290Rate"("taxPeriodId", "category");

CREATE INDEX "Form2290Rate_taxPeriodId_weightMin_idx"
  ON "Form2290Rate"("taxPeriodId", "weightMin");

-- Seed IRS 2025-2026 rates directly onto the matching tax period
DO $$
DECLARE
  v_pid TEXT;
BEGIN
  SELECT id INTO v_pid
  FROM "Form2290TaxPeriod"
  WHERE "startDate" <= '2025-07-01' AND "endDate" >= '2026-06-30'
  LIMIT 1;

  IF v_pid IS NOT NULL THEN
    INSERT INTO "Form2290Rate"
      ("id","taxPeriodId","category","weightMin","weightMax","annualCents","sortOrder","createdAt","updatedAt")
    VALUES
      ('irs_r25_A',  v_pid,'A', 55000, 55000, 10000,  1, NOW(),NOW()),
      ('irs_r25_B',  v_pid,'B', 55001, 56000, 12200,  2, NOW(),NOW()),
      ('irs_r25_C',  v_pid,'C', 56001, 57000, 14400,  3, NOW(),NOW()),
      ('irs_r25_D',  v_pid,'D', 57001, 58000, 16600,  4, NOW(),NOW()),
      ('irs_r25_E',  v_pid,'E', 58001, 59000, 18800,  5, NOW(),NOW()),
      ('irs_r25_F',  v_pid,'F', 59001, 60000, 21000,  6, NOW(),NOW()),
      ('irs_r25_G',  v_pid,'G', 60001, 61000, 23200,  7, NOW(),NOW()),
      ('irs_r25_H',  v_pid,'H', 61001, 62000, 25400,  8, NOW(),NOW()),
      ('irs_r25_I',  v_pid,'I', 62001, 63000, 27600,  9, NOW(),NOW()),
      ('irs_r25_J',  v_pid,'J', 63001, 64000, 29800, 10, NOW(),NOW()),
      ('irs_r25_K',  v_pid,'K', 64001, 65000, 32000, 11, NOW(),NOW()),
      ('irs_r25_L',  v_pid,'L', 65001, 66000, 34200, 12, NOW(),NOW()),
      ('irs_r25_M',  v_pid,'M', 66001, 67000, 36400, 13, NOW(),NOW()),
      ('irs_r25_N',  v_pid,'N', 67001, 68000, 38600, 14, NOW(),NOW()),
      ('irs_r25_O',  v_pid,'O', 68001, 69000, 40800, 15, NOW(),NOW()),
      ('irs_r25_P',  v_pid,'P', 69001, 70000, 43000, 16, NOW(),NOW()),
      ('irs_r25_Q',  v_pid,'Q', 70001, 71000, 45200, 17, NOW(),NOW()),
      ('irs_r25_R',  v_pid,'R', 71001, 72000, 47400, 18, NOW(),NOW()),
      ('irs_r25_S',  v_pid,'S', 72001, 73000, 49600, 19, NOW(),NOW()),
      ('irs_r25_T',  v_pid,'T', 73001, 74000, 51800, 20, NOW(),NOW()),
      ('irs_r25_U',  v_pid,'U', 74001, 75000, 54000, 21, NOW(),NOW()),
      ('irs_r25_V',  v_pid,'V', 75001, NULL,  55000, 22, NOW(),NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
