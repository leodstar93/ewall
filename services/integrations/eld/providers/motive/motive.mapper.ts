import type {
  JsonRecord,
  NormalizedEldDriverRecord,
  NormalizedEldFuelPurchaseRecord,
  NormalizedEldTripRecord,
  NormalizedEldVehicleRecord,
} from "../../core/types";
import {
  asDate,
  asNumber,
  asString,
  isRecord,
  joinName,
  normalizeDistanceUnit,
  normalizeFuelUnit,
  normalizeJurisdiction,
} from "../../core/utils";

function toJsonRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function resolveEntityId(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const normalized = asString(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function resolveVehicleRecord(input: unknown) {
  return isRecord(input) && isRecord(input.vehicle) ? input.vehicle : null;
}

function resolveDriverRecord(input: unknown) {
  return isRecord(input) && isRecord(input.driver) ? input.driver : null;
}

export function mapVehicle(motiveVehicle: unknown): NormalizedEldVehicleRecord | null {
  if (!isRecord(motiveVehicle)) return null;

  const externalVehicleId = resolveEntityId(
    motiveVehicle.id,
    motiveVehicle.external_id,
    motiveVehicle.number,
  );

  if (!externalVehicleId) return null;

  const year = asNumber(motiveVehicle.year);

  return {
    externalVehicleId,
    vehicleNumber: asString(motiveVehicle.number),
    vin: asString(motiveVehicle.vin),
    make: asString(motiveVehicle.make),
    model: asString(motiveVehicle.model),
    year: year !== null ? Math.trunc(year) : null,
    rawJson: toJsonRecord(motiveVehicle),
    lastSyncedAt: new Date(),
  };
}

export function mapDriver(motiveDriver: unknown): NormalizedEldDriverRecord | null {
  if (!isRecord(motiveDriver)) return null;

  const externalDriverId = resolveEntityId(
    motiveDriver.id,
    motiveDriver.driver_id,
    motiveDriver.username,
    motiveDriver.email,
  );

  if (!externalDriverId) return null;

  return {
    externalDriverId,
    name:
      joinName([motiveDriver.first_name, motiveDriver.last_name]) ??
      asString(motiveDriver.name) ??
      asString(motiveDriver.username),
    email: asString(motiveDriver.email),
    rawJson: toJsonRecord(motiveDriver),
    lastSyncedAt: new Date(),
  };
}

export function mapTrip(motiveTrip: unknown): NormalizedEldTripRecord | null {
  if (!isRecord(motiveTrip)) return null;

  const vehicle = resolveVehicleRecord(motiveTrip);
  const driver = resolveDriverRecord(motiveTrip);

  const externalTripId = resolveEntityId(motiveTrip.id, motiveTrip.offline_id);
  const externalVehicleId = resolveEntityId(
    vehicle?.id,
    motiveTrip.vehicle_id,
    vehicle?.number,
  );
  const tripDate = asDate(motiveTrip.date ?? motiveTrip.trip_date);
  const jurisdiction = normalizeJurisdiction(motiveTrip.jurisdiction);
  const distance = asNumber(motiveTrip.distance);

  if (!externalTripId || !externalVehicleId || !tripDate || !jurisdiction || distance === null) {
    return null;
  }

  const metricUnits = vehicle?.metric_units;

  return {
    externalTripId,
    provider: "MOTIVE",
    externalVehicleId,
    externalDriverId: resolveEntityId(driver?.id, motiveTrip.driver_id, driver?.username),
    tripDate,
    jurisdiction,
    distance,
    distanceUnit: normalizeDistanceUnit(motiveTrip.distance_unit, metricUnits),
    startOdometer:
      asNumber(motiveTrip.calibrated_start_odometer) ??
      asNumber(motiveTrip.start_odometer),
    endOdometer:
      asNumber(motiveTrip.calibrated_end_odometer) ??
      asNumber(motiveTrip.end_odometer),
    fuelVolume:
      asNumber(motiveTrip.fuel) ??
      asNumber(motiveTrip.fuel_volume) ??
      asNumber(motiveTrip.fuel_purchased),
    fuelUnit:
      asString(motiveTrip.fuel_unit) ?? normalizeFuelUnit(motiveTrip.fuel_unit, metricUnits),
    rawJson: toJsonRecord(motiveTrip),
    syncedAt: new Date(),
  };
}

export function mapFuelPurchase(
  motiveFuelPurchase: unknown,
): NormalizedEldFuelPurchaseRecord | null {
  if (!isRecord(motiveFuelPurchase)) return null;

  const vehicle = resolveVehicleRecord(motiveFuelPurchase);
  const driver = resolveDriverRecord(motiveFuelPurchase);

  const externalVehicleId = resolveEntityId(
    vehicle?.id,
    motiveFuelPurchase.vehicle_id,
    vehicle?.number,
  );
  const purchasedAt = asDate(
    motiveFuelPurchase.purchased_at ?? motiveFuelPurchase.purchase_date,
  );
  const jurisdiction = normalizeJurisdiction(motiveFuelPurchase.jurisdiction);
  const fuelVolume =
    asNumber(motiveFuelPurchase.fuel) ?? asNumber(motiveFuelPurchase.fuel_volume);

  if (!externalVehicleId || !purchasedAt || !jurisdiction || fuelVolume === null) {
    return null;
  }

  const metricUnits = vehicle?.metric_units;

  return {
    externalFuelId: resolveEntityId(motiveFuelPurchase.id, motiveFuelPurchase.offline_id),
    provider: "MOTIVE",
    externalVehicleId,
    externalDriverId: resolveEntityId(driver?.id, motiveFuelPurchase.driver_id, driver?.username),
    purchasedAt,
    jurisdiction,
    fuelType: asString(motiveFuelPurchase.fuel_type),
    fuelVolume,
    fuelUnit: normalizeFuelUnit(motiveFuelPurchase.fuel_unit, metricUnits),
    vendor: asString(motiveFuelPurchase.vendor),
    rawJson: toJsonRecord(motiveFuelPurchase),
    syncedAt: new Date(),
  };
}
