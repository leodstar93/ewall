-- CreateTable
CREATE TABLE "IftaV2Filing" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "reviewNotes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncTriggeredAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "latestSnapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaV2Filing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IftaV2Filing_carrierId_year_quarter_key" ON "IftaV2Filing"("carrierId", "year", "quarter");

-- CreateIndex
CREATE INDEX "IftaV2Filing_carrierId_status_requestedAt_idx" ON "IftaV2Filing"("carrierId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "IftaV2Filing_requestedById_requestedAt_idx" ON "IftaV2Filing"("requestedById", "requestedAt");

-- AddForeignKey
ALTER TABLE "IftaV2Filing" ADD CONSTRAINT "IftaV2Filing_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaV2Filing" ADD CONSTRAINT "IftaV2Filing_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
