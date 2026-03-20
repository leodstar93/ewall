"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  canActivateRegistration,
  canApproveRegistration,
  canMarkRegistrationReady,
  canRejectRegistration,
  canSubmitRegistration,
  formatDate,
  registrationStatusClasses,
  registrationStatusLabel,
  registrationTypeLabel,
} from "@/features/dmv/shared";

type QueueRegistration = {
  id: string;
  truckId: string;
  registrationType: "NEVADA_ONLY" | "IRP";
  status:
    | "UNDER_REVIEW"
    | "READY_FOR_FILING"
    | "CORRECTION_REQUIRED"
    | "SUBMITTED"
    | "DRAFT"
    | "WAITING_CLIENT_DOCS"
    | "APPROVED"
    | "ACTIVE"
    | "EXPIRED"
    | "REJECTED"
    | "CANCELLED";
  expirationDate: string | null;
  truck: {
    unitNumber: string;
  };
};

type ActivityItem = {
  id: string;
  action: string;
  message: string | null;
  createdAt: string;
  metadataJson: unknown;
  registration: {
    id: string;
    truck: {
      id: string;
      unitNumber: string;
      vin: string | null;
    };
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  } | null;
  renewal: {
    id: string;
    cycleYear: number;
    dueDate: string;
  } | null;
};

type ActivityPayload = {
  activities?: ActivityItem[];
  summary?: Record<string, number>;
  error?: string;
};

type CronRunResult = {
  now: string;
  registrationsChecked: number;
  renewalsChecked: number;
  renewalsOpened: number;
  renewalsActivated: number;
  renewalsOverdue: number;
  registrationsExpired: number;
  alertsLogged: number;
  skippedInactiveTrucks: number;
};

function actionLabel(action: string) {
  switch (action) {
    case "RENEWAL_AUTO_OPENED":
      return "Renewal auto-opened";
    case "RENEWAL_AUTO_OVERDUE":
      return "Renewal overdue";
    case "REGISTRATION_AUTO_EXPIRED":
      return "Registration expired";
    case "RENEWAL_ALERT_DUE":
      return "Renewal alert triggered";
    case "EMAIL_NOTIFICATION_SENT":
      return "Email sent";
    case "EMAIL_NOTIFICATION_FAILED":
      return "Email failed";
    default:
      return action.toLowerCase().replaceAll("_", " ");
  }
}

export default function DmvAdminQueuePage() {
  const [registrations, setRegistrations] = useState<QueueRegistration[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitySummary, setActivitySummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronMessage, setCronMessage] = useState<string | null>(null);
  const [cronResult, setCronResult] = useState<CronRunResult | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [registrationsResponse, activityResponse] = await Promise.all([
        fetch("/api/v1/features/dmv/registrations", { cache: "no-store" }),
        fetch("/api/v1/features/dmv/activity?mode=system&limit=20", { cache: "no-store" }),
      ]);

      const data = (await registrationsResponse.json().catch(() => ({}))) as {
        registrations?: QueueRegistration[];
        error?: string;
      };
      const activityData = (await activityResponse.json().catch(() => ({}))) as ActivityPayload;

      if (!registrationsResponse.ok) {
        throw new Error(data.error || "Could not load DMV queue.");
      }
      if (!activityResponse.ok) {
        throw new Error(activityData.error || "Could not load DMV system activity.");
      }
      setRegistrations(Array.isArray(data.registrations) ? data.registrations : []);
      setActivities(Array.isArray(activityData.activities) ? activityData.activities : []);
      setActivitySummary(activityData.summary ?? {});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DMV queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const queue = useMemo(
    () =>
      registrations.filter((registration) =>
        [
          "UNDER_REVIEW",
          "READY_FOR_FILING",
          "SUBMITTED",
          "APPROVED",
        ].includes(registration.status),
      ),
    [registrations],
  );

  async function transition(
    id: string,
    endpoint: "ready" | "submit" | "approve" | "reject",
    options?: { activate?: boolean },
  ) {
    try {
      setBusyId(id);
      const response = await fetch(`/api/v1/features/dmv/registrations/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "DMV action failed.");
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "DMV action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function runCronNow() {
    try {
      setCronRunning(true);
      setError(null);
      setCronMessage(null);

      const response = await fetch("/api/v1/features/dmv/cron", {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: CronRunResult;
      };

      if (!response.ok || !data.result) {
        throw new Error(data.error || "Could not run DMV cron.");
      }

      setCronResult(data.result);
      setCronMessage("DMV cron completed successfully.");
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not run DMV cron.");
    } finally {
      setCronRunning(false);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading DMV queue...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#eff6ff,_#ffffff_45%,_#ffedd5)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Staff Review Screen
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Internal DMV review queue
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
          Review registrations, request corrections, mark cases ready for filing, and finalize
          staff approval once the DMV result comes back.
        </p>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Alerts in 7 days", value: activitySummary.RENEWAL_ALERT_DUE ?? 0 },
          { label: "Auto-opened", value: activitySummary.RENEWAL_AUTO_OPENED ?? 0 },
          { label: "Overdue", value: activitySummary.RENEWAL_AUTO_OVERDUE ?? 0 },
          { label: "Emails sent", value: activitySummary.EMAIL_NOTIFICATION_SENT ?? 0 },
          { label: "Email failures", value: activitySummary.EMAIL_NOTIFICATION_FAILED ?? 0 },
        ].map((card) => (
          <article key={card.label} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-zinc-950">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Manual Automation
            </p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-950">
              Run the DMV cron now
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              This triggers the same daily DMV automation used by Vercel: renewals, overdue checks, expiration updates, and alerts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runCronNow()}
            disabled={cronRunning}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {cronRunning ? "Running cron..." : "Run DMV cron now"}
          </button>
        </div>

        {cronMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {cronMessage}
          </div>
        ) : null}

        {cronResult ? (
          <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Renewals opened", value: cronResult.renewalsOpened },
              { label: "Renewals activated", value: cronResult.renewalsActivated },
              { label: "Renewals overdue", value: cronResult.renewalsOverdue },
              { label: "Registrations expired", value: cronResult.registrationsExpired },
              { label: "Alerts logged", value: cronResult.alertsLogged },
              { label: "Inactive trucks skipped", value: cronResult.skippedInactiveTrucks },
              { label: "Registrations checked", value: cronResult.registrationsChecked },
              { label: "Renewals checked", value: cronResult.renewalsChecked },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="pb-3 font-medium">Unit</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Expiration</th>
                <th className="pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {queue.map((registration) => (
                <tr key={registration.id}>
                  <td className="py-4 font-medium text-zinc-900">
                    <Link href={`/admin/features/dmv/${registration.truckId}`} className="hover:text-sky-700">
                      {registration.truck.unitNumber}
                    </Link>
                  </td>
                  <td className="py-4 text-zinc-600">{registrationTypeLabel(registration.registrationType)}</td>
                  <td className="py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${registrationStatusClasses(registration.status)}`}>
                      {registrationStatusLabel(registration.status)}
                    </span>
                  </td>
                  <td className="py-4 text-zinc-600">{formatDate(registration.expirationDate)}</td>
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      {canMarkRegistrationReady(registration.status) ? (
                        <button onClick={() => transition(registration.id, "ready")} disabled={busyId === registration.id} className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                          Ready
                        </button>
                      ) : null}
                      {canSubmitRegistration(registration.status) ? (
                        <button onClick={() => transition(registration.id, "submit")} disabled={busyId === registration.id} className="rounded-xl border border-sky-300 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                          Submit
                        </button>
                      ) : null}
                      {canApproveRegistration(registration.status) ? (
                        <button onClick={() => transition(registration.id, "approve")} disabled={busyId === registration.id} className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
                          Approve
                        </button>
                      ) : null}
                      {canActivateRegistration(registration.status) ? (
                        <button onClick={() => transition(registration.id, "approve", { activate: true })} disabled={busyId === registration.id} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
                          Activate
                        </button>
                      ) : null}
                      {canRejectRegistration(registration.status) ? (
                        <button onClick={() => transition(registration.id, "reject")} disabled={busyId === registration.id} className="rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Reject
                        </button>
                      ) : null}
                      <Link href={`/admin/features/dmv/${registration.truckId}`} className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
                        Open
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    No DMV cases are waiting in the staff queue.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Cron Activity
            </p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-950">
              Recent alerts, automation, and email delivery
            </h3>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="rounded-2xl border border-zinc-200 px-4 py-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {actionLabel(activity.action)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Unit {activity.registration?.truck.unitNumber || "unknown"}
                    {activity.renewal ? ` - renewal ${activity.renewal.cycleYear}` : ""}
                  </p>
                  {activity.message ? (
                    <p className="mt-1 text-sm text-zinc-500">{activity.message}</p>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
              No DMV automation activity yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
