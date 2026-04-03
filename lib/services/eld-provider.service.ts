import { prisma } from "@/lib/prisma";
import {
  decryptEldSecret,
  encryptEldSecret,
  getCurrentEldKeyMetadata,
} from "@/lib/eld-provider-encryption";
import { SettingsValidationError } from "./settings-errors";

export type EldProviderCredentialRecord = {
  providerName: string;
  loginUrl: string;
  username: string;
  password: string;
  accountIdentifier: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type EldProviderCredentialInput = {
  providerName?: unknown;
  loginUrl?: unknown;
  username?: unknown;
  password?: unknown;
  accountIdentifier?: unknown;
  notes?: unknown;
};

function emptyEldCredentialRecord(): EldProviderCredentialRecord {
  return {
    providerName: "",
    loginUrl: "",
    username: "",
    password: "",
    accountIdentifier: "",
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}

function normalizeOptionalString(value: unknown, label: string, maxLength = 180) {
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

function normalizeRequiredString(value: unknown, label: string, maxLength = 180) {
  const normalized = normalizeOptionalString(value, label, maxLength);
  if (!normalized) {
    throw new SettingsValidationError(`${label} is required.`);
  }

  return normalized;
}

function normalizePassword(value: unknown) {
  if (typeof value !== "string") {
    throw new SettingsValidationError("Password must be a string.");
  }

  if (!value.length) {
    throw new SettingsValidationError("Password is required.");
  }

  if (value.length > 200) {
    throw new SettingsValidationError("Password must be 200 characters or fewer.");
  }

  return value;
}

function normalizeLoginUrl(value: unknown) {
  const normalized = normalizeOptionalString(value, "Login URL", 500);
  if (!normalized) return null;

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new SettingsValidationError("Login URL must be a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SettingsValidationError("Login URL must start with http:// or https://.");
  }

  return parsed.toString();
}

export async function getEldProviderCredential(
  userId: string,
): Promise<EldProviderCredentialRecord> {
  const record = await prisma.eldProviderCredential.findUnique({
    where: { userId },
    select: {
      providerName: true,
      loginUrl: true,
      usernameEncrypted: true,
      passwordEncrypted: true,
      accountIdentifierEncrypted: true,
      notesEncrypted: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!record) {
    return emptyEldCredentialRecord();
  }

  return {
    providerName: record.providerName,
    loginUrl: record.loginUrl ?? "",
    username: decryptEldSecret(record.usernameEncrypted),
    password: decryptEldSecret(record.passwordEncrypted),
    accountIdentifier: record.accountIdentifierEncrypted
      ? decryptEldSecret(record.accountIdentifierEncrypted)
      : "",
    notes: record.notesEncrypted ? decryptEldSecret(record.notesEncrypted) : "",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function upsertEldProviderCredential(
  userId: string,
  input: EldProviderCredentialInput,
): Promise<EldProviderCredentialRecord> {
  const providerName = normalizeRequiredString(input.providerName, "Provider name", 120);
  const loginUrl = normalizeLoginUrl(input.loginUrl);
  const username = normalizeRequiredString(input.username, "Username or email", 180);
  const password = normalizePassword(input.password);
  const accountIdentifier = normalizeOptionalString(
    input.accountIdentifier,
    "Account or fleet ID",
    180,
  );
  const notes = normalizeOptionalString(input.notes, "Notes", 2000);
  const keyMetadata = getCurrentEldKeyMetadata();

  await prisma.eldProviderCredential.upsert({
    where: { userId },
    update: {
      providerName,
      loginUrl,
      usernameEncrypted: encryptEldSecret(username),
      passwordEncrypted: encryptEldSecret(password),
      accountIdentifierEncrypted: accountIdentifier
        ? encryptEldSecret(accountIdentifier)
        : null,
      notesEncrypted: notes ? encryptEldSecret(notes) : null,
      encryptionKeyId: keyMetadata.keyId,
      encryptionVersion: keyMetadata.version,
    },
    create: {
      userId,
      providerName,
      loginUrl,
      usernameEncrypted: encryptEldSecret(username),
      passwordEncrypted: encryptEldSecret(password),
      accountIdentifierEncrypted: accountIdentifier
        ? encryptEldSecret(accountIdentifier)
        : null,
      notesEncrypted: notes ? encryptEldSecret(notes) : null,
      encryptionKeyId: keyMetadata.keyId,
      encryptionVersion: keyMetadata.version,
    },
  });

  return getEldProviderCredential(userId);
}
