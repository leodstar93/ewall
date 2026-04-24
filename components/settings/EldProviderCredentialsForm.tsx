"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import type { EldProviderCredentialsFormData } from "@/components/settings/eldProviderTypes";
import {
  Field,
  StatusBadge,
  textInputClassName,
} from "@/components/settings/settings-ui";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EldProviderCredentialsForm({
  form,
  onChange,
}: {
  form: EldProviderCredentialsFormData;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const updatedLabel = useMemo(
    () => (form.updatedAt ? formatDateTime(form.updatedAt) : ""),
    [form.updatedAt],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Encrypted ELD access</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Save the ELD provider details staff need when they log in on your behalf.
              Sensitive fields are encrypted before they are stored.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="blue">Encrypted</StatusBadge>
            {updatedLabel ? <StatusBadge tone="zinc">Updated {updatedLabel}</StatusBadge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="ELD provider">
          <input
            name="providerName"
            value={form.providerName}
            onChange={onChange}
            className={textInputClassName()}
            maxLength={120}
            placeholder="Motive, Samsara, Geotab..."
          />
        </Field>

        <Field label="Login URL" hint="Optional direct login page for the provider portal.">
          <input
            name="loginUrl"
            type="url"
            value={form.loginUrl}
            onChange={onChange}
            className={textInputClassName()}
            autoComplete="off"
            placeholder="https://..."
            spellCheck={false}
          />
        </Field>

        <Field label="Username or email">
          <input
            name="username"
            value={form.username}
            onChange={onChange}
            className={textInputClassName()}
            autoComplete="off"
            maxLength={180}
            spellCheck={false}
          />
        </Field>

        <Field label="Password">
          <div className="flex gap-3">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={onChange}
              className={textInputClassName()}
              autoComplete="new-password"
              maxLength={200}
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="shrink-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <Field
          label="Account or fleet ID"
          hint="Optional account number, fleet code, or tenant identifier staff should use."
        >
          <input
            name="accountIdentifier"
            value={form.accountIdentifier}
            onChange={onChange}
            className={textInputClassName()}
            autoComplete="off"
            maxLength={180}
          />
        </Field>

        <Field
          label="Notes"
          hint="Optional notes such as MFA instructions, backup codes location, or portal quirks."
        >
          <textarea
            name="notes"
            value={form.notes}
            onChange={onChange}
            className={`${textInputClassName()} min-h-32 resize-y`}
            maxLength={2000}
          />
        </Field>
      </div>
    </div>
  );
}
