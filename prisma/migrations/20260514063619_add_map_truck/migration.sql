-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "lastLatitude" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3),
ADD COLUMN     "lastLongitude" DOUBLE PRECISION;
