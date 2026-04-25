"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

type ProcedureRow = {
  jurisdiction: string;
  name: string;
  countryCode: string;
  hasProcedure: boolean;
  title: string | null;
  portalUrl: string | null;
  filingMethod: string;
  paymentMethod: string;
  requiresPortalLogin: boolean;
  requiresClientCredential: boolean;
  supportsUpload: boolean;
  staffInstructions: { steps?: string[] } | null;
  checklist: unknown;
  isActive: boolean;
  updatedAt: string | null;
};

type ProcedureFormState = {
  jurisdiction: string;
  name: string;
  title: string;
  portalUrl: string;
  filingMethod: string;
  paymentMethod: string;
  requiresPortalLogin: boolean;
  requiresClientCredential: boolean;
  supportsUpload: boolean;
  isActive: boolean;
  staffInstructionsText: string;
  checklistText: string;
};

const filingMethodOptions = [
  { value: "MANUAL_PORTAL", label: "Manual Portal" },
  { value: "PDF_UPLOAD", label: "PDF Upload" },
  { value: "CSV_UPLOAD", label: "CSV Upload" },
  { value: "API", label: "API" },
];

const paymentMethodOptions = [
  { value: "ACH", label: "ACH" },
  { value: "CARD", label: "Card" },
  { value: "CHECK", label: "Check" },
  { value: "MANUAL", label: "Manual" },
  { value: "UNKNOWN", label: "Unknown" },
];

const controlStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  border: "1px solid var(--br)",
  borderRadius: 10,
  background: "var(--w)",
  color: "var(--b)",
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const helperStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
};

function linesToText(lines: unknown) {
  if (!Array.isArray(lines)) return "";
  return lines
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .join("\n");
}

function buildDefaultTitle(row: ProcedureRow) {
  return `${row.name} IFTA Manual Portal Filing`;
}

function toFormState(row: ProcedureRow): ProcedureFormState {
  return {
    jurisdiction: row.jurisdiction,
    name: row.name,
    title: row.title ?? buildDefaultTitle(row),
    portalUrl: row.portalUrl ?? "",
    filingMethod: row.filingMethod,
    paymentMethod: row.paymentMethod,
    requiresPortalLogin: row.requiresPortalLogin,
    requiresClientCredential: row.requiresClientCredential,
    supportsUpload: row.supportsUpload,
    isActive: row.hasProcedure ? row.isActive : true,
    staffInstructionsText: linesToText(row.staffInstructions?.steps),
    checklistText: linesToText(row.checklist),
  };
}

export default function IftaProcessSettingsPanel() {
  const [rows, setRows] = useState<ProcedureRow[]>([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("");
  const [form, setForm] = useState<ProcedureFormState | null>(null);
  const [initialForm, setInitialForm] = useState<ProcedureFormState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    const response = await fetch("/api/v1/admin/settings/ifta-process", {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as {
      rows?: ProcedureRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Could not load IFTA process settings.");
    }

    const nextRows = Array.isArray(data.rows) ? data.rows : [];
    setRows(nextRows);

    const currentSelection =
      nextRows.find((row) => row.jurisdiction === selectedJurisdiction)?.jurisdiction ??
      nextRows[0]?.jurisdiction ??
      "";

    setSelectedJurisdiction(currentSelection);
    const selected = nextRows.find((row) => row.jurisdiction === currentSelection) ?? null;
    const nextForm = selected ? toFormState(selected) : null;
    setForm(nextForm);
    setInitialForm(nextForm);
  }, [selectedJurisdiction]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadRows();
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not load IFTA process settings.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [loadRows]);

  useEffect(() => {
    const selected = rows.find((row) => row.jurisdiction === selectedJurisdiction) ?? null;
    const nextForm = selected ? toFormState(selected) : null;
    setForm(nextForm);
    setInitialForm(nextForm);
  }, [rows, selectedJurisdiction]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) =>
      [row.jurisdiction, row.name, row.countryCode, row.title ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [rows, searchQuery]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const selectedRow =
    rows.find((row) => row.jurisdiction === selectedJurisdiction) ?? null;

  const setField = <K extends keyof ProcedureFormState>(
    key: K,
    value: ProcedureFormState[K],
  ) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = async () => {
    if (!form) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `/api/v1/admin/settings/ifta-process/${form.jurisdiction}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            portalUrl: form.portalUrl,
            filingMethod: form.filingMethod,
            paymentMethod: form.paymentMethod,
            requiresPortalLogin: form.requiresPortalLogin,
            requiresClientCredential: form.requiresClientCredential,
            supportsUpload: form.supportsUpload,
            isActive: form.isActive,
            staffInstructions: form.staffInstructionsText
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            checklist: form.checklistText
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save IFTA process settings.");
      }

      await loadRows();
      setMessage(`Saved process instructions for ${form.jurisdiction}.`);
      window.setTimeout(() => setMessage(null), 2800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save IFTA process settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            padding: "10px 14px",
            fontSize: 13,
            color: "#15803d",
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        className={tableStyles.card}
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--b)" }}>
              IFTA Process
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#777" }}>
              Edit the staff `How to Proceed` instructions by base jurisdiction.
            </div>
          </div>

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search jurisdiction..."
            style={controlStyle}
          />

          <div
            style={{
              display: "grid",
              gap: 8,
              maxHeight: 620,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {filteredRows.map((row) => {
              const active = row.jurisdiction === selectedJurisdiction;
              return (
                <button
                  key={row.jurisdiction}
                  type="button"
                  onClick={() => setSelectedJurisdiction(row.jurisdiction)}
                  style={{
                    textAlign: "left",
                    borderRadius: 12,
                    border: active ? "1px solid #2563eb" : "1px solid var(--br)",
                    background: active ? "#eff6ff" : "white",
                    padding: "12px 14px",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <strong style={{ color: "var(--b)", fontSize: 13 }}>
                      {row.jurisdiction} - {row.name}
                    </strong>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: row.hasProcedure ? "#166534" : "#92400e",
                        background: row.hasProcedure ? "#dcfce7" : "#fef3c7",
                      }}
                    >
                      {row.hasProcedure ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#777" }}>
                    {row.title ?? "No procedure saved yet"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {loading ? (
            <div style={{ padding: 12, fontSize: 13, color: "#777" }}>
              Loading IFTA process settings...
            </div>
          ) : !form || !selectedRow ? (
            <div style={{ padding: 12, fontSize: 13, color: "#777" }}>
              Select a jurisdiction to edit its process instructions.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "start",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--b)" }}>
                    {form.jurisdiction} - {form.name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#777" }}>
                    Last updated: {selectedRow.updatedAt ? new Date(selectedRow.updatedAt).toLocaleString("en-US") : "Not saved yet"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(initialForm);
                      setError(null);
                    }}
                    disabled={!isDirty || saving}
                    className={tableStyles.btn}
                    style={{ opacity: !isDirty || saving ? 0.6 : 1 }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!isDirty || saving}
                    className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
                    style={{ opacity: !isDirty || saving ? 0.6 : 1 }}
                  >
                    {saving ? "Saving..." : "Save Process"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                <label style={labelStyle}>
                  <span style={helperStyle}>Title</span>
                  <input
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    style={controlStyle}
                  />
                </label>

                <label style={labelStyle}>
                  <span style={helperStyle}>Portal URL</span>
                  <input
                    value={form.portalUrl}
                    onChange={(event) => setField("portalUrl", event.target.value)}
                    placeholder="https://..."
                    style={controlStyle}
                  />
                </label>

                <label style={labelStyle}>
                  <span style={helperStyle}>Filing Method</span>
                  <select
                    value={form.filingMethod}
                    onChange={(event) => setField("filingMethod", event.target.value)}
                    style={controlStyle}
                  >
                    {filingMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={labelStyle}>
                  <span style={helperStyle}>Payment Method</span>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => setField("paymentMethod", event.target.value)}
                    style={controlStyle}
                  >
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                {[
                  ["requiresPortalLogin", "Requires portal login"],
                  ["requiresClientCredential", "Requires client credential"],
                  ["supportsUpload", "Supports upload"],
                  ["isActive", "Procedure active"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "1px solid var(--br)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 13,
                      color: "var(--b)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(form[key as keyof ProcedureFormState])}
                      onChange={(event) =>
                        setField(
                          key as keyof ProcedureFormState,
                          event.target.checked as never,
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                <label style={labelStyle}>
                  <span style={helperStyle}>How to Proceed</span>
                  <textarea
                    rows={12}
                    value={form.staffInstructionsText}
                    onChange={(event) =>
                      setField("staffInstructionsText", event.target.value)
                    }
                    style={{ ...controlStyle, minHeight: 280, resize: "vertical" }}
                    placeholder="One step per line"
                  />
                  <span style={helperStyle}>One instruction step per line.</span>
                </label>

                <label style={labelStyle}>
                  <span style={helperStyle}>Checklist</span>
                  <textarea
                    rows={12}
                    value={form.checklistText}
                    onChange={(event) => setField("checklistText", event.target.value)}
                    style={{ ...controlStyle, minHeight: 280, resize: "vertical" }}
                    placeholder="One checklist item per line"
                  />
                  <span style={helperStyle}>Optional checklist item per line.</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
