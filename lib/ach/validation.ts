import { AchServiceError } from "@/lib/ach/errors";

type CreateAchPayload = {
  accountNumber: string;
  accountType: "checking" | "savings";
  bankName: string;
  confirmAccountNumber: string;
  holderName: string;
  label: string | null;
  routingNumber: string;
};

function normalizeOptionalText(value: unknown, label: string, maxLength = 120) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new AchServiceError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new AchServiceError(`${label} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeRequiredText(value: unknown, label: string, maxLength = 120) {
  const normalized = normalizeOptionalText(value, label, maxLength);
  if (!normalized) {
    throw new AchServiceError(`${label} is required.`);
  }

  return normalized;
}

function normalizeDigits(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new AchServiceError(`${label} is required.`);
  }

  const digits = value.replace(/[\s-]/g, "");
  if (!digits) {
    throw new AchServiceError(`${label} is required.`);
  }

  if (!/^\d+$/.test(digits)) {
    throw new AchServiceError(`${label} must contain only numbers.`);
  }

  return digits;
}

export function validateAbaRoutingNumber(routingNumber: string) {
  if (!/^\d{9}$/.test(routingNumber)) {
    throw new AchServiceError("Routing number must contain exactly 9 digits.");
  }

  const digits = routingNumber.split("").map((digit) => Number(digit));
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8]);

  if (checksum % 10 !== 0) {
    throw new AchServiceError("Routing number failed ABA checksum validation.");
  }

  return routingNumber;
}

export function validateAccountNumber(accountNumber: string) {
  if (!/^\d{4,17}$/.test(accountNumber)) {
    throw new AchServiceError(
      "Account number must contain between 4 and 17 digits.",
    );
  }

  return accountNumber;
}

export function normalizeAchAccountType(value: unknown) {
  if (typeof value !== "string") {
    throw new AchServiceError("Account type is required.");
  }

  const normalized = value.trim().toLowerCase();
  if (normalized !== "checking" && normalized !== "savings") {
    throw new AchServiceError("Account type must be checking or savings.");
  }

  return normalized as "checking" | "savings";
}

export function normalizeAchCreatePayload(rawInput: unknown): CreateAchPayload {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AchServiceError("ACH payload is invalid.");
  }

  const payload = rawInput as Record<string, unknown>;
  const routingNumber = validateAbaRoutingNumber(
    normalizeDigits(payload.routingNumber, "Routing number"),
  );
  const accountNumber = validateAccountNumber(
    normalizeDigits(payload.accountNumber, "Account number"),
  );
  const confirmAccountNumber = validateAccountNumber(
    normalizeDigits(payload.confirmAccountNumber, "Confirm account number"),
  );

  if (accountNumber !== confirmAccountNumber) {
    throw new AchServiceError("Account number confirmation does not match.");
  }

  return {
    accountNumber,
    accountType: normalizeAchAccountType(payload.accountType),
    bankName: normalizeRequiredText(payload.bankName, "Bank name"),
    confirmAccountNumber,
    holderName: normalizeRequiredText(payload.holderName, "Account holder name"),
    label: normalizeOptionalText(payload.label, "Label"),
    routingNumber,
  };
}

export function normalizeConsentPayload(rawInput: unknown) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AchServiceError("Authorization payload is invalid.");
  }

  const payload = rawInput as Record<string, unknown>;

  return {
    consentText: normalizeRequiredText(payload.consentText, "Consent text", 5000),
    consentVersion: normalizeRequiredText(payload.consentVersion, "Consent version", 40),
  };
}

export function normalizeRevealReason(rawInput: unknown) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AchServiceError("Reveal payload is invalid.");
  }

  const payload = rawInput as Record<string, unknown>;
  const reason = normalizeRequiredText(payload.reason, "Reason", 500);

  if (reason.length < 12) {
    throw new AchServiceError("Reveal reason must be at least 12 characters long.");
  }

  return reason;
}

export function normalizeUsageType(value: unknown) {
  if (typeof value !== "string") {
    throw new AchServiceError("Usage type is required.");
  }

  const normalized = value.trim().toUpperCase();
  if (!["IRS", "UCR", "IFTA", "DMV", "REGISTRATION", "OTHER"].includes(normalized)) {
    throw new AchServiceError("Usage type is invalid.");
  }

  return normalized;
}

export function normalizeFilingUsageCreatePayload(rawInput: unknown) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AchServiceError("Payment usage payload is invalid.");
  }

  const payload = rawInput as Record<string, unknown>;
  const paymentMethodId = normalizeRequiredText(
    payload.paymentMethodId,
    "Payment method",
    64,
  );
  const usageType = normalizeUsageType(payload.usageType);
  const portalName = normalizeOptionalText(payload.portalName, "Portal name", 120);
  const notes = normalizeOptionalText(payload.notes, "Notes", 4000);
  const amount =
    payload.amount == null || payload.amount === ""
      ? null
      : typeof payload.amount === "number"
        ? payload.amount
        : Number(payload.amount);

  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    throw new AchServiceError("Amount must be a positive number.");
  }

  return {
    amount,
    notes,
    paymentMethodId,
    portalName,
    usageType,
  };
}

export function normalizeFilingUsageUpdatePayload(rawInput: unknown) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AchServiceError("Payment usage update payload is invalid.");
  }

  const payload = rawInput as Record<string, unknown>;
  const notes = normalizeOptionalText(payload.notes, "Notes", 4000);
  const confirmationNumber = normalizeOptionalText(
    payload.confirmationNumber,
    "Confirmation number",
    120,
  );
  const receiptDocumentId = normalizeOptionalText(
    payload.receiptDocumentId,
    "Receipt document",
    64,
  );
  const paymentDate = normalizeOptionalText(payload.paymentDate, "Payment date", 60);

  return {
    confirmationNumber,
    notes,
    paymentDate,
    receiptDocumentId,
  };
}
