import type {
  EldSyncRange,
  NormalizedEldDriverRecord,
  NormalizedEldFuelPurchaseRecord,
  NormalizedEldTripRecord,
  NormalizedEldVehicleRecord,
} from "./types";

export interface EldProviderClient {
  getVehicles(range?: EldSyncRange): Promise<unknown[]>;
  getDrivers(range?: EldSyncRange): Promise<unknown[]>;
  getTrips(range: EldSyncRange): Promise<unknown[]>;
  getFuelPurchases(range: EldSyncRange): Promise<unknown[]>;
}

export interface EldProviderMapper {
  mapVehicle(raw: unknown): NormalizedEldVehicleRecord | null;
  mapDriver(raw: unknown): NormalizedEldDriverRecord | null;
  mapTrip(raw: unknown): NormalizedEldTripRecord | null;
  mapFuelPurchase(raw: unknown): NormalizedEldFuelPurchaseRecord | null;
}
