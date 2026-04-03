export type EldProvider = "MOTIVE";

export type EldConnectionStatus = "ACTIVE" | "ERROR" | "DISCONNECTED";

export type EldSyncScope = "vehicles" | "drivers" | "trips" | "fuel" | "all";

export type EldSyncRange = {
  start: Date;
  end: Date;
  updatedAfter?: Date;
};

export type JsonRecord = Record<string, unknown>;

export type NormalizedEldVehicleRecord = {
  externalVehicleId: string;
  vehicleNumber: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  rawJson: JsonRecord;
  lastSyncedAt: Date;
};

export type NormalizedEldDriverRecord = {
  externalDriverId: string;
  name: string | null;
  email: string | null;
  rawJson: JsonRecord;
  lastSyncedAt: Date;
};

export type NormalizedEldTripRecord = {
  externalTripId: string;
  provider: EldProvider;
  externalVehicleId: string;
  externalDriverId: string | null;
  tripDate: Date;
  jurisdiction: string;
  distance: number;
  distanceUnit: string;
  startOdometer: number | null;
  endOdometer: number | null;
  fuelVolume: number | null;
  fuelUnit: string | null;
  rawJson: JsonRecord;
  syncedAt: Date;
};

export type NormalizedEldFuelPurchaseRecord = {
  externalFuelId: string | null;
  provider: EldProvider;
  externalVehicleId: string;
  externalDriverId: string | null;
  purchasedAt: Date;
  jurisdiction: string;
  fuelType: string | null;
  fuelVolume: number;
  fuelUnit: string;
  vendor: string | null;
  rawJson: JsonRecord;
  syncedAt: Date;
};

export type EldSyncScopeCounts = {
  vehicles: number;
  drivers: number;
  trips: number;
  fuel: number;
};

export type EldSyncResult = {
  connectionId: string;
  provider: EldProvider;
  range: {
    start: string;
    end: string;
  };
  scopes: EldSyncScope[];
  counts: EldSyncScopeCounts;
};
