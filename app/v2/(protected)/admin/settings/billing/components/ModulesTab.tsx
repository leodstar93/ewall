"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { BillingModuleRecord } from "./types";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  color: "var(--b)",
};

export function ModulesTab({
  modules,
  onChanged,
}: {
  modules: BillingModuleRecord[];
  onChanged: (modules: BillingModuleRecord[]) => void;
}) {
  const [items, setItems] = useState(modules);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(modules);
  }, [modules]);

  const refresh = async () => {
    const response = await fetch("/api/v1/admin/billing/modules", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as BillingModuleRecord[] & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error((payload as { error?: string }).error || "Could not reload modules.");
    }
    onChanged(payload as BillingModuleRecord[]);
  };

  const saveModule = async (module: BillingModuleRecord) => {
    try {
      setError("");
      const response = await fetch(`/api/v1/admin/billing/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: module.name,
          description: module.description,
          isActive: module.isActive,
          requiresSubscription: module.requiresSubscription,
          isCore: module.isCore,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save module.");
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save module.");
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

      {items.map((module) => (
        <div key={module.id} className={tableStyles.card}>
          <div className={tableStyles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className={tableStyles.title}>{module.name}</div>
              <Badge tone={module.isActive ? "success" : "warning"} variant="light">
                {module.isActive ? "Active" : "Inactive"}
              </Badge>
              {module.requiresSubscription ? (
                <Badge tone="info" variant="light">Premium</Badge>
              ) : null}
              {module.isCore ? (
                <Badge tone="dark" variant="light">Core</Badge>
              ) : null}
            </div>
          </div>

          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
                  Name
                </span>
                <input
                  value={module.name}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item) =>
                        item.id === module.id ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
                  Description
                </span>
                <input
                  value={module.description}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item) =>
                        item.id === module.id ? { ...item, description: event.target.value } : item,
                      ),
                    )
                  }
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                ["Active", "isActive"],
                ["Requires subscription", "requiresSubscription"],
                ["Core module", "isCore"],
              ].map(([label, key]) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    border: "1px solid var(--brl)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(module[key as keyof BillingModuleRecord])}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((item) =>
                          item.id === module.id
                            ? { ...item, [key]: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                  <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div
            className={tableStyles.header}
            style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}
          >
            <button
              type="button"
              onClick={() => void saveModule(module)}
              className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
            >
              Save module
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
