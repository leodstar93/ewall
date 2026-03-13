-- DropIndex
DROP INDEX "IftaReportLine_jurisdictionId_idx";

-- DropIndex
DROP INDEX "IftaReportLine_reportId_idx";

-- AlterTable
ALTER TABLE "IftaReportLine" ADD COLUMN     "miles" DECIMAL(12,2) NOT NULL DEFAULT 0;
