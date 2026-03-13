import { CalculatedReport } from "@/services/ifta/calculateReport";

export function getIftaValidationIssues(
  report: CalculatedReport | null,
): string[] {
  if (!report) return ["Report not found."];

  const issues: string[] = [];

  if (report.lines.length === 0) {
    issues.push("Add at least one jurisdiction before continuing.");
  }

  if (report.totalMiles <= 0) {
    issues.push("Total miles must be greater than 0.");
  }

  if (report.totalGallons <= 0) {
    issues.push("Total gallons must be greater than 0.");
  }

  if (report.averageMpg <= 0) {
    issues.push("Average MPG must be greater than 0.");
  }

  if (report.missingRateJurisdictionIds.length > 0) {
    issues.push("One or more jurisdictions are missing a tax rate for this period.");
  }

  return issues;
}
