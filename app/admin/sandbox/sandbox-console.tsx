"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ScenarioItem = {
  key: string;
  name: string;
  description: string | null;
  moduleKey: string;
};

type DemoUserItem = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

type LogItem = {
  id: string;
  action: string;
  actorUserId: string;
  actingAsRole: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

type ActingContext = {
  isImpersonating: boolean;
  actingAsUserId: string | null;
  actingAsUserName: string | null;
  actingAsUserEmail: string | null;
  actingAsRole: string | null;
};

type SandboxConsoleProps = {
  actingContext: ActingContext;
  activeImpersonationCount: number;
  demoUsers: DemoUserItem[];
  lastReset: string | null;
  logs: LogItem[];
  scenarios: ScenarioItem[];
};

async function postJson(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
}

export default function SandboxConsole({
  actingContext,
  activeImpersonationCount,
  demoUsers,
  lastReset,
  logs,
  scenarios,
}: SandboxConsoleProps) {
  const router = useRouter();
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]?.key ?? "");
  const [selectedDemoUser, setSelectedDemoUser] = useState(
    actingContext.actingAsUserId ?? demoUsers[0]?.id ?? "",
  );
  const [actingAsRole, setActingAsRole] = useState(actingContext.actingAsRole ?? "");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenariosByModule = useMemo(() => {
    return scenarios.reduce<Record<string, ScenarioItem[]>>((accumulator, scenario) => {
      const key = scenario.moduleKey.toUpperCase();
      accumulator[key] ??= [];
      accumulator[key].push(scenario);
      return accumulator;
    }, {});
  }, [scenarios]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      await action();
      setMessage(successMessage);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected sandbox error");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Active environment
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">sandbox</p>
          <p className="mt-2 text-sm text-zinc-600">
            Isolated DB, storage, audit trail, and demo operators.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Last reset
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {lastReset ? new Date(lastReset).toLocaleString() : "Not yet"}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Reset is hard-locked to sandbox only.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Active impersonations
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
            {activeImpersonationCount}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            {actingContext.isImpersonating
              ? `Current session: ${actingContext.actingAsUserName ?? actingContext.actingAsRole ?? "demo"}`
              : "No active impersonation in this browser session."}
          </p>
        </div>
      </section>

      {(message || error) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Sandbox modules</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Open the live staff queues or jump into the client view for the active demo user.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-9">
              <Link
                href="/admin/sandbox/modules/ucr"
                className="rounded-2xl border px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Open UCR sandbox queue
              </Link>
              <Link
                href="/admin/sandbox/modules/ifta"
                className="rounded-2xl border px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Open IFTA sandbox queue
              </Link>
              <Link
                href="/admin/sandbox/modules/2290"
                className="rounded-2xl border px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Open 2290 sandbox queue
              </Link>
              <Link
                href="/admin/sandbox/modules/dmv"
                className="rounded-2xl border px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Open DMV sandbox queue
              </Link>
              <Link
                href="/admin/sandbox/view/ucr"
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  actingContext.isImpersonating
                    ? "text-zinc-900 hover:bg-zinc-50"
                    : "pointer-events-none text-zinc-400"
                }`}
              >
                Open UCR as demo user
              </Link>
              <Link
                href="/admin/sandbox/view/ifta"
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  actingContext.isImpersonating
                    ? "text-zinc-900 hover:bg-zinc-50"
                    : "pointer-events-none text-zinc-400"
                }`}
              >
                Open IFTA as demo user
              </Link>
              <Link
                href="/admin/sandbox/view/2290"
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  actingContext.isImpersonating
                    ? "text-zinc-900 hover:bg-zinc-50"
                    : "pointer-events-none text-zinc-400"
                }`}
              >
                Open 2290 as demo user
              </Link>
              <Link
                href="/admin/sandbox/view/documents"
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  actingContext.isImpersonating
                    ? "text-zinc-900 hover:bg-zinc-50"
                    : "pointer-events-none text-zinc-400"
                }`}
              >
                Open Documents as demo user
              </Link>
              <Link
                href="/admin/sandbox/view/dmv"
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  actingContext.isImpersonating
                    ? "text-zinc-900 hover:bg-zinc-50"
                    : "pointer-events-none text-zinc-400"
                }`}
              >
                Open DMV as demo user
              </Link>
            </div>
            {!actingContext.isImpersonating && (
              <p className="mt-3 text-xs text-zinc-500">
                Start impersonation first to unlock the client-side sandbox journeys.
              </p>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Scenarios</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Seed deterministic demo data for long-form QA and demos.
                </p>
              </div>
              <button
                type="button"
                disabled={isPending || !selectedScenario}
                onClick={() =>
                  runAction(
                    () => postJson("/api/v1/sandbox/scenarios/load", { scenarioKey: selectedScenario }),
                    "Scenario loaded successfully.",
                  )
                }
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Load scenario
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Scenario
                </label>
                <select
                  value={selectedScenario}
                  onChange={(event) => setSelectedScenario(event.target.value)}
                  className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                >
                  {scenarios.map((scenario) => (
                    <option key={scenario.key} value={scenario.key}>
                      {scenario.moduleKey.toUpperCase()} - {scenario.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Reset sandbox
                </label>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(
                      () => postJson("/api/v1/sandbox/reset"),
                      "Sandbox reset and base seed completed.",
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset sandbox
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Object.entries(scenariosByModule).map(([moduleKey, items]) => (
                <div key={moduleKey} className="rounded-2xl border bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {moduleKey}
                  </p>
                  <div className="mt-3 space-y-3">
                    {items.map((scenario) => (
                      <div key={scenario.key}>
                        <p className="text-sm font-medium text-zinc-900">{scenario.name}</p>
                        <p className="text-sm text-zinc-600">
                          {scenario.description ?? "No description yet."}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Audit log</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Recent sandbox actions across reset, scenario load, and impersonation.
            </p>

            <div className="mt-5 overflow-hidden rounded-2xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{log.action}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {log.entityType ?? "n/a"}
                        {log.entityId ? ` / ${log.entityId}` : ""}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {log.actingAsRole ? `${log.actorUserId} as ${log.actingAsRole}` : log.actorUserId}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                        No sandbox logs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Impersonation</h2>
          <p className="mt-1 text-sm text-zinc-600">
            View the sandbox through a demo operator or client lens.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Demo user
              </label>
              <select
                value={selectedDemoUser}
                onChange={(event) => setSelectedDemoUser(event.target.value)}
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              >
                {demoUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Acting as role
              </label>
              <input
                value={actingAsRole}
                onChange={(event) => setActingAsRole(event.target.value)}
                placeholder="TRUCKER, STAFF, CLIENT"
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={isPending || !selectedDemoUser}
                onClick={() =>
                  runAction(
                    () =>
                      postJson("/api/v1/sandbox/impersonation/start", {
                        actingAsUserId: selectedDemoUser,
                        actingAsRole: actingAsRole || null,
                      }),
                    "Sandbox impersonation started.",
                  )
                }
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start impersonation
              </button>
              <button
                type="button"
                disabled={isPending || !actingContext.isImpersonating}
                onClick={() =>
                  runAction(
                    () => postJson("/api/v1/sandbox/impersonation/stop"),
                    "Sandbox impersonation ended.",
                  )
                }
                className="rounded-xl border px-4 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop impersonation
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Current context
            </p>
            <p className="mt-2 text-sm text-zinc-900">
              {actingContext.isImpersonating
                ? `${actingContext.actingAsUserName ?? actingContext.actingAsUserEmail ?? "Demo user"}`
                : "No impersonation session active."}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              {actingContext.isImpersonating
                ? `Role: ${actingContext.actingAsRole ?? "not specified"}`
                : "Actions will be audited with the real internal operator."}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {demoUsers.map((user) => (
              <div key={user.id} className="rounded-2xl border p-4">
                <p className="text-sm font-medium text-zinc-900">{user.name}</p>
                <p className="text-sm text-zinc-600">{user.email}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">
                  {user.roles.join(", ") || "No roles"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
