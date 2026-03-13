import { IftaTaxRateTableRow } from "@/features/ifta/types/tax-rate";

export function toTaxRateNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatTaxRateLabel(row: IftaTaxRateTableRow) {
  if (!row.taxRate) return "Missing";
  return toTaxRateNumber(row.taxRate).toFixed(4);
}

export function sourceLabel(source: string | null | undefined) {
  if (!source) return "Not set";
  if (source === "MANUAL_ADMIN") return "Manual admin";
  if (source === "IFTA_IMPORT") return "Imported";
  return source;
}
