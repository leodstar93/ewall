"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";

interface StatCard {
  title: string;
  value: string;
  icon: string;
  tone: "blue" | "green" | "purple" | "orange" | "zinc";
  href?: string;
}

type UcrStatusCard = {
  filingYear: number;
  filingId: string | null;
  workflowLabel: string;
  complianceStatus: "COMPLIANT" | "IN_PROGRESS" | "ACTION_REQUIRED" | "MISSING" | "EXPIRED";
  nextAction: string;
};

type Form2290StatusCard = {
  total: number;
  compliant: number;
  pending: number;
  correctionNeeded: number;
  expired: number;
};

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toneClasses(tone: StatCard["tone"]) {
  switch (tone) {
    case "blue":
      return "bg-blue-600 text-white";
    case "green":
      return "bg-emerald-600 text-white";
    case "purple":
      return "bg-purple-600 text-white";
    case "orange":
      return "bg-orange-600 text-white";
    default:
      return "bg-zinc-900 text-white";
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<StatCard[]>([]);
  const [ucrStatus, setUcrStatus] = useState<UcrStatusCard | null>(null);
  const [form2290Status, setForm2290Status] = useState<Form2290StatusCard | null>(null);
  const [loading, setLoading] = useState(true);

  // toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (t: Omit<Toast, "id">) => {
    const id = uid();
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  };
  const removeToast = (id: string) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  const isAdmin = useMemo(
    () => !!session?.user?.roles?.includes("ADMIN"),
    [session],
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Fetch dashboard data
  useEffect(() => {
    const run = async () => {
      if (!session?.user) return;
      setLoading(true);

      const base: StatCard[] = [
        {
          title: "Roles",
          value: (session.user.roles?.length ?? 0).toString(),
          icon: "🎭",
          tone: "purple",
          href: isAdmin ? "/admin/roles" : undefined,
        },
        {
          title: "Permissions",
          value: (session.user.permissions?.length ?? 0).toString(),
          icon: "🔑",
          tone: "orange",
          href: isAdmin ? "/admin/permissions" : undefined,
        },
        {
          title: "Session",
          value: "Active",
          icon: "🔐",
          tone: "green",
        },
      ];

      // Admin-only: show users count if endpoint exists
      if (isAdmin) {
        base.unshift({
          title: "Users",
          value: "—",
          icon: "👥",
          tone: "blue",
          href: "/admin/users",
        });

        try {
          const userRes = await fetch("/api/v1/users", { cache: "no-store" });
          if (userRes.ok) {
            const userData = await userRes.json();
            const count = Array.isArray(userData?.data)
              ? userData.data.length
              : userData?.count;
            base[0].value = (count ?? "—").toString();
          }
        } catch {
          // ignore
        }
      }

      if (session.user.permissions?.includes("ucr:read")) {
        try {
          const ucrRes = await fetch("/api/v1/features/ucr/compliance-status", {
            cache: "no-store",
          });
          if (ucrRes.ok) {
            setUcrStatus((await ucrRes.json()) as UcrStatusCard);
          } else {
            setUcrStatus(null);
          }
        } catch {
          setUcrStatus(null);
        }
      } else {
        setUcrStatus(null);
      }

      if (session.user.permissions?.includes("compliance2290:view")) {
        try {
          const form2290Res = await fetch("/api/v1/features/2290/compliance-status", {
            cache: "no-store",
          });
          if (form2290Res.ok) {
            setForm2290Status((await form2290Res.json()) as Form2290StatusCard);
          } else {
            setForm2290Status(null);
          }
        } catch {
          setForm2290Status(null);
        }
      } else {
        setForm2290Status(null);
      }

      setStats(base);
      setLoading(false);
    };

    run().catch((err) => {
      console.error("Error fetching dashboard data:", err);
      pushToast({
        type: "error",
        title: "Dashboard failed to load",
        message: "Please refresh the page.",
      });
      setLoading(false);
    });
  }, [session, isAdmin]);

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 overflow-auto bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="flex-1">
                <div className="h-5 w-72 animate-pulse rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-100" />
                <div className="mt-3 h-8 w-20 animate-pulse rounded bg-zinc-100" />
                <div className="mt-4 h-9 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  const displayName = session.user.name || session.user.email || "User";

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[92vw] max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl border bg-white p-4 shadow-lg ${
              t.type === "success"
                ? "border-emerald-100"
                : t.type === "error"
                  ? "border-red-100"
                  : "border-zinc-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{t.title}</p>
                {t.message && (
                  <p className="mt-1 text-sm text-zinc-600">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-sm font-semibold">
                    {(displayName?.[0] || "U").toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Welcome, {displayName}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>

            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                Open admin →
              </Link>
            ) : (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                Dashboard
              </span>
            )}
          </div>

          {/* Account strip */}
          <div className="mt-6 rounded-2xl border bg-zinc-50 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Email
                </p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-900">
                  {session.user.email}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Roles
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {session.user.roles?.join(", ") || "No roles assigned"}
                </p>
              </div>

              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Permissions
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {(session.user.permissions?.length ?? 0).toString()}
                </p>
              </div>
            </div>

            {session.user.permissions &&
              session.user.permissions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Your permissions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {session.user.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Stats */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              Statistics
            </h2>
            <span className="text-sm text-zinc-500">Quick snapshot</span>
          </div>

          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => {
              const card = (
                <div className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {s.title}
                    </p>
                    <span className="text-2xl">{s.icon}</span>
                  </div>

                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center rounded-xl px-3 py-2 text-sm font-semibold ${toneClasses(
                        s.tone,
                      )}`}
                    >
                      {s.value}
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-zinc-600">
                    {s.href ? "View details →" : "—"}
                  </div>
                </div>
              );

              return s.href ? (
                <Link key={s.title} href={s.href} className="block">
                  {card}
                </Link>
              ) : (
                <div key={s.title}>{card}</div>
              );
            })}
          </div>
        </section>

        {ucrStatus && (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  UCR compliance
                </p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900">
                  UCR {ucrStatus.filingYear}: {ucrStatus.workflowLabel}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">{ucrStatus.nextAction}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    ucrStatus.complianceStatus === "COMPLIANT"
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                      : ucrStatus.complianceStatus === "ACTION_REQUIRED"
                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                        : ucrStatus.complianceStatus === "MISSING" ||
                            ucrStatus.complianceStatus === "EXPIRED"
                          ? "bg-red-50 text-red-800 ring-red-200"
                          : "bg-sky-50 text-sky-800 ring-sky-200"
                  }`}
                >
                  {ucrStatus.complianceStatus.replace("_", " ")}
                </span>
                <Link
                  href={ucrStatus.filingId ? `/ucr/${ucrStatus.filingId}` : "/ucr/new"}
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                >
                  {ucrStatus.filingId ? "View filing" : "Create filing"}
                </Link>
              </div>
            </div>
          </section>
        )}

        {form2290Status && (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Form 2290 compliance
                </p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-900">
                  {form2290Status.compliant > 0 && form2290Status.pending === 0 && form2290Status.correctionNeeded === 0
                    ? "Compliant"
                    : form2290Status.correctionNeeded > 0
                      ? "Correction needed"
                      : form2290Status.expired > 0
                        ? "Expired or missing"
                        : "In progress"}
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  {form2290Status.compliant} compliant, {form2290Status.pending} pending, {form2290Status.correctionNeeded} needing correction, {form2290Status.expired} expired.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    form2290Status.correctionNeeded > 0
                      ? "bg-amber-50 text-amber-800 ring-amber-200"
                      : form2290Status.expired > 0
                        ? "bg-red-50 text-red-800 ring-red-200"
                        : form2290Status.compliant > 0 && form2290Status.pending === 0
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                          : "bg-sky-50 text-sky-800 ring-sky-200"
                  }`}
                >
                  2290 overview
                </span>
                <Link
                  href="/2290"
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                >
                  Open 2290
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Quick actions */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Quick actions
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Jump to common tasks.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link
              href={
                session.user.roles?.includes("ADMIN") ||
                session.user.roles?.includes("STAFF")
                  ? "/admin/profile"
                  : `/users/${session.user.id}`
              }
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-zinc-50"
            >
              <p className="text-sm font-semibold text-zinc-900">
                Account settings
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Update your profile information.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                Open →
              </div>
            </Link>

            {session.user.permissions?.includes("compliance2290:view") && (
              <Link
                href="/2290"
                className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-zinc-50"
              >
                <p className="text-sm font-semibold text-zinc-900">
                  Form 2290
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Review HVUT compliance by vehicle and tax period.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                  Open â†’
                </div>
              </Link>
            )}

            {isAdmin && (
              <>
                <Link
                  href="/admin/roles"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-zinc-50"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    Manage roles
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Create roles and organize access.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100">
                    Open →
                  </div>
                </Link>

                <Link
                  href="/admin/users"
                  className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-zinc-50"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    Admin users
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Assign roles and audit access.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 ring-1 ring-orange-100">
                    Open →
                  </div>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Help */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Need help?
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Check documentation or contact support if something is blocked.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  pushToast({
                    type: "info",
                    title: "Documentation",
                    message: "Hook this button to your docs route.",
                  })
                }
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
              >
                Documentation
              </button>
              <button
                onClick={() =>
                  pushToast({
                    type: "info",
                    title: "Support",
                    message: "Hook this button to your support flow.",
                  })
                }
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                Contact support
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-2 text-center text-xs text-zinc-500">
          Last login: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
