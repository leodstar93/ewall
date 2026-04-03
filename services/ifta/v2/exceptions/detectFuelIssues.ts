import type { DetectedIftaIssue } from "./detectTripIssues";

type FuelIssueRecord = {
  id: string;
  externalFuelId: string | null;
  externalDriverId: string | null;
  jurisdiction: string;
  fuelVolume: number;
  vendor: string | null;
  purchasedAt: Date;
};

export function detectFuelIssues(fuel: FuelIssueRecord) {
  const issues: DetectedIftaIssue[] = [];

  if (!fuel.externalDriverId) {
    issues.push({
      type: "FUEL_MISSING_DRIVER",
      severity: "LOW",
      details: {
        reason: "Fuel purchase does not include a driver reference.",
        externalFuelId: fuel.externalFuelId,
      },
    });
  }

  if (!fuel.jurisdiction.trim()) {
    issues.push({
      type: "FUEL_JURISDICTION_MISSING",
      severity: "HIGH",
      details: {
        reason: "Fuel purchase is missing a jurisdiction code.",
      },
    });
  }

  if (!(fuel.fuelVolume > 0)) {
    issues.push({
      type: "FUEL_VOLUME_INVALID",
      severity: "HIGH",
      details: {
        reason: "Fuel purchase volume must be greater than zero.",
        fuelVolume: fuel.fuelVolume,
      },
    });
  }

  if (!fuel.vendor) {
    issues.push({
      type: "FUEL_VENDOR_MISSING",
      severity: "LOW",
      details: {
        reason: "Fuel purchase vendor is missing.",
      },
    });
  }

  return issues;
}
