"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserDetail {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  roles: Array<{ role: Role }>;
}

export default function UserDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const userId = useMemo(() => params?.id, [params]);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingRoles, setEditingRoles] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const isAdmin = !!session?.user?.roles?.includes("ADMIN");

  // Redirect if not admin
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId || !isAdmin) return;
      setLoading(true);
      try {
        const [uRes, rRes] = await Promise.all([
          fetch(`/api/v1/users/${userId}`),
          fetch(`/api/v1/roles`),
        ]);

        if (uRes.ok) {
          const data = await uRes.json();
          setUser(data);
          setSelectedRoles(data.roles.map((r: any) => r.role.id));
        } else {
          setUser(null);
        }

        if (rRes.ok) {
          const data = await rRes.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, isAdmin]);

  const handleSaveRoles = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`/api/v1/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setEditingRoles(false);
      } else {
        alert("Failed to update roles");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating roles");
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    if (!confirm("Delete this user? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/v1/users/${userId}`, { method: "DELETE" });
      if (res.ok) router.push("/admin/users");
      else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 overflow-auto bg-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 animate-pulse rounded-xl bg-zinc-100" />
              <div className="flex-1">
                <div className="h-5 w-56 animate-pulse rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-80 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-10 w-32 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="h-5 w-44 animate-pulse rounded bg-zinc-100" />
              <div className="mt-4 space-y-2">
                <div className="h-4 w-72 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-64 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-56 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-5 w-28 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-7 w-24 animate-pulse rounded-full bg-zinc-100"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  if (!user) {
    return (
      <div className="flex-1 overflow-auto bg-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <h1 className="text-lg font-semibold text-zinc-900">
              User not found
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              The user may have been deleted or you don’t have access.
            </p>
            <div className="mt-6">
              <Link
                href="/admin/users"
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                ← Back to Users
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = user.name || user.email || "User";

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      {/* Top bar / header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
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
                    {displayName}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Manage profile details and roles
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/users"
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                ← Back
              </Link>

              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
              >
                Delete user
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-6">
          {/* Account card */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900">
                Account information
              </h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                Active
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Email
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {user.email || "—"}
                </p>
              </div>

              <div className="rounded-xl border bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Name
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {user.name || "—"}
                </p>
              </div>

              <div className="rounded-xl border bg-zinc-50 p-4 sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Joined
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Roles card */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Roles</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Assign roles to control access across the app.
                </p>
              </div>

              {!editingRoles ? (
                <button
                  onClick={() => setEditingRoles(true)}
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                >
                  Edit roles
                </button>
              ) : (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                  Editing
                </span>
              )}
            </div>

            {editingRoles ? (
              <div className="mt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {roles.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition hover:bg-zinc-50 ${
                          checked ? "ring-2 ring-blue-200" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles([...selectedRoles, role.id]);
                            } else {
                              setSelectedRoles(
                                selectedRoles.filter((r) => r !== role.id),
                              );
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-zinc-300 text-blue-600"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">
                              {role.name}
                            </span>
                            {checked && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                                Selected
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <p className="mt-1 text-sm text-zinc-600">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={handleSaveRoles}
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                  >
                    Save changes
                  </button>
                  <button
                    onClick={() => {
                      setEditingRoles(false);
                      // optional: reset selection to server state if user cancels
                      setSelectedRoles(user.roles.map((r: any) => r.role.id));
                    }}
                    className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                {user.roles.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((r) => (
                      <span
                        key={r.role.id}
                        className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100"
                      >
                        {r.role.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-zinc-50 p-4 text-sm text-zinc-600">
                    No roles assigned.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Danger zone
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Deleting a user is permanent and cannot be undone.
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
              >
                Delete user
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-xs text-zinc-500">
          Tip: keep roles small and permission-based for scaling your RBAC.
        </div>
      </div>
    </div>
  );
}