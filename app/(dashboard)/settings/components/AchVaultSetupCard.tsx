"use client";

import { useMemo, useRef, useState } from "react";
import { ACH_CONSENT_TEXT, ACH_CONSENT_VERSION } from "@/lib/ach/consent";
import { InlineAlert, StatusBadge } from "./settings-ui";

function normalizeDigits(value: string) {
  return value.replace(/[\s-]/g, "");
}

function validateRoutingNumber(value: string) {
  const digits = normalizeDigits(value);
  if (!/^\d{9}$/.test(digits)) {
    return "Routing number must contain exactly 9 digits.";
  }

  const parts = digits.split("").map((digit) => Number(digit));
  const checksum =
    3 * (parts[0] + parts[3] + parts[6]) +
    7 * (parts[1] + parts[4] + parts[7]) +
    (parts[2] + parts[5] + parts[8]);

  if (checksum % 10 !== 0) {
    return "Routing number failed ABA checksum validation.";
  }

  return "";
}

function validateAccountNumber(value: string) {
  const digits = normalizeDigits(value);
  if (!/^\d{4,17}$/.test(digits)) {
    return "Account number must contain between 4 and 17 digits.";
  }

  return "";
}

function fieldClassName(hasError: boolean) {
  return [
    "w-full rounded-2xl border px-4 py-3 text-sm text-zinc-900 outline-none transition",
    hasError
      ? "border-rose-300 bg-rose-50 focus:border-rose-400"
      : "border-zinc-200 bg-white focus:border-zinc-400 focus:ring-4 focus:ring-zinc-950/5",
  ].join(" ");
}

type FieldErrors = {
  accountNumber?: string;
  confirmAccountNumber?: string;
  consent?: string;
  routingNumber?: string;
};

export default function AchVaultSetupCard({
  onError,
  onSaved,
}: {
  onError: (message: string) => void;
  onSaved: () => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const routingInputRef = useRef<HTMLInputElement | null>(null);
  const accountInputRef = useRef<HTMLInputElement | null>(null);
  const confirmAccountInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [localError, setLocalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const consentSummary = useMemo(
    () => `Consent version ${ACH_CONSENT_VERSION} records your authorization with timestamp, IP address, and user agent.`,
    [],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const routingNumber = String(formData.get("routingNumber") ?? "");
    const accountNumber = String(formData.get("accountNumber") ?? "");
    const confirmAccountNumber = String(formData.get("confirmAccountNumber") ?? "");
    const nextErrors: FieldErrors = {};

    const routingError = validateRoutingNumber(routingNumber);
    if (routingError) nextErrors.routingNumber = routingError;

    const accountError = validateAccountNumber(accountNumber);
    if (accountError) nextErrors.accountNumber = accountError;

    const confirmError = validateAccountNumber(confirmAccountNumber);
    if (confirmError) {
      nextErrors.confirmAccountNumber = confirmError;
    } else if (
      normalizeDigits(accountNumber) !== normalizeDigits(confirmAccountNumber)
    ) {
      nextErrors.confirmAccountNumber = "Account number confirmation does not match.";
    }

    if (!consentChecked) {
      nextErrors.consent = "You must accept the ACH authorization before saving the account.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const message =
        nextErrors.routingNumber ||
        nextErrors.accountNumber ||
        nextErrors.confirmAccountNumber ||
        nextErrors.consent ||
        "Please review the ACH form.";
      setLocalError(message);
      onError(message);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setLocalError("");
    setSuccessMessage("");

    try {
      const createResponse = await fetch("/api/v1/payment-methods/ach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber,
          accountType: formData.get("accountType"),
          bankName: formData.get("bankName"),
          confirmAccountNumber,
          holderName: formData.get("holderName"),
          label: formData.get("label"),
          routingNumber,
        }),
      });

      const created = (await createResponse.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };

      if (!createResponse.ok || !created.id) {
        throw new Error(created.error || "Could not save the ACH account.");
      }

      if (routingInputRef.current) routingInputRef.current.value = "";
      if (accountInputRef.current) accountInputRef.current.value = "";
      if (confirmAccountInputRef.current) confirmAccountInputRef.current.value = "";

      const authorizeResponse = await fetch(
        `/api/v1/payment-methods/ach/${created.id}/authorize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consentText: ACH_CONSENT_TEXT,
            consentVersion: ACH_CONSENT_VERSION,
          }),
        },
      );

      const authorized = (await authorizeResponse.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!authorizeResponse.ok) {
        throw new Error(
          authorized.error || "The ACH account was saved, but authorization could not be completed.",
        );
      }

      formRef.current.reset();
      setConsentChecked(false);
      setSuccessMessage("ACH account saved and authorized.");
      await onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the ACH account.";
      setLocalError(message);
      onError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">Add ACH account</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Save business banking details in the encrypted ACH custody vault for manual IRS,
            UCR, DMV, and registration payments handled by authorized staff.
          </p>
        </div>
        <StatusBadge tone="blue">AES-256-GCM</StatusBadge>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Account holder name</span>
            <input
              name="holderName"
              autoComplete="off"
              className={fieldClassName(false)}
              maxLength={120}
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Bank name</span>
            <input
              name="bankName"
              autoComplete="off"
              className={fieldClassName(false)}
              maxLength={120}
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Account type</span>
            <select
              name="accountType"
              defaultValue="checking"
              className={fieldClassName(false)}
            >
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Label</span>
            <input
              name="label"
              autoComplete="off"
              className={fieldClassName(false)}
              maxLength={120}
              placeholder="Main business account"
            />
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Routing number</span>
            <input
              ref={routingInputRef}
              name="routingNumber"
              autoComplete="off"
              className={fieldClassName(Boolean(fieldErrors.routingNumber))}
              inputMode="numeric"
              maxLength={9}
              spellCheck={false}
              type="password"
            />
            {fieldErrors.routingNumber ? (
              <p className="text-xs text-rose-700">{fieldErrors.routingNumber}</p>
            ) : (
              <p className="text-xs text-zinc-500">9 digits, validated with the ABA checksum.</p>
            )}
          </label>

          <label className="space-y-2 text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">Account number</span>
            <input
              ref={accountInputRef}
              name="accountNumber"
              autoComplete="off"
              className={fieldClassName(Boolean(fieldErrors.accountNumber))}
              inputMode="numeric"
              maxLength={17}
              spellCheck={false}
              type="password"
            />
            {fieldErrors.accountNumber ? (
              <p className="text-xs text-rose-700">{fieldErrors.accountNumber}</p>
            ) : (
              <p className="text-xs text-zinc-500">4 to 17 digits. Stored only on the server.</p>
            )}
          </label>

          <label className="space-y-2 text-sm text-zinc-700 lg:col-span-2">
            <span className="font-medium text-zinc-900">Confirm account number</span>
            <input
              ref={confirmAccountInputRef}
              name="confirmAccountNumber"
              autoComplete="off"
              className={fieldClassName(Boolean(fieldErrors.confirmAccountNumber))}
              inputMode="numeric"
              maxLength={17}
              spellCheck={false}
              type="password"
            />
            {fieldErrors.confirmAccountNumber ? (
              <p className="text-xs text-rose-700">{fieldErrors.confirmAccountNumber}</p>
            ) : null}
          </label>
        </div>

        <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            ACH Authorization
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{ACH_CONSENT_TEXT}</p>
          <p className="mt-3 text-xs text-zinc-500">{consentSummary}</p>

          <label className="mt-4 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">
              I authorize secure storage and staff-initiated manual ACH use for eligible filings
              and registrations.
            </span>
          </label>

          {fieldErrors.consent ? (
            <p className="mt-3 text-xs text-rose-700">{fieldErrors.consent}</p>
          ) : null}
        </div>

        {localError ? <InlineAlert tone="error" message={localError} /> : null}
        {successMessage ? <InlineAlert tone="success" message={successMessage} /> : null}

        <button
          type="submit"
          className="w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving ACH account..." : "Save ACH account"}
        </button>
      </form>
    </div>
  );
}
