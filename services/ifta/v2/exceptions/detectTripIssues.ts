type TripIssueRecord = {
  id: string;
  externalTripId: string;
  externalDriverId: string | null;
  jurisdiction: string;
  distance: number;
  startOdometer: number | null;
  endOdometer: number | null;
  tripDate: Date;
};

export type DetectedIftaIssue = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  details: Record<string, unknown>;
};

export function detectTripIssues(trip: TripIssueRecord) {
  const issues: DetectedIftaIssue[] = [];

  if (!trip.externalDriverId) {
    issues.push({
      type: "MISSING_DRIVER",
      severity: "MEDIUM",
      details: {
        reason: "Trip is missing an associated driver.",
        externalTripId: trip.externalTripId,
      },
    });
  }

  if (trip.startOdometer === null || trip.endOdometer === null) {
    issues.push({
      type: "ODOMETER_MISSING",
      severity: "HIGH",
      details: {
        reason: "Trip is missing start or end odometer values.",
        startOdometer: trip.startOdometer,
        endOdometer: trip.endOdometer,
      },
    });
  }

  if (trip.startOdometer !== null && trip.endOdometer !== null && trip.endOdometer < trip.startOdometer) {
    issues.push({
      type: "ODOMETER_INVERTED",
      severity: "HIGH",
      details: {
        reason: "Trip end odometer is lower than the start odometer.",
        startOdometer: trip.startOdometer,
        endOdometer: trip.endOdometer,
      },
    });
  }

  if (!trip.jurisdiction.trim()) {
    issues.push({
      type: "JURISDICTION_MISSING",
      severity: "HIGH",
      details: {
        reason: "Trip has no jurisdiction code.",
      },
    });
  }

  if (!(trip.distance > 0)) {
    issues.push({
      type: "DISTANCE_INVALID",
      severity: "HIGH",
      details: {
        reason: "Trip distance must be greater than zero.",
        distance: trip.distance,
      },
    });
  }

  return issues;
}
