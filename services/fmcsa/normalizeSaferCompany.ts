import { parseSaferSnapshot } from "./parseSaferSnapshot";
import type { SaferCompanyNormalized, SaferCompanyRaw } from "./saferTypes";

type SaferSummary = NonNullable<SaferCompanyNormalized["summary"]>;

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function sanitizeLabelLeak(
  value: string | null | undefined,
  blockedLabels: string[],
): string | null {
  const normalized = cleanText(value);
  if (!normalized) return null;

  const startsWithBlockedLabel = blockedLabels.some((label) =>
    new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(normalized),
  );

  return startsWithBlockedLabel ? null : normalized;
}

function sanitizeStatus(value: string | null | undefined) {
  const normalized = cleanText(value);
  if (!normalized) return null;

  const match = normalized.match(/^([A-Z][A-Z /-]+?)(?::\s.*)?$/);
  return cleanText(match?.[1] ?? normalized) || null;
}

function normalizeDotNumber(value?: string | null) {
  if (!value) return null;

  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;

  return digits.replace(/^0+/, "") || "0";
}

function toInt(value?: string | null): number | null {
  if (!value) return null;

  const cleaned = value.replace(/[^\d]/g, "");
  if (!cleaned) return null;

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function splitAddress(addressRaw?: string | null) {
  const normalized = cleanText(addressRaw);
  if (!normalized) {
    return {
      addressLine1: null,
      addressLine2: null,
      city: null,
      state: null,
      zipCode: null,
    };
  }

  const lineParts = (addressRaw ?? "")
    .split(/\r?\n/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (lineParts.length >= 2) {
    const cityStateZip = lineParts[lineParts.length - 1] ?? "";
    const cityMatch = cityStateZip.match(/^(.*?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);

    if (cityMatch) {
      return {
        addressLine1: lineParts.slice(0, -1).join(", ") || null,
        addressLine2: null,
        city: cleanText(cityMatch[1]),
        state: cleanText(cityMatch[2]).toUpperCase(),
        zipCode: cleanText(cityMatch[3]),
      };
    }
  }

  const match = normalized.match(
    /^(.*?)\s+([A-Z][A-Z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i,
  );

  if (!match) {
    return {
      addressLine1: normalized,
      addressLine2: null,
      city: null,
      state: null,
      zipCode: null,
    };
  }

  return {
    addressLine1: cleanText(match[1]),
    addressLine2: null,
    city: cleanText(match[2]),
    state: cleanText(match[3]).toUpperCase(),
    zipCode: cleanText(match[4]),
  };
}

function parseMileageYear(value?: string | null, fallback?: string | null) {
  const inlineYear = value?.match(/\((\d{4})\)/)?.[1];
  if (inlineYear) return Number(inlineYear);

  const dateYear = fallback?.match(/(\d{4})$/)?.[1];
  if (dateYear) return Number(dateYear);

  return null;
}

export function normalizeSaferCompany(raw: SaferCompanyRaw): SaferCompanyNormalized {
  const parsed = parseSaferSnapshot(raw.html);

  if (!parsed.found) {
    return {
      found: false,
      source: "SAFER",
      searchedDotNumber: raw.searchedDotNumber,
      fetchedAt: raw.fetchedAt,
      warnings: parsed.warnings,
    };
  }

  const snapshot = parsed.rawSnapshot as Record<string, string | string[] | null | undefined>;
  const address = splitAddress((snapshot.addressRaw as string | null | undefined) ?? null);
  const parsedDotNumber = normalizeDotNumber(
    (snapshot.usdotNumber as string | null | undefined) ?? null,
  );
  const usdotNumber = parsedDotNumber ?? raw.searchedDotNumber;
  const operationClassification = Array.isArray(snapshot.operationClassification)
    ? snapshot.operationClassification
    : [];
  const carrierOperation = Array.isArray(snapshot.carrierOperation)
    ? snapshot.carrierOperation
    : [];
  const cargoCarried = Array.isArray(snapshot.cargoCarried) ? snapshot.cargoCarried : [];

  const warnings = [...parsed.warnings];
  if (usdotNumber && usdotNumber !== normalizeDotNumber(raw.searchedDotNumber)) {
    warnings.push("The SAFER snapshot USDOT number does not match the searched USDOT number.");
  }

  return {
    found: true,
    source: "SAFER",
    searchedDotNumber: raw.searchedDotNumber,
    fetchedAt: raw.fetchedAt,
    warnings,
    company: {
      legalName: sanitizeLabelLeak(
        (snapshot.legalName as string | null | undefined) ?? null,
        ["DBA Name", "Physical Address", "Phone", "Mailing Address"],
      ),
      dbaName: sanitizeLabelLeak(
        (snapshot.dbaName as string | null | undefined) ?? null,
        ["Physical Address", "Phone", "Mailing Address", "USDOT Number", "Legal Name"],
      ),
      usdotNumber: usdotNumber ?? null,
      mcNumber: (snapshot.mcNumber as string | null | undefined) ?? null,
      usdOTStatus: sanitizeStatus((snapshot.usdOTStatus as string | null | undefined) ?? null),
      operatingStatus: (snapshot.operatingStatus as string | null | undefined) ?? null,
      entityType: (snapshot.entityType as string | null | undefined) ?? null,
      phone: (snapshot.phone as string | null | undefined) ?? null,
      addressRaw: (snapshot.addressRaw as string | null | undefined) ?? null,
      mailingAddressRaw: (snapshot.mailingAddressRaw as string | null | undefined) ?? null,
      ...address,
      drivers: toInt((snapshot.driversText as string | null | undefined) ?? null),
      powerUnits: toInt((snapshot.powerUnitsText as string | null | undefined) ?? null),
      mcs150Mileage: toInt((snapshot.mileageText as string | null | undefined) ?? null),
      mileageYear: parseMileageYear(
        (snapshot.mileageText as string | null | undefined) ?? null,
        (snapshot.formDateText as string | null | undefined) ?? null,
      ),
      operationClassifications: [...new Set([...operationClassification, ...carrierOperation])],
      cargoCarried,
    },
    summary: {
      snapshotDate: (snapshot.snapshotDate as string | null | undefined) ?? null,
      outOfServiceDate: (snapshot.outOfServiceDate as string | null | undefined) ?? null,
      mcs150FormDate: (snapshot.formDateText as string | null | undefined) ?? null,
      dunsNumber: (snapshot.dunsNumber as string | null | undefined) ?? null,
      nonCmvUnits: toInt((snapshot.nonCmvUnitsText as string | null | undefined) ?? null),
      safetyRating: snapshot.safetyRating as SaferSummary["safetyRating"],
      usInspections: snapshot.usInspections as SaferSummary["usInspections"],
      usCrashes: snapshot.usCrashes as SaferSummary["usCrashes"],
      canadaInspections: snapshot.canadaInspections as SaferSummary["canadaInspections"],
      canadaCrashes: snapshot.canadaCrashes as SaferSummary["canadaCrashes"],
    },
    rawSnapshot: parsed.rawSnapshot,
  };
}
