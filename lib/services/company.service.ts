import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SaferCompanyNormalized } from "@/services/fmcsa/saferTypes";
import { ensureUserOrganization } from "./organization.service";
import { SettingsValidationError } from "./settings-errors";

export type CompanyProfileRecord = {
  owner: string;
  legalName: string;
  dbaName: string;
  companyName: string;
  dotNumber: string;
  mcNumber: string;
  ein: string;
  businessPhone: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  trucksCount: string;
  driversCount: string;
  saferStatus: string;
  saferEntityType: string;
  saferOperatingStatus: string;
  saferPowerUnits: string;
  saferDrivers: string;
  saferMcs150Mileage: string;
  saferMileageYear: string;
  saferLastFetchedAt: string;
  saferAutoFilled: boolean;
  saferNeedsReview: boolean;
};

export type CompanyProfileInput = {
  owner?: unknown;
  legalName?: unknown;
  dbaName?: unknown;
  companyName?: unknown;
  dotNumber?: unknown;
  mcNumber?: unknown;
  ein?: unknown;
  businessPhone?: unknown;
  address?: unknown;
  addressLine1?: unknown;
  addressLine2?: unknown;
  city?: unknown;
  state?: unknown;
  zipCode?: unknown;
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

function normalizeZipCode(value: unknown) {
  const normalized = normalizeOptionalString(value, "ZIP code", 10);
  if (!normalized) return null;

  if (!/^\d{5}(?:-\d{4})?$/.test(normalized)) {
    throw new SettingsValidationError("ZIP code must be 5 digits or ZIP+4.");
  }

  return normalized;
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

function formatOptionalNumber(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : "";
}

function formatOptionalDate(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function joinAddressParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

function buildLegacyAddress(input: {
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}) {
  if (input.address?.trim()) {
    return input.address.trim();
  }

  const lineParts = [input.addressLine1, input.addressLine2]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const locality = joinAddressParts([
    input.city ?? null,
    input.state ?? null,
    input.zipCode ?? null,
  ]);

  return joinAddressParts([lineParts || null, locality || null]) || null;
}

function parseIsoDate(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new SettingsValidationError(`${label} must be a valid ISO date.`);
  }

  return date;
}

export async function getCompanyProfile(userId: string): Promise<CompanyProfileRecord> {
  const [organization, user] = await Promise.all([
    ensureUserOrganization(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
  ]);
  const company = await prisma.companyProfile.findUnique({
    where: { id: organization.id },
    select: {
      owner: true,
      name: true,
      legalName: true,
      dbaName: true,
      companyName: true,
      dotNumber: true,
      mcNumber: true,
      ein: true,
      phone: true,
      businessPhone: true,
      address: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zipCode: true,
      trucksCount: true,
      driversCount: true,
      saferStatus: true,
      saferEntityType: true,
      saferOperatingStatus: true,
      saferPowerUnits: true,
      saferDrivers: true,
      saferMcs150Mileage: true,
      saferMileageYear: true,
      saferLastFetchedAt: true,
      saferAutoFilled: true,
      saferNeedsReview: true,
    },
  });

  return {
    owner: company?.owner ?? user?.name ?? "",
    legalName: company?.legalName ?? "",
    dbaName: company?.dbaName ?? "",
    companyName: company?.companyName ?? "",
    dotNumber: company?.dotNumber ?? "",
    mcNumber: company?.mcNumber ?? "",
    ein: company?.ein ?? "",
    businessPhone: company?.businessPhone ?? company?.phone ?? "",
    address:
      buildLegacyAddress({
        address: company?.address ?? null,
        addressLine1: company?.addressLine1 ?? null,
        addressLine2: company?.addressLine2 ?? null,
        city: company?.city ?? null,
        state: company?.state ?? null,
        zipCode: company?.zipCode ?? null,
      }) ?? "",
    addressLine1: company?.addressLine1 ?? company?.address ?? "",
    addressLine2: company?.addressLine2 ?? "",
    city: company?.city ?? "",
    state: company?.state ?? "",
    zipCode: company?.zipCode ?? "",
    trucksCount: formatOptionalNumber(company?.trucksCount),
    driversCount: formatOptionalNumber(company?.driversCount),
    saferStatus: company?.saferStatus ?? "",
    saferEntityType: company?.saferEntityType ?? "",
    saferOperatingStatus: company?.saferOperatingStatus ?? "",
    saferPowerUnits: formatOptionalNumber(company?.saferPowerUnits),
    saferDrivers: formatOptionalNumber(company?.saferDrivers),
    saferMcs150Mileage: formatOptionalNumber(company?.saferMcs150Mileage),
    saferMileageYear: formatOptionalNumber(company?.saferMileageYear),
    saferLastFetchedAt: formatOptionalDate(company?.saferLastFetchedAt),
    saferAutoFilled: company?.saferAutoFilled ?? false,
    saferNeedsReview: company?.saferNeedsReview ?? false,
  };
}

export async function upsertCompanyProfile(
  userId: string,
  input: CompanyProfileInput,
): Promise<CompanyProfileRecord> {
  const [organization, user] = await Promise.all([
    ensureUserOrganization(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
  ]);

  const owner = normalizeOptionalString(input.owner, "Owner", 140);
  const legalName = normalizeOptionalString(input.legalName, "Legal name", 140);
  const dbaName = normalizeOptionalString(input.dbaName, "DBA name", 140);
  const companyName =
    normalizeOptionalString(input.companyName, "Company display name", 140) ??
    legalName ??
    dbaName;
  const businessPhone = normalizeOptionalPhone(input.businessPhone);
  const addressFallback = normalizeOptionalString(input.address, "Business address", 180);
  const addressLine1 =
    normalizeOptionalString(input.addressLine1, "Address line 1", 180) ?? addressFallback;
  const addressLine2 = normalizeOptionalString(input.addressLine2, "Address line 2", 180);
  const city = normalizeOptionalString(input.city, "City", 120);
  const state = normalizeState(input.state);
  const zipCode = normalizeZipCode(input.zipCode);
  const ownerName = owner ?? user?.name ?? null;
  const address = buildLegacyAddress({
    address: addressFallback,
    addressLine1,
    addressLine2,
    city,
    state,
    zipCode,
  });

  const dotNumber = normalizeDotNumber(input.dotNumber);
  const mcNumber = normalizeMcNumber(input.mcNumber);
  const ein = normalizeEin(input.ein);
  const trucksCount = normalizeCount(input.trucksCount, "Trucks count");
  const driversCount = normalizeCount(input.driversCount, "Drivers count");

  await prisma.$transaction(async (tx) => {
    if (owner && owner !== user?.name) {
      await tx.user.update({
        where: { id: userId },
        data: { name: owner },
      });
    }

    await tx.companyProfile.upsert({
      where: { id: organization.id },
      update: {
        owner: ownerName,
        name: companyName ?? legalName ?? dbaName,
        legalName,
        dbaName,
        companyName,
        dotNumber,
        mcNumber,
        ein,
        phone: businessPhone,
        businessPhone,
        address,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
        trucksCount,
        driversCount,
      },
      create: {
        id: organization.id,
        userId,
        owner: ownerName,
        name: companyName ?? legalName ?? dbaName,
        legalName,
        dbaName,
        companyName,
        dotNumber,
        mcNumber,
        ein,
        phone: businessPhone,
        businessPhone,
        address,
        addressLine1,
        addressLine2,
        city,
        state,
        zipCode,
        trucksCount,
        driversCount,
      },
    });
  });

  return getCompanyProfile(userId);
}

export async function applySaferToCompanyProfile(
  userId: string,
  lookupResult: SaferCompanyNormalized,
): Promise<CompanyProfileRecord> {
  if (!lookupResult.found || !lookupResult.company) {
    throw new SettingsValidationError("No SAFER result available to apply.");
  }

  const organization = await ensureUserOrganization(userId);
  const existingProfile = await prisma.companyProfile.findUnique({
    where: { id: organization.id },
    select: { companyName: true, owner: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const company = lookupResult.company;
  const saferDate = parseIsoDate(lookupResult.fetchedAt, "Fetched date");
  const saferNeedsReview =
    lookupResult.warnings.length > 0 ||
    !company.legalName ||
    !company.addressLine1 ||
    !company.state;
  const address = buildLegacyAddress({
    address: company.addressRaw ?? null,
    addressLine1: company.addressLine1 ?? null,
    addressLine2: company.addressLine2 ?? null,
    city: company.city ?? null,
    state: company.state ?? null,
    zipCode: company.zipCode ?? null,
  });

  const profileData = {
    owner: existingProfile?.owner?.trim() || user?.name || undefined,
    name:
      existingProfile?.companyName?.trim() || company.dbaName || company.legalName || undefined,
    dotNumber: company.usdotNumber ?? lookupResult.searchedDotNumber,
    mcNumber: company.mcNumber ?? undefined,
    legalName: company.legalName ?? undefined,
    dbaName: company.dbaName ?? undefined,
    companyName:
      existingProfile?.companyName?.trim() || company.dbaName || company.legalName
        ? existingProfile?.companyName?.trim() || company.dbaName || company.legalName
        : undefined,
    phone: company.phone ?? undefined,
    businessPhone: company.phone ?? undefined,
    address: address ?? undefined,
    addressLine1: company.addressLine1 ?? undefined,
    addressLine2: company.addressLine2 ?? undefined,
    city: company.city ?? undefined,
    state: company.state ?? undefined,
    zipCode: company.zipCode ?? undefined,
    mailingAddressRaw: company.mailingAddressRaw ?? undefined,
    trucksCount: company.powerUnits ?? undefined,
    driversCount: company.drivers ?? undefined,
    saferStatus: company.usdOTStatus ?? undefined,
    saferEntityType: company.entityType ?? undefined,
    saferOperatingStatus: company.operatingStatus ?? undefined,
    saferPowerUnits: company.powerUnits ?? undefined,
    saferDrivers: company.drivers ?? undefined,
    saferMcs150Mileage: company.mcs150Mileage ?? undefined,
    saferMileageYear: company.mileageYear ?? undefined,
    saferLastFetchedAt: saferDate,
    saferAutoFilled: true,
    saferNeedsReview,
    saferRawSnapshot: (lookupResult.rawSnapshot as Prisma.InputJsonValue | undefined) ?? undefined,
  };

  await prisma.companyProfile.upsert({
    where: { id: organization.id },
    update: profileData,
    create: {
      id: organization.id,
      userId,
      ...profileData,
    },
  });

  return getCompanyProfile(userId);
}
