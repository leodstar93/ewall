import { prisma } from "@/lib/prisma";
import { SettingsValidationError } from "./settings-errors";

export type PersonalInfoRecord = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

export type PersonalInfoInput = {
  name?: unknown;
  phone?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
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

function normalizeRequiredName(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SettingsValidationError("Full name is required.");
  }

  const normalized = value.trim();
  if (normalized.length > 120) {
    throw new SettingsValidationError("Full name must be 120 characters or fewer.");
  }

  return normalized;
}

function normalizePhone(value: unknown) {
  const normalized = normalizeOptionalString(value, "Phone", 24);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    throw new SettingsValidationError("Phone must contain between 10 and 15 digits.");
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

function normalizeZip(value: unknown) {
  const normalized = normalizeOptionalString(value, "ZIP code", 10);
  if (!normalized) return null;

  if (!/^\d{5}(?:-\d{4})?$/.test(normalized)) {
    throw new SettingsValidationError("ZIP code must be in 5-digit or ZIP+4 format.");
  }

  return normalized;
}

export async function getPersonalInfo(userId: string): Promise<PersonalInfoRecord> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      userProfile: {
        select: {
          phone: true,
          address: true,
          city: true,
          state: true,
          zip: true,
        },
      },
    },
  });

  if (!user) {
    throw new SettingsValidationError("User not found.");
  }

  return {
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.userProfile?.phone ?? "",
    address: user.userProfile?.address ?? "",
    city: user.userProfile?.city ?? "",
    state: user.userProfile?.state ?? "",
    zip: user.userProfile?.zip ?? "",
  };
}

export async function updatePersonalInfo(
  userId: string,
  input: PersonalInfoInput,
): Promise<PersonalInfoRecord> {
  const name = normalizeRequiredName(input.name);
  const phone = normalizePhone(input.phone);
  const address = normalizeOptionalString(input.address, "Address", 180);
  const city = normalizeOptionalString(input.city, "City", 80);
  const state = normalizeState(input.state);
  const zip = normalizeZip(input.zip);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { name },
    }),
    prisma.userProfile.upsert({
      where: { userId },
      update: {
        phone,
        address,
        city,
        state,
        zip,
      },
      create: {
        userId,
        phone,
        address,
        city,
        state,
        zip,
      },
    }),
  ]);

  return getPersonalInfo(userId);
}
