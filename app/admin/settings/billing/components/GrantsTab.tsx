"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  Field,
  InlineAlert,
  PanelCard,
  StatusBadge,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";
import type { BillingGrantsPayload } from "./types";

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
    const payload = (await response.json().catch(() => ({}))) as BillingGrantsPayload & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "Could not load grants.");
    }
    onChanged(payload);
  };

  const createGrant = async () => {
    try {
      setSubmitting(true);
      setError("");
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
      if (!response.ok) {
        throw new Error(payload.error || "Could not create grant.");
      }

      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create grant.");
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (id: string, kind: string) => {
    try {
      setError("");
      const response = await fetch(`/api/v1/admin/billing/grants/${id}?kind=${kind}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not revoke grant.");
      }

      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Could not revoke grant.");
    }
  };

  return (
    <PanelCard
      eyebrow="Grants"
      title="Manual entitlements"
      description="Gift full plans or single modules. Grants bypass provider coupling and keep access centered on your entitlement engine."
    >
      <div className="space-y-6">
        {error ? <InlineAlert tone="error" message={error} /> : null}

        {!grants ? <div className="text-sm text-zinc-500">Loading grants...</div> : null}

        {grants ? (
          <>
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Organization">
                  <select
                    value={draft.organizationId}
                    onChange={(event) => setDraft((current) => ({ ...current, organizationId: event.target.value }))}
                    className={textInputClassName()}
                  >
                    {grants.organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Grant Type">
                  <select
                    value={draft.grantKind}
                    onChange={(event) => setDraft((current) => ({ ...current, grantKind: event.target.value }))}
                    className={textInputClassName()}
                  >
                    <option value="module">module</option>
                    <option value="plan">plan</option>
                  </select>
                </Field>
                {draft.grantKind === "plan" ? (
                  <Field label="Plan">
                    <select
                      value={draft.planId}
                      onChange={(event) => setDraft((current) => ({ ...current, planId: event.target.value }))}
                      className={textInputClassName()}
                    >
                      {grants.plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Module">
                    <select
                      value={draft.moduleId}
                      onChange={(event) => setDraft((current) => ({ ...current, moduleId: event.target.value }))}
                      className={textInputClassName()}
                    >
                      {grants.modules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {module.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label={draft.grantKind === "plan" ? "Gift Note" : "Source"}>
                  <input
                    value={draft.grantKind === "plan" ? draft.giftNote : draft.source}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [draft.grantKind === "plan" ? "giftNote" : "source"]: event.target.value,
                      }))
                    }
                    className={textInputClassName()}
                  />
                </Field>
                <Field label="Starts At">
                  <input
                    type="datetime-local"
                    value={draft.startsAt}
                    onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))}
                    className={textInputClassName()}
                  />
                </Field>
                <Field label="Ends At">
                  <input
                    type="datetime-local"
                    value={draft.endsAt}
                    onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))}
                    className={textInputClassName()}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={createGrant}
                disabled={submitting}
                className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {submitting ? "Saving..." : `Create ${draft.grantKind} grant`}
              </button>
            </div>

            {grants.planGrants.length === 0 && grants.moduleGrants.length === 0 ? (
              <EmptyState
                title="No grants yet"
                description="Manual entitlements will appear here once you gift a full plan or override access to a specific module."
              />
            ) : null}

            <div className="space-y-5">
              {grants.planGrants.map((grant) => (
                <article
                  key={grant.id}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-zinc-950">
                      {grant.organization.name} {"->"} {grant.plan?.name ?? "Deleted plan"}
                    </h3>
                    <StatusBadge tone={grant.active ? "green" : "amber"}>
                      {grant.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    {grant.giftNote || "Manual gifted plan access"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void revoke(grant.id, "plan")}
                    className="mt-4 rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Revoke plan grant
                  </button>
                </article>
              ))}

              {grants.moduleGrants.map((grant) => (
                <article
                  key={grant.id}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-zinc-950">
                      {grant.organization.name} {"->"} {grant.module.name}
                    </h3>
                    <StatusBadge tone={grant.active ? "green" : "amber"}>
                      {grant.active ? "Active" : "Inactive"}
                    </StatusBadge>
                    <StatusBadge tone="blue">{grant.source}</StatusBadge>
                  </div>
                  <button
                    type="button"
                    onClick={() => void revoke(grant.id, "module")}
                    className="mt-4 rounded-2xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Revoke module grant
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </PanelCard>
  );
}
