"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { BillingGrantsPayload } from "./types";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#aaa" }}>
      {children}
    </span>
  );
}

export function GrantsTab({
  grants,
  onChanged,
}: {
  grants: BillingGrantsPayload | null;
  onChanged: (payload: BillingGrantsPayload) => void;
}) {
  const [draft, setDraft] = useState({
    organizationId: "",
    grantKind: "module",
    planId: "",
    moduleId: "",
    source: "gift",
    startsAt: "",
    endsAt: "",
    giftNote: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!grants) return;
    setDraft((current) => ({
      ...current,
      organizationId: current.organizationId || grants.organizations[0]?.id || "",
      planId: current.planId || grants.plans[0]?.id || "",
      moduleId: current.moduleId || grants.modules[0]?.id || "",
    }));
  }, [grants]);

  const refresh = async () => {
    const response = await fetch("/api/v1/admin/billing/grants", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as BillingGrantsPayload & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load grants.");
    onChanged(payload);
  };

  const createGrant = async () => {
    try {
      setSubmitting(true); setError("");
      const response = await fetch("/api/v1/admin/billing/grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: draft.organizationId,
          planId: draft.grantKind === "plan" ? draft.planId : undefined,
          moduleId: draft.grantKind === "module" ? draft.moduleId : undefined,
          source: draft.grantKind === "module" ? draft.source : undefined,
          startsAt: draft.startsAt || undefined,
          endsAt: draft.endsAt || undefined,
          giftNote: draft.grantKind === "plan" ? draft.giftNote : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create grant.");
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create grant.");
    } finally { setSubmitting(false); }
  };

  const revoke = async (id: string, kind: string) => {
    try {
      setError("");
      const response = await fetch(`/api/v1/admin/billing/grants/${id}?kind=${kind}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not revoke grant.");
      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Could not revoke grant.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.subtitle}>Grants</div>
            <div className={tableStyles.title}>Manual entitlements</div>
          </div>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {error ? (
            <div style={{ borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div>
          ) : null}

          {!grants ? <div style={{ fontSize: 13, color: "#aaa" }}>Loading grants...</div> : null}

          {grants ? (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, 1fr)" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Organization</FieldLabel>
                <select value={draft.organizationId} onChange={(e) => setDraft((c) => ({ ...c, organizationId: e.target.value }))} style={selectStyle}>
                  {grants.organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Grant type</FieldLabel>
                <select value={draft.grantKind} onChange={(e) => setDraft((c) => ({ ...c, grantKind: e.target.value }))} style={selectStyle}>
                  <option value="module">module</option>
                  <option value="plan">plan</option>
                </select>
              </label>
              {draft.grantKind === "plan" ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <FieldLabel>Plan</FieldLabel>
                  <select value={draft.planId} onChange={(e) => setDraft((c) => ({ ...c, planId: e.target.value }))} style={selectStyle}>
                    {grants.plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <FieldLabel>Module</FieldLabel>
                  <select value={draft.moduleId} onChange={(e) => setDraft((c) => ({ ...c, moduleId: e.target.value }))} style={selectStyle}>
                    {grants.modules.map((module) => (
                      <option key={module.id} value={module.id}>{module.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>{draft.grantKind === "plan" ? "Gift note" : "Source"}</FieldLabel>
                <input
                  value={draft.grantKind === "plan" ? draft.giftNote : draft.source}
                  onChange={(e) => setDraft((c) => ({ ...c, [draft.grantKind === "plan" ? "giftNote" : "source"]: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Starts at</FieldLabel>
                <input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft((c) => ({ ...c, startsAt: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <FieldLabel>Ends at</FieldLabel>
                <input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft((c) => ({ ...c, endsAt: e.target.value }))} style={inputStyle} />
              </label>
            </div>
          ) : null}
        </div>

        {grants ? (
          <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => void createGrant()} disabled={submitting} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} style={{ opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Saving..." : `Create ${draft.grantKind} grant`}
            </button>
          </div>
        ) : null}
      </div>

      {grants && grants.planGrants.length === 0 && grants.moduleGrants.length === 0 ? (
        <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>
          No grants yet. Manual entitlements will appear here once you gift a full plan or override access to a specific module.
        </div>
      ) : null}

      {grants?.planGrants.map((grant) => (
        <div key={grant.id} className={tableStyles.card}>
          <div className={tableStyles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className={tableStyles.title}>{grant.organization.name} → {grant.plan?.name ?? "Deleted plan"}</div>
              <Badge tone={grant.active ? "success" : "warning"} variant="light">{grant.status}</Badge>
            </div>
          </div>
          <div style={{ padding: "12px 20px", fontSize: 13, color: "#777" }}>{grant.giftNote || "Manual gifted plan access"}</div>
          <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => void revoke(grant.id, "plan")} style={{ height: 30, padding: "0 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#b91c1c" }}>
              Revoke plan grant
            </button>
          </div>
        </div>
      ))}

      {grants?.moduleGrants.map((grant) => (
        <div key={grant.id} className={tableStyles.card}>
          <div className={tableStyles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div className={tableStyles.title}>{grant.organization.name} → {grant.module.name}</div>
              <Badge tone={grant.active ? "success" : "warning"} variant="light">{grant.active ? "Active" : "Inactive"}</Badge>
              <Badge tone="info" variant="light">{grant.source}</Badge>
            </div>
          </div>
          <div className={tableStyles.header} style={{ borderBottom: "none", borderTop: "1px solid var(--brl)", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => void revoke(grant.id, "module")} style={{ height: 30, padding: "0 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#b91c1c" }}>
              Revoke module grant
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
