/*
  Warnings:

  - A unique constraint covering the columns `[syncSourceKey]` on the table `Trip` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "externalTripId" TEXT,
ADD COLUMN     "sourceProvider" "ELDProvider",
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "syncSourceKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trip_syncSourceKey_key" ON "Trip"("syncSourceKey");

-- CreateIndex
CREATE INDEX "Trip_userId_sourceProvider_externalTripId_idx" ON "Trip"("userId", "sourceProvider", "externalTripId");
