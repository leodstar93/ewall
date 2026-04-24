"use client";

import type { ChangeEvent } from "react";
import { Field, textInputClassName } from "@/components/settings/settings-ui";
import type { CompanyProfileFormData } from "./companyProfileTypes";

export default function CompanyProfileForm({
  form,
  onChange,
}: {
  form: CompanyProfileFormData;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Owner" hint="Primary account owner name.">
        <input
          name="owner"
          value={form.owner}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="Legal name">
        <input
          name="legalName"
          value={form.legalName}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="DBA name">
        <input
          name="dbaName"
          value={form.dbaName}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="Company display name" hint="Keep this as your public-facing name if it differs from legal/DBA.">
        <input
          name="companyName"
          value={form.companyName}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="MC number">
        <input
          name="mcNumber"
          value={form.mcNumber}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="EIN">
        <input
          name="ein"
          value={form.ein}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="Business phone">
        <input
          name="businessPhone"
          value={form.businessPhone}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="Address line 1">
        <input
          name="addressLine1"
          value={form.addressLine1}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="Address line 2">
        <input
          name="addressLine2"
          value={form.addressLine2}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="City">
        <input
          name="city"
          value={form.city}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="State">
        <input
          name="state"
          value={form.state}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="ZIP code">
        <input
          name="zipCode"
          value={form.zipCode}
          onChange={onChange}
          className={textInputClassName()}
        />
      </Field>

      <Field label="Trucks count">
        <input
          name="trucksCount"
          value={form.trucksCount}
          onChange={onChange}
          className={textInputClassName()}
          inputMode="numeric"
        />
      </Field>

      <Field label="Drivers count">
        <input
          name="driversCount"
          value={form.driversCount}
          onChange={onChange}
          className={textInputClassName()}
          inputMode="numeric"
        />
      </Field>
    </div>
  );
}
