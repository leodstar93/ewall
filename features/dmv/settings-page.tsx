"use client";

import { FormEvent, useEffect, useState } from "react";

type RequirementTemplate = {
  id: string;
  code: string;
  name: string;
  appliesToType: string | null;
  isRequired: boolean;
};

type FeeRule = {
  id: string;
  amount: string | number;
  registrationType: string | null;
  jurisdictionCode: string | null;
  vehicleType: string | null;
};

type JurisdictionOption = {
  code: string;
  name: string;
};

export default function DmvSettingsPage() {
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    code: "",
    name: "",
    appliesToType: "",
    isRequired: true,
  });
  const [feeForm, setFeeForm] = useState({
    registrationType: "",
    jurisdictionCode: "NV",
    vehicleType: "",
    amount: "",
  });

  async function load() {
    try {
      setError(null);
      const [templatesResponse, feesResponse, jurisdictionsResponse] = await Promise.all([
        fetch("/api/v1/features/dmv/settings/requirements", { cache: "no-store" }),
        fetch("/api/v1/features/dmv/settings/fees", { cache: "no-store" }),
        fetch("/api/v1/features/dmv/settings/jurisdictions", { cache: "no-store" }),
      ]);
      const templatesData = (await templatesResponse.json().catch(() => ({}))) as {
        templates?: RequirementTemplate[];
      };
      const feesData = (await feesResponse.json().catch(() => ({}))) as {
        rules?: FeeRule[];
      };
      const jurisdictionsData = (await jurisdictionsResponse.json().catch(() => ({}))) as {
        jurisdictions?: JurisdictionOption[];
      };

      setTemplates(Array.isArray(templatesData.templates) ? templatesData.templates : []);
      setFees(Array.isArray(feesData.rules) ? feesData.rules : []);
      setJurisdictions(Array.isArray(jurisdictionsData.jurisdictions) ? jurisdictionsData.jurisdictions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DMV settings.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/v1/features/dmv/settings/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save requirement template.");
      }
      setTemplateForm({ code: "", name: "", appliesToType: "", isRequired: true });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save requirement template.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const response = await fetch("/api/v1/features/dmv/settings/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feeForm),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save fee rule.");
      }
      setFeeForm({ registrationType: "", jurisdictionCode: "NV", vehicleType: "", amount: "" });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save fee rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#ecfeff,_#ffffff_45%,_#fff7ed)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          DMV Admin Settings
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Requirement templates, fees, and Nevada jurisdictions
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          These shared settings control the checklist engine, fee estimation rules, and the
          jurisdiction selector used by the DMV registration and renewal workflows.
        </p>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={saveTemplate} className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">Add requirement template</h3>
          <div className="mt-5 grid gap-4">
            <input placeholder="Code" value={templateForm.code} onChange={(event) => setTemplateForm((current) => ({ ...current, code: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2" />
            <input placeholder="Name" value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2" />
            <select value={templateForm.appliesToType} onChange={(event) => setTemplateForm((current) => ({ ...current, appliesToType: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2">
              <option value="">All registration types</option>
              <option value="NEVADA_ONLY">Nevada only</option>
              <option value="IRP">IRP</option>
            </select>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input type="checkbox" checked={templateForm.isRequired} onChange={(event) => setTemplateForm((current) => ({ ...current, isRequired: event.target.checked }))} />
              <span>Required by default</span>
            </label>
            <button disabled={saving} className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400">
              {saving ? "Saving..." : "Save requirement"}
            </button>
          </div>
        </form>

        <form onSubmit={saveFee} className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">Add fee rule</h3>
          <div className="mt-5 grid gap-4">
            <select value={feeForm.registrationType} onChange={(event) => setFeeForm((current) => ({ ...current, registrationType: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2">
              <option value="">All registration types</option>
              <option value="NEVADA_ONLY">Nevada only</option>
              <option value="IRP">IRP</option>
            </select>
            <select value={feeForm.jurisdictionCode} onChange={(event) => setFeeForm((current) => ({ ...current, jurisdictionCode: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2">
              {jurisdictions.map((jurisdiction) => (
                <option key={jurisdiction.code} value={jurisdiction.code}>
                  {jurisdiction.code} - {jurisdiction.name}
                </option>
              ))}
            </select>
            <select value={feeForm.vehicleType} onChange={(event) => setFeeForm((current) => ({ ...current, vehicleType: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2">
              <option value="">All vehicle types</option>
              <option value="TRACTOR">Tractor</option>
              <option value="STRAIGHT_TRUCK">Straight truck</option>
              <option value="SEMI_TRUCK">Semi truck</option>
              <option value="OTHER">Other</option>
            </select>
            <input placeholder="Amount" value={feeForm.amount} onChange={(event) => setFeeForm((current) => ({ ...current, amount: event.target.value }))} className="rounded-2xl border border-zinc-300 px-3 py-2" />
            <button disabled={saving} className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400">
              {saving ? "Saving..." : "Save fee rule"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h3 className="text-xl font-semibold text-zinc-950">Requirement templates</h3>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-3 font-medium">Code</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="py-3 font-medium text-zinc-900">{template.code}</td>
                    <td className="py-3 text-zinc-600">{template.name}</td>
                    <td className="py-3 text-zinc-600">{template.appliesToType || "All"}</td>
                    <td className="py-3 text-zinc-600">{template.isRequired ? "Yes" : "Optional"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">Fee rules</h3>
          <div className="mt-5 space-y-3">
            {fees.map((fee) => (
              <div key={fee.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-zinc-900">
                  ${Number(fee.amount ?? 0).toFixed(2)} {fee.registrationType || "all types"}
                </p>
                <p className="text-xs text-zinc-500">
                  {fee.jurisdictionCode || "all jurisdictions"} / {fee.vehicleType || "all vehicles"}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
