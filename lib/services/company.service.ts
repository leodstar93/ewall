import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "./settings-errors";

export type CompanyProfileRecord = {
  legalName: string;
  dbaName: string;
  dotNumber: string;
  mcNumber: string;
  ein: string;
  businessPhone: string;
  address: string;
  state: string;
  trucksCount: string;
  driversCount: string;
};

export type CompanyProfileInput = {
  legalName?: unknown;
  dbaName?: unknown;
  dotNumber?: unknown;
  mcNumber?: unknown;
  ein?: unknown;
  businessPhone?: unknown;
  address?: unknown;
  state?: unknown;
  trucksCount?: unknown;
  driversCount?: unknown;
};

function normalizeOptionalString(value: unknown, label: string, maxLength = 120) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new SettingsValidationError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new SettingsValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeOptionalPhone(value: unknown) {
  const normalized = normalizeOptionalString(value, "Business phone", 24);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new SettingsValidationError("Business phone must contain between 10 and 15 digits.");
  }

  return normalized;
}

function normalizeState(value: unknown) {
  const normalized = normalizeOptionalString(value, "State", 24);
  if (!normalized) return null;

  if (!/^[A-Za-z]{2,24}$/.test(normalized)) {
    throw new SettingsValidationError("State must contain letters only.");
  }

  return normalized.toUpperCase();
}

function normalizeDotNumber(value: unknown) {
  const normalized = normalizeOptionalString(value, "DOT number", 12);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  if (!/^\d{5,8}$/.test(digits)) {
    throw new SettingsValidationError("DOT number must contain 5 to 8 digits.");
  }

  return digits;
}

function normalizeMcNumber(value: unknown) {
  const normalized = normalizeOptionalString(value, "MC number", 16);
  if (!normalized) return null;

  const digits = normalized.toUpperCase().replace(/^MC[- ]?/, "").replace(/\D/g, "");
  if (!/^\d{4,8}$/.test(digits)) {
    throw new SettingsValidationError("MC number must contain 4 to 8 digits.");
  }

  return `MC-${digits}`;
}

function normalizeEin(value: unknown) {
  const normalized = normalizeOptionalString(value, "EIN", 10);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  if (!/^\d{9}$/.test(digits)) {
    throw new SettingsValidationError("EIN must contain 9 digits.");
  }

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function normalizeCount(value: unknown, label: string) {
  if (value == null || value === "") return null;

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100000) {
    throw new SettingsValidationError(`${label} must be a whole number between 0 and 100000.`);
  }

  return numeric;
}

export async function getCompanyProfile(userId: string): Promise<CompanyProfileRecord> {
  const company = await prisma.companyProfile.findUnique({
    where: { userId },
    select: {
      legalName: true,
      dbaName: true,
      dotNumber: true,
      mcNumber: true,
      ein: true,
      businessPhone: true,
      address: true,
      state: true,
      trucksCount: true,
      driversCount: true,
    },
  });

  return {
    legalName: company?.legalName ?? "",
    dbaName: company?.dbaName ?? "",
    dotNumber: company?.dotNumber ?? "",
    mcNumber: company?.mcNumber ?? "",
    ein: company?.ein ?? "",
    businessPhone: company?.businessPhone ?? "",
    address: company?.address ?? "",
    state: company?.state ?? "",
    trucksCount:
      typeof company?.trucksCount === "number" ? String(company.trucksCount) : "",
    driversCount:
      typeof company?.driversCount === "number" ? String(company.driversCount) : "",
  };
}

export async function upsertCompanyProfile(
  userId: string,
  input: CompanyProfileInput,
): Promise<CompanyProfileRecord> {
  await prisma.companyProfile.upsert({
    where: { userId },
    update: {
      legalName: normalizeOptionalString(input.legalName, "Legal name", 140),
      dbaName: normalizeOptionalString(input.dbaName, "DBA name", 140),
      dotNumber: normalizeDotNumber(input.dotNumber),
      mcNumber: normalizeMcNumber(input.mcNumber),
      ein: normalizeEin(input.ein),
      businessPhone: normalizeOptionalPhone(input.businessPhone),
      address: normalizeOptionalString(input.address, "Business address", 180),
      state: normalizeState(input.state),
      trucksCount: normalizeCount(input.trucksCount, "Trucks count"),
      driversCount: normalizeCount(input.driversCount, "Drivers count"),
    },
    create: {
      userId,
      legalName: normalizeOptionalString(input.legalName, "Legal name", 140),
      dbaName: normalizeOptionalString(input.dbaName, "DBA name", 140),
      dotNumber: normalizeDotNumber(input.dotNumber),
      mcNumber: normalizeMcNumber(input.mcNumber),
      ein: normalizeEin(input.ein),
      businessPhone: normalizeOptionalPhone(input.businessPhone),
      address: normalizeOptionalString(input.address, "Business address", 180),
      state: normalizeState(input.state),
      trucksCount: normalizeCount(input.trucksCount, "Trucks count"),
      driversCount: normalizeCount(input.driversCount, "Drivers count"),
    },
  });

  return getCompanyProfile(userId);
}
