"use client";

import { useEffect, useState } from "react";
import {
  InlineAlert,
  PanelCard,
  StatusBadge,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";
import type { BillingModuleRecord } from "./types";

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
      if (!response.ok) {
        throw new Error(payload.error || "Could not save module.");
      }

      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save module.");
    }
  };

  return (
    <PanelCard
      eyebrow="Modules"
      title="Module billing catalog"
      description="Control module activation, premium flags, and core designation. Entitlements always resolve from this catalog instead of plan names."
    >
      <div className="space-y-5">
        {error ? <InlineAlert tone="error" message={error} /> : null}

        {items.map((module) => (
          <article
            key={module.id}
            className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-zinc-950">{module.name}</h3>
              <StatusBadge tone={module.isActive ? "green" : "amber"}>
                {module.isActive ? "Active" : "Inactive"}
              </StatusBadge>
              {module.requiresSubscription ? (
                <StatusBadge tone="blue">Premium</StatusBadge>
              ) : null}
              {module.isCore ? <StatusBadge tone="zinc">Core</StatusBadge> : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Name
                </div>
                <input
                  value={module.name}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item) =>
                        item.id === module.id ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  className={`${textInputClassName()} mt-2`}
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Description
                </div>
                <input
                  value={module.description}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item) =>
                        item.id === module.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className={`${textInputClassName()} mt-2`}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-4">
              {[
                ["Active", "isActive"],
                ["Requires subscription", "requiresSubscription"],
                ["Core module", "isCore"],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
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
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span className="text-sm font-medium text-zinc-800">{label}</span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void saveModule(module)}
              className="mt-5 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Save module
            </button>
          </article>
        ))}
      </div>
    </PanelCard>
  );
}
