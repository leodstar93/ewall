-- CreateTable
CREATE TABLE "EldConnection" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalCompanyId" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EldConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EldVehicle" (
    "id" TEXT NOT NULL,
    "eldConnectionId" TEXT NOT NULL,
    "externalVehicleId" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "vin" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "rawJson" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EldVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EldDriver" (
    "id" TEXT NOT NULL,
    "eldConnectionId" TEXT NOT NULL,
    "externalDriverId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "rawJson" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EldDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EldTrip" (
    "id" TEXT NOT NULL,
    "eldConnectionId" TEXT NOT NULL,
    "externalTripId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalVehicleId" TEXT NOT NULL,
    "externalDriverId" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "distanceUnit" TEXT NOT NULL,
    "startOdometer" DOUBLE PRECISION,
    "endOdometer" DOUBLE PRECISION,
    "fuelVolume" DOUBLE PRECISION,
    "fuelUnit" TEXT,
    "rawJson" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EldTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EldFuelPurchase" (
    "id" TEXT NOT NULL,
    "eldConnectionId" TEXT NOT NULL,
    "externalFuelId" TEXT,
    "provider" TEXT NOT NULL,
    "externalVehicleId" TEXT NOT NULL,
    "externalDriverId" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "fuelType" TEXT,
    "fuelVolume" DOUBLE PRECISION NOT NULL,
    "fuelUnit" TEXT NOT NULL,
    "vendor" TEXT,
    "rawJson" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EldFuelPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaException" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tripId" TEXT,
    "fuelId" TEXT,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IftaException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IftaV2Snapshot" (
    "id" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IftaV2Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EldConnection_carrierId_provider_key" ON "EldConnection"("carrierId", "provider");

-- CreateIndex
CREATE INDEX "EldConnection_carrierId_status_idx" ON "EldConnection"("carrierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EldVehicle_eldConnectionId_externalVehicleId_key" ON "EldVehicle"("eldConnectionId", "externalVehicleId");

-- CreateIndex
CREATE INDEX "EldVehicle_vin_idx" ON "EldVehicle"("vin");

-- CreateIndex
CREATE INDEX "EldVehicle_vehicleNumber_idx" ON "EldVehicle"("vehicleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EldDriver_eldConnectionId_externalDriverId_key" ON "EldDriver"("eldConnectionId", "externalDriverId");

-- CreateIndex
CREATE INDEX "EldDriver_email_idx" ON "EldDriver"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EldTrip_eldConnectionId_externalTripId_key" ON "EldTrip"("eldConnectionId", "externalTripId");

-- CreateIndex
CREATE INDEX "EldTrip_eldConnectionId_tripDate_idx" ON "EldTrip"("eldConnectionId", "tripDate");

-- CreateIndex
CREATE INDEX "EldTrip_jurisdiction_tripDate_idx" ON "EldTrip"("jurisdiction", "tripDate");

-- CreateIndex
CREATE INDEX "EldTrip_externalVehicleId_idx" ON "EldTrip"("externalVehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "EldFuelPurchase_eldConnectionId_externalFuelId_key" ON "EldFuelPurchase"("eldConnectionId", "externalFuelId");

-- CreateIndex
CREATE INDEX "EldFuelPurchase_eldConnectionId_purchasedAt_idx" ON "EldFuelPurchase"("eldConnectionId", "purchasedAt");

-- CreateIndex
CREATE INDEX "EldFuelPurchase_jurisdiction_purchasedAt_idx" ON "EldFuelPurchase"("jurisdiction", "purchasedAt");

-- CreateIndex
CREATE INDEX "IftaException_carrierId_status_severity_idx" ON "IftaException"("carrierId", "status", "severity");

-- CreateIndex
CREATE INDEX "IftaException_tripId_idx" ON "IftaException"("tripId");

-- CreateIndex
CREATE INDEX "IftaException_fuelId_idx" ON "IftaException"("fuelId");

-- CreateIndex
CREATE INDEX "IftaV2Snapshot_carrierId_year_quarter_status_idx" ON "IftaV2Snapshot"("carrierId", "year", "quarter", "status");

-- CreateIndex
CREATE INDEX "IftaV2Snapshot_approvedAt_idx" ON "IftaV2Snapshot"("approvedAt");

-- AddForeignKey
ALTER TABLE "EldConnection" ADD CONSTRAINT "EldConnection_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EldVehicle" ADD CONSTRAINT "EldVehicle_eldConnectionId_fkey" FOREIGN KEY ("eldConnectionId") REFERENCES "EldConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EldDriver" ADD CONSTRAINT "EldDriver_eldConnectionId_fkey" FOREIGN KEY ("eldConnectionId") REFERENCES "EldConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EldTrip" ADD CONSTRAINT "EldTrip_eldConnectionId_fkey" FOREIGN KEY ("eldConnectionId") REFERENCES "EldConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EldFuelPurchase" ADD CONSTRAINT "EldFuelPurchase_eldConnectionId_fkey" FOREIGN KEY ("eldConnectionId") REFERENCES "EldConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaException" ADD CONSTRAINT "IftaException_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaException" ADD CONSTRAINT "IftaException_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "EldTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaException" ADD CONSTRAINT "IftaException_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "EldFuelPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IftaV2Snapshot" ADD CONSTRAINT "IftaV2Snapshot_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
