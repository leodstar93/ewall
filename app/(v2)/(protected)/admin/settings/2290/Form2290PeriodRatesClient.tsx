"use client";

import { useEffect, useMemo, useState } from "react";
import Table, {
  type ColumnDef,
  type TableAction,
} from "@/app/(v2)/(protected)/admin/components/ui/Table";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";
import {
  formatCentsAsDollars,
  formatWeightRange,
  type Form2290RateRow,
} from "@/features/form2290/shared";

type RatesPayload = { rates?: Form2290RateRow[]; error?: string };

type Draft = {
  category: string;
  weightMin: string;
  weightMax: string;
  annualCents: string;
  sortOrder: string;
};

const emptyDraft: Draft = {
  category: "",
  weightMin: "",
  weightMax: "",
  annualCents: "",
  sortOrder: "",
};

const CATEGORIES = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V"];

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

const labelStyle: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 10,
  letterSpacing: "0.1em",
};

function formatThousands(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

function stripFormatting(value: string): string {
  return value.replace(/,/g, "");
}

export default function Form2290PeriodRatesClient({
  taxPeriodId,
}: {
  taxPeriodId: string;
}) {
  const [rates, setRates] = useState<Form2290RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Record<string, Form2290RateRow>>({});

  const base = `/api/v1/settings/2290/tax-periods/${taxPeriodId}/rates`;

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(base, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as RatesPayload;
      if (!res.ok) throw new Error(data.error ?? "Could not load rates.");
      setRates(Array.isArray(data.rates) ? data.rates : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [taxPeriodId]);

  async function handleAdd() {
    if (!adding) return;
    try {
      setBusy("add");
      setError(null);
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: adding.category.trim(),
          weightMin: Number(adding.weightMin),
          weightMax: adding.weightMax ? Number(adding.weightMax) : null,
          annualCents: Number(adding.annualCents),
          sortOrder: adding.sortOrder ? Number(adding.sortOrder) : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add rate.");
      setAdding(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add rate.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(rateId: string) {
    const draft = editing[rateId];
    if (!draft) return;
    try {
      setBusy(`save-${rateId}`);
      setError(null);
      const res = await fetch(`${base}/${rateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: draft.category,
          weightMin: draft.weightMin,
          weightMax: draft.weightMax,
          annualCents: draft.annualCents,
          sortOrder: draft.sortOrder,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setEditing((prev) => {
        const next = { ...prev };
        delete next[rateId];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(rateId: string) {
    try {
      setBusy(`del-${rateId}`);
      setError(null);
      const res = await fetch(`${base}/${rateId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(null);
    }
  }

  const columns = useMemo<ColumnDef<Form2290RateRow>[]>(
    () => [
      {
        key: "category",
        label: "Cat.",
        render: (_v, rate) => {
          const draft = editing[rate.id];
          if (draft)
            return (
              <input
                value={draft.category}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, [rate.id]: { ...draft, category: e.target.value } }))
                }
                style={{ ...inputStyle, width: 56 }}
              />
            );
          return <strong>{rate.category}</strong>;
        },
      },
      {
        key: "weightMin",
        label: "Weight range",
        sortable: false,
        render: (_v, rate) => {
          const draft = editing[rate.id];
          if (draft)
            return (
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="number"
                  value={draft.weightMin}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, [rate.id]: { ...draft, weightMin: Number(e.target.value) } }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
                <input
                  type="number"
                  value={draft.weightMax ?? ""}
                  placeholder="max"
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      [rate.id]: { ...draft, weightMax: e.target.value ? Number(e.target.value) : null },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </div>
            );
          return formatWeightRange(rate.weightMin, rate.weightMax);
        },
      },
      {
        key: "annualCents",
        label: "Annual tax",
        render: (_v, rate) => {
          const draft = editing[rate.id];
          if (draft)
            return (
              <input
                type="number"
                value={draft.annualCents}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, [rate.id]: { ...draft, annualCents: Number(e.target.value) } }))
                }
                style={{ ...inputStyle, width: 100 }}
              />
            );
          return formatCentsAsDollars(rate.annualCents);
        },
      },
      {
        key: "sortOrder",
        label: "Sort",
        render: (_v, rate) => {
          const draft = editing[rate.id];
          if (draft)
            return (
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(e) =>
                  setEditing((p) => ({ ...p, [rate.id]: { ...draft, sortOrder: Number(e.target.value) } }))
                }
                style={{ ...inputStyle, width: 56 }}
              />
            );
          return rate.sortOrder;
        },
      },
      {
        key: "id",
        label: "",
        sortable: false,
        render: (_v, rate) => {
          const draft = editing[rate.id];
          if (draft)
            return (
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={busy === `save-${rate.id}`}
                  onClick={() => void handleSave(rate.id)}
                  className={tableStyles.btn}
                  style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a", opacity: busy === `save-${rate.id}` ? 0.6 : 1 }}
                >
                  {busy === `save-${rate.id}` ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((p) => { const n = { ...p }; delete n[rate.id]; return n; })}
                  className={tableStyles.btn}
                  style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                >
                  Cancel
                </button>
              </div>
            );
          return (
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setEditing((p) => ({ ...p, [rate.id]: { ...rate } }))}
                className={tableStyles.btn}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy === `del-${rate.id}`}
                onClick={() => void handleDelete(rate.id)}
                className={tableStyles.btn}
                style={{ borderColor: "#fecaca", color: "#b91c1c", opacity: busy === `del-${rate.id}` ? 0.6 : 1 }}
              >
                {busy === `del-${rate.id}` ? "..." : "×"}
              </button>
            </div>
          );
        },
      },
    ],
    [editing, busy],
  );

  const actions = useMemo<TableAction[]>(
    () => [
      {
        label: adding ? "Cancel" : "+ Add rate",
        onClick: () => setAdding((a) => (a ? null : { ...emptyDraft })),
        variant: adding ? "default" : "primary",
        style: adding
          ? undefined
          : { background: "#2563eb", color: "#fff", borderColor: "#2563eb" },
      },
    ],
    [adding],
  );

  const toolbar = adding ? (
    <div
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns:
          "minmax(80px, 0.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(80px, 0.4fr) auto",
        alignItems: "end",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={tableStyles.subtitle} style={labelStyle}>Category</span>
        <select
          value={adding.category}
          onChange={(e) => setAdding((a) => (a ? { ...a, category: e.target.value } : a))}
          style={{ ...inputStyle, background: "#fff" }}
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={tableStyles.subtitle} style={labelStyle}>Weight min</span>
        <input
          type="number"
          value={adding.weightMin}
          onChange={(e) => setAdding((a) => (a ? { ...a, weightMin: e.target.value } : a))}
          style={inputStyle}
          placeholder="0"
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={tableStyles.subtitle} style={labelStyle}>Weight max</span>
        <input
          type="number"
          value={adding.weightMax}
          onChange={(e) => setAdding((a) => (a ? { ...a, weightMax: e.target.value } : a))}
          style={inputStyle}
          placeholder="optional"
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={tableStyles.subtitle} style={labelStyle}>Annual (cents)</span>
        <input
          type="text"
          inputMode="decimal"
          value={formatThousands(adding.annualCents)}
          onChange={(e) => {
            const raw = stripFormatting(e.target.value);
            if (/^\d*\.?\d*$/.test(raw))
              setAdding((a) => (a ? { ...a, annualCents: raw } : a));
          }}
          style={inputStyle}
          placeholder="0"
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className={tableStyles.subtitle} style={labelStyle}>Sort</span>
        <input
          type="number"
          value={adding.sortOrder}
          onChange={(e) => setAdding((a) => (a ? { ...a, sortOrder: e.target.value } : a))}
          style={inputStyle}
          placeholder="0"
        />
      </label>

      <button
        type="button"
        disabled={busy === "add"}
        onClick={() => void handleAdd()}
        className={tableStyles.btn}
        style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a", opacity: busy === "add" ? 0.6 : 1, alignSelf: "flex-end" }}
      >
        {busy === "add" ? "Adding..." : "Add"}
      </button>
    </div>
  ) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

      <Table
        data={loading ? [] : rates}
        columns={columns}
        title="Tax rate table"
        actions={actions}
        toolbar={toolbar}
        searchKeys={["category"]}
      />
    </div>
  );
}
