export type TaxRateFuelType = "DI" | "GA";
export type TaxRateQuarter = "Q1" | "Q2" | "Q3" | "Q4";

export type TaxRateFilterState = {
  year: number;
  quarter: TaxRateQuarter;
  fuelType: TaxRateFuelType;
  usOnly: boolean;
};

export type IftaTaxRateTableRow = {
  id: string | null;
  jurisdictionId: string;
  code: string;
  name: string;
  countryCode: string | null;
  isIftaMember: boolean;
  isActive: boolean;
  sortOrder: number;
  fuelType: TaxRateFuelType;
  year: number;
  quarter: TaxRateQuarter;
  taxRate: string | null;
  source: string | null;
  sourceQuarterKey: string | null;
  sourceFileUrl: string | null;
  importedAt: string | null;
  importedById: string | null;
  notes: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updatedAt: string | null;
};

export type IftaTaxRateValidationResult = {
  missing: Array<{ jurisdictionId: string; code: string; name: string }>;
  totalJurisdictions: number;
  existingRates: number;
};

export type IftaTaxRateImportResult = {
  success: boolean;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  message?: string;
  sourceUrl?: string;
  sourceQuarterKey?: string;
};
