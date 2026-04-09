"use client";

import { FormEvent, useEffect, useState } from "react";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

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

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };

export default function DmvSettingsClient() {
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [fees, setFees] = useState<FeeRule[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [deletingFeeId, setDeletingFeeId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ id: "", code: "", name: "", appliesToType: "", isRequired: true });
  const [feeForm, setFeeForm] = useState({ id: "", registrationType: "", jurisdictionCode: "NV", vehicleType: "", amount: "" });

  async function load() {
    try {
      setError(null);
      const [templatesResponse, feesResponse, jurisdictionsResponse] = await Promise.all([
        fetch("/api/v1/features/dmv/settings/requirements", { cache: "no-store" }),
        fetch("/api/v1/features/dmv/settings/fees", { cache: "no-store" }),
        fetch("/api/v1/features/dmv/settings/jurisdictions", { cache: "no-store" }),
      ]);
      const templatesData = (await templatesResponse.json().catch(() => ({}))) as { templates?: RequirementTemplate[] };
      const feesData = (await feesResponse.json().catch(() => ({}))) as { rules?: FeeRule[] };
      const jurisdictionsData = (await jurisdictionsResponse.json().catch(() => ({}))) as { jurisdictions?: JurisdictionOption[] };
      setTemplates(Array.isArray(templatesData.templates) ? templatesData.templates : []);
      setFees(Array.isArray(feesData.rules) ? feesData.rules : []);
      setJurisdictions(Array.isArray(jurisdictionsData.jurisdictions) ? jurisdictionsData.jurisdictions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DMV settings.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true); setError(null);
      const response = await fetch("/api/v1/features/dmv/settings/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateForm),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save requirement template.");
      setTemplateForm({ id: "", code: "", name: "", appliesToType: "", isRequired: true });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save requirement template.");
    } finally { setSaving(false); }
  }

  async function saveFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true); setError(null);
      const response = await fetch("/api/v1/features/dmv/settings/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feeForm),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save fee rule.");
      setFeeForm({ id: "", registrationType: "", jurisdictionCode: "NV", vehicleType: "", amount: "" });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save fee rule.");
    } finally { setSaving(false); }
  }

  async function deleteTemplate(template: RequirementTemplate) {
    const confirmed = window.confirm(`Delete the requirement template "${template.name}" (${template.code})?`);
    if (!confirmed) return;
    try {
      setDeletingTemplateId(template.id); setError(null);
      const response = await fetch(`/api/v1/features/dmv/settings/requirements?id=${encodeURIComponent(template.id)}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete requirement template.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete requirement template.");
    } finally { setDeletingTemplateId(null); }
  }

  async function deleteFee(fee: FeeRule) {
    const confirmed = window.confirm(`Delete the fee rule for ${fee.registrationType || "all types"} / ${fee.jurisdictionCode || "all jurisdictions"}?`);
    if (!confirmed) return;
    try {
      setDeletingFeeId(fee.id); setError(null);
      const response = await fetch(`/api/v1/features/dmv/settings/fees?id=${encodeURIComponent(fee.id)}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete fee rule.");
      if (feeForm.id === fee.id) setFeeForm({ id: "", registrationType: "", jurisdictionCode: "NV", vehicleType: "", amount: "" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete fee rule.");
    } finally { setDeletingFeeId(null); }
  }

  function startTemplateEdit(template: RequirementTemplate) {
    setError(null);
    setTemplateForm({ id: template.id, code: template.code, name: template.name, appliesToType: template.appliesToType || "", isRequired: template.isRequired });
  }

  function cancelTemplateEdit() {
    setTemplateForm({ id: "", code: "", name: "", appliesToType: "", isRequired: true });
  }

  function startFeeEdit(fee: FeeRule) {
    setError(null);
    setFeeForm({ id: fee.id, registrationType: fee.registrationType || "", jurisdictionCode: fee.jurisdictionCode || "NV", vehicleType: fee.vehicleType || "", amount: String(fee.amount ?? "") });
  }

  function cancelFeeEdit() {
    setFeeForm({ id: "", registrationType: "", jurisdictionCode: "NV", vehicleType: "", amount: "" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <form onSubmit={saveTemplate}>
          <div className={tableStyles.card}>
            <div className={tableStyles.header}>
              <div className={tableStyles.title}>{templateForm.id ? "Edit requirement template" : "Add requirement template"}</div>
              {templateForm.id ? (
                <button type="button" onClick={cancelTemplateEdit} className={tableStyles.btn}>Cancel</button>
              ) : null}
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Code" value={templateForm.code} onChange={(e) => setTemplateForm((c) => ({ ...c, code: e.target.value }))} style={inputStyle} />
              <input placeholder="Name" value={templateForm.name} onChange={(e) => setTemplateForm((c) => ({ ...c, name: e.target.value }))} style={inputStyle} />
              <select value={templateForm.appliesToType} onChange={(e) => setTemplateForm((c) => ({ ...c, appliesToType: e.target.value }))} style={selectStyle}>
                <option value="">All registration types</option>
                <option value="NEVADA_ONLY">Nevada only</option>
                <option value="IRP">IRP</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--brl)", borderRadius: 8, fontSize: 13, color: "var(--b)" }}>
                <input type="checkbox" checked={templateForm.isRequired} onChange={(e) => setTemplateForm((c) => ({ ...c, isRequired: e.target.checked }))} />
                Required by default
              </label>
            </div>
            <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
              <button type="submit" disabled={saving} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : templateForm.id ? "Update requirement" : "Save requirement"}
              </button>
            </div>
          </div>
        </form>

        <form onSubmit={saveFee}>
          <div className={tableStyles.card}>
            <div className={tableStyles.header}>
              <div className={tableStyles.title}>{feeForm.id ? "Edit fee rule" : "Add fee rule"}</div>
              {feeForm.id ? (
                <button type="button" onClick={cancelFeeEdit} className={tableStyles.btn}>Cancel</button>
              ) : null}
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <select value={feeForm.registrationType} onChange={(e) => setFeeForm((c) => ({ ...c, registrationType: e.target.value }))} style={selectStyle}>
                <option value="">All registration types</option>
                <option value="NEVADA_ONLY">Nevada only</option>
                <option value="IRP">IRP</option>
              </select>
              <select value={feeForm.jurisdictionCode} onChange={(e) => setFeeForm((c) => ({ ...c, jurisdictionCode: e.target.value }))} style={selectStyle}>
                {jurisdictions.map((j) => (
                  <option key={j.code} value={j.code}>{j.code} - {j.name}</option>
                ))}
              </select>
              <select value={feeForm.vehicleType} onChange={(e) => setFeeForm((c) => ({ ...c, vehicleType: e.target.value }))} style={selectStyle}>
                <option value="">All vehicle types</option>
                <option value="TRACTOR">Tractor</option>
                <option value="STRAIGHT_TRUCK">Straight truck</option>
                <option value="SEMI_TRUCK">Semi truck</option>
                <option value="OTHER">Other</option>
              </select>
              <input placeholder="Amount" value={feeForm.amount} onChange={(e) => setFeeForm((c) => ({ ...c, amount: e.target.value }))} style={inputStyle} />
            </div>
            <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
              <button type="submit" disabled={saving} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : feeForm.id ? "Update fee rule" : "Save fee rule"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div className={tableStyles.title}>Requirement templates</div>
          <div className={tableStyles.subtitle}>{templates.length} template(s)</div>
        </div>
        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Type</th><th>Required</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td style={{ fontWeight: 600 }}>{template.code}</td>
                  <td className={tableStyles.muteCell}>{template.name}</td>
                  <td className={tableStyles.muteCell}>{template.appliesToType || "All"}</td>
                  <td className={tableStyles.muteCell}>{template.isRequired ? "Yes" : "Optional"}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button type="button" onClick={() => startTemplateEdit(template)} className={tableStyles.btn}>Edit</button>
                      <button type="button" onClick={() => void deleteTemplate(template)} disabled={deletingTemplateId === template.id} style={{ height: 30, padding: "0 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#b91c1c", opacity: deletingTemplateId === template.id ? 0.6 : 1 }}>
                        {deletingTemplateId === template.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div className={tableStyles.title}>Fee rules</div>
          <div className={tableStyles.subtitle}>{fees.length} rule(s)</div>
        </div>
        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Amount</th><th>Type</th><th>Jurisdiction</th><th>Vehicle</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <td style={{ fontWeight: 600 }}>${Number(fee.amount ?? 0).toFixed(2)}</td>
                  <td className={tableStyles.muteCell}>{fee.registrationType || "All types"}</td>
                  <td className={tableStyles.muteCell}>{fee.jurisdictionCode || "All"}</td>
                  <td className={tableStyles.muteCell}>{fee.vehicleType || "All"}</td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button type="button" onClick={() => startFeeEdit(fee)} className={tableStyles.btn}>Edit</button>
                      <button type="button" onClick={() => void deleteFee(fee)} disabled={deletingFeeId === fee.id} style={{ height: 30, padding: "0 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#b91c1c", opacity: deletingFeeId === fee.id ? 0.6 : 1 }}>
                        {deletingFeeId === fee.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
