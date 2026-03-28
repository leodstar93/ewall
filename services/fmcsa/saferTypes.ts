export type SaferLookupInput = {
  dotNumber: string;
};

export type SaferCompanyRaw = {
  source: "SAFER";
  searchedDotNumber: string;
  fetchedAt: string;
  html: string;
};

export type SaferCompanyNormalized = {
  found: boolean;
  source: "SAFER";
  searchedDotNumber: string;
  fetchedAt: string;
  warnings: string[];
  company?: {
    legalName?: string | null;
    dbaName?: string | null;
    usdotNumber?: string | null;
    mcNumber?: string | null;
    usdOTStatus?: string | null;
    operatingStatus?: string | null;
    entityType?: string | null;
    phone?: string | null;
    addressRaw?: string | null;
    mailingAddressRaw?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    drivers?: number | null;
    powerUnits?: number | null;
    mcs150Mileage?: number | null;
    mileageYear?: number | null;
    operationClassifications?: string[];
    cargoCarried?: string[];
  };
  summary?: {
    snapshotDate?: string | null;
    outOfServiceDate?: string | null;
    mcs150FormDate?: string | null;
    dunsNumber?: string | null;
    nonCmvUnits?: number | null;
    safetyRating?: {
      rating?: string | null;
      type?: string | null;
      ratingDate?: string | null;
      reviewDate?: string | null;
      currentAsOf?: string | null;
    };
    usInspections?: {
      total?: number | null;
      totalIep?: number | null;
      vehicle?: number | null;
      driver?: number | null;
      hazmat?: number | null;
      iep?: number | null;
    };
    usCrashes?: {
      fatal?: number | null;
      injury?: number | null;
      tow?: number | null;
      total?: number | null;
    };
    canadaInspections?: {
      total?: number | null;
      vehicle?: number | null;
      driver?: number | null;
    };
    canadaCrashes?: {
      fatal?: number | null;
      injury?: number | null;
      tow?: number | null;
      total?: number | null;
    };
  };
  rawSnapshot?: Record<string, unknown>;
};

export type ParsedSaferSnapshot = {
  found: boolean;
  warnings: string[];
  rawSnapshot: Record<string, unknown>;
};
