-- CreateTable Form2290RateTable
CREATE TABLE "Form2290RateTable" (
  "id"                TEXT          NOT NULL,
  "name"              TEXT          NOT NULL,
  "taxYear"           TEXT          NOT NULL,
  "source"            TEXT,
  "description"       TEXT,
  "loggingMultiplier" DECIMAL(5,4)  NOT NULL DEFAULT 0.75,
  "isActive"          BOOLEAN       NOT NULL DEFAULT false,
  "taxPeriodId"       TEXT,
  "clonedFromId"      TEXT,
  "createdByUserId"   TEXT,
  "createdAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Form2290RateTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable Form2290Rate
CREATE TABLE "Form2290Rate" (
  "id"          TEXT         NOT NULL,
  "rateTableId" TEXT         NOT NULL,
  "category"    TEXT         NOT NULL,
  "weightMin"   INTEGER      NOT NULL,
  "weightMax"   INTEGER,
  "annualCents" INTEGER      NOT NULL,
  "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Form2290Rate_pkey" PRIMARY KEY ("id")
);

-- Foreign keys for Form2290RateTable
ALTER TABLE "Form2290RateTable"
  ADD CONSTRAINT "Form2290RateTable_taxPeriodId_fkey"
    FOREIGN KEY ("taxPeriodId")  REFERENCES "Form2290TaxPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Form2290RateTable_clonedFromId_fkey"
    FOREIGN KEY ("clonedFromId") REFERENCES "Form2290RateTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key for Form2290Rate
ALTER TABLE "Form2290Rate"
  ADD CONSTRAINT "Form2290Rate_rateTableId_fkey"
    FOREIGN KEY ("rateTableId") REFERENCES "Form2290RateTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for Form2290RateTable
CREATE INDEX "Form2290RateTable_taxPeriodId_idx" ON "Form2290RateTable"("taxPeriodId");
CREATE INDEX "Form2290RateTable_isActive_idx"    ON "Form2290RateTable"("isActive");

-- Unique + index for Form2290Rate
CREATE UNIQUE INDEX "Form2290Rate_rateTableId_category_key" ON "Form2290Rate"("rateTableId", "category");
CREATE INDEX "Form2290Rate_rateTableId_weightMin_idx"       ON "Form2290Rate"("rateTableId", "weightMin");

-- Add rate snapshot columns to Form2290FilingVehicle
ALTER TABLE "Form2290FilingVehicle"
  ADD COLUMN IF NOT EXISTS "rateTableId"        TEXT,
  ADD COLUMN IF NOT EXISTS "rateCategory"       TEXT,
  ADD COLUMN IF NOT EXISTS "annualTaxCents"     INTEGER,
  ADD COLUMN IF NOT EXISTS "calculatedTaxCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "rateSnapshot"       JSONB;

ALTER TABLE "Form2290FilingVehicle"
  ADD CONSTRAINT "Form2290FilingVehicle_rateTableId_fkey"
    FOREIGN KEY ("rateTableId") REFERENCES "Form2290RateTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Form2290FilingVehicle_rateTableId_idx" ON "Form2290FilingVehicle"("rateTableId");

-- Seed: IRS Form 2290 Rev. July 2025 — Tax Year 2025-2026
-- Standard annual rates by weight category (in cents)
-- Logging multiplier: 0.75 (applied at calculation time)
-- Partial year: annualRate * monthsRemaining / 12, rounded to nearest cent
DO $$
DECLARE
  v_tbl TEXT := 'irs2290_2025_2026';
  v_pid TEXT;
BEGIN
  SELECT "id" INTO v_pid
  FROM "Form2290TaxPeriod"
  WHERE "startDate" <= '2025-07-01' AND "endDate" >= '2026-06-30'
  ORDER BY "startDate" DESC
  LIMIT 1;

  INSERT INTO "Form2290RateTable"
    ("id","name","taxYear","source","loggingMultiplier","isActive","taxPeriodId","createdAt","updatedAt")
  VALUES
    (v_tbl, 'IRS Form 2290 Tax Year 2025-2026', '2025-2026',
     'IRS Form 2290 Rev. July 2025', 0.75, true, v_pid, NOW(), NOW())
  ON CONFLICT ("id") DO NOTHING;

  -- Category A: exactly 55,000 lbs → $100.00/yr
  -- Each subsequent 1,000-lb band adds $22.00
  -- Category V: any weight over 75,000 lbs → $550.00/yr (maximum)
  INSERT INTO "Form2290Rate"
    ("id","rateTableId","category","weightMin","weightMax","annualCents","sortOrder","createdAt","updatedAt")
  VALUES
    (v_tbl||'_A', v_tbl, 'A', 55000, 55000,  10000,  1, NOW(), NOW()),
    (v_tbl||'_B', v_tbl, 'B', 55001, 56000,  12200,  2, NOW(), NOW()),
    (v_tbl||'_C', v_tbl, 'C', 56001, 57000,  14400,  3, NOW(), NOW()),
    (v_tbl||'_D', v_tbl, 'D', 57001, 58000,  16600,  4, NOW(), NOW()),
    (v_tbl||'_E', v_tbl, 'E', 58001, 59000,  18800,  5, NOW(), NOW()),
    (v_tbl||'_F', v_tbl, 'F', 59001, 60000,  21000,  6, NOW(), NOW()),
    (v_tbl||'_G', v_tbl, 'G', 60001, 61000,  23200,  7, NOW(), NOW()),
    (v_tbl||'_H', v_tbl, 'H', 61001, 62000,  25400,  8, NOW(), NOW()),
    (v_tbl||'_I', v_tbl, 'I', 62001, 63000,  27600,  9, NOW(), NOW()),
    (v_tbl||'_J', v_tbl, 'J', 63001, 64000,  29800, 10, NOW(), NOW()),
    (v_tbl||'_K', v_tbl, 'K', 64001, 65000,  32000, 11, NOW(), NOW()),
    (v_tbl||'_L', v_tbl, 'L', 65001, 66000,  34200, 12, NOW(), NOW()),
    (v_tbl||'_M', v_tbl, 'M', 66001, 67000,  36400, 13, NOW(), NOW()),
    (v_tbl||'_N', v_tbl, 'N', 67001, 68000,  38600, 14, NOW(), NOW()),
    (v_tbl||'_O', v_tbl, 'O', 68001, 69000,  40800, 15, NOW(), NOW()),
    (v_tbl||'_P', v_tbl, 'P', 69001, 70000,  43000, 16, NOW(), NOW()),
    (v_tbl||'_Q', v_tbl, 'Q', 70001, 71000,  45200, 17, NOW(), NOW()),
    (v_tbl||'_R', v_tbl, 'R', 71001, 72000,  47400, 18, NOW(), NOW()),
    (v_tbl||'_S', v_tbl, 'S', 72001, 73000,  49600, 19, NOW(), NOW()),
    (v_tbl||'_T', v_tbl, 'T', 73001, 74000,  51800, 20, NOW(), NOW()),
    (v_tbl||'_U', v_tbl, 'U', 74001, 75000,  54000, 21, NOW(), NOW()),
    (v_tbl||'_V', v_tbl, 'V', 75001, NULL,   55000, 22, NOW(), NOW())
  ON CONFLICT ("id") DO NOTHING;
END $$;
