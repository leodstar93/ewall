"use client";

import { InlineAlert, StatusBadge } from "@/app/(dashboard)/settings/components/settings-ui";
import type { SaferCompanyNormalized } from "@/services/fmcsa/saferTypes";

function formatFetchedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderList(values?: string[]) {
  if (!values?.length) return "Not available";
  return values.join(", ");
}

export default function SaferLookupPreview({
  lookupResult,
  applying,
  onApply,
  onCancel,
}: {
  lookupResult: SaferCompanyNormalized;
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  if (!lookupResult.found || !lookupResult.company) return null;

  const company = lookupResult.company;
  const hasDotMismatch =
    Boolean(company.usdotNumber) && company.usdotNumber !== lookupResult.searchedDotNumber;

  return (
    <div className="rounded-[26px] border border-sky-200 bg-sky-50/70 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue">Imported from FMCSA SAFER</StatusBadge>
            <StatusBadge tone="zinc">Last synced: {formatFetchedAt(lookupResult.fetchedAt)}</StatusBadge>
            {lookupResult.warnings.length ? <StatusBadge tone="amber">Review suggested</StatusBadge> : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-zinc-950">
            {company.legalName || company.dbaName || "SAFER company snapshot"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            Review the public FMCSA data below, then apply it to your company profile if it looks right.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={applying || hasDotMismatch}
            className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {applying ? "Applying..." : "Use this information"}
          </button>
        </div>
      </div>

      {lookupResult.warnings.length ? (
        <div className="mt-4 space-y-2">
          {lookupResult.warnings.map((warning) => (
            <InlineAlert key={warning} tone="info" message={warning} />
          ))}
        </div>
      ) : null}

      {hasDotMismatch ? (
        <div className="mt-4">
          <InlineAlert
            tone="error"
            message="The USDOT number in the SAFER snapshot does not match the USDOT number you searched. Review it manually before applying."
          />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Identity</p>
          <dl className="mt-3 space-y-2 text-sm text-zinc-700">
            <div>
              <dt className="font-medium text-zinc-900">USDOT</dt>
              <dd>{company.usdotNumber || lookupResult.searchedDotNumber}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">MC</dt>
              <dd>{company.mcNumber || "Not available"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">DBA</dt>
              <dd>{company.dbaName || "Not available"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Entity type</dt>
              <dd>{company.entityType || "Not available"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Contact</p>
          <dl className="mt-3 space-y-2 text-sm text-zinc-700">
            <div>
              <dt className="font-medium text-zinc-900">Phone</dt>
              <dd>{company.phone || "Not available"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Address</dt>
              <dd>{company.addressRaw || "Not available"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Mailing address</dt>
              <dd>{company.mailingAddressRaw || "Not available"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Operations</p>
          <dl className="mt-3 space-y-2 text-sm text-zinc-700">
            <div>
              <dt className="font-medium text-zinc-900">USDOT status</dt>
              <dd>{company.usdOTStatus || "Not available"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Operating status</dt>
              <dd>{company.operatingStatus || "Not available"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">Power units / drivers</dt>
              <dd>
                {company.powerUnits ?? "?"} / {company.drivers ?? "?"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-900">MCS-150 mileage</dt>
              <dd>
                {company.mcs150Mileage?.toLocaleString("en-US") || "Not available"}
                {company.mileageYear ? ` (${company.mileageYear})` : ""}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Operation Classification
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            {renderList(company.operationClassifications)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Cargo Carried
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{renderList(company.cargoCarried)}</p>
        </div>
      </div>
    </div>
  );
}
