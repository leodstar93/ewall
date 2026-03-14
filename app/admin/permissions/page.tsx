"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

interface Permission {
  id: string;
  key: string;
  description: string | null;
  roles?: Array<{ role: { id: string; name: string } }>;
  _count?: { roles: number };
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

type SortKey = "key-asc" | "key-desc" | "roles-desc" | "roles-asc";

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AdminPermissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"add" | "delete" | "assignRoles">(
    "add",
  );
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({ key: "", description: "" });
  const [formError, setFormError] = useState("");

  // search + sort
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("key-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

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

  // Check admin access
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

  // Fetch permissions and roles
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [permRes, rolesRes] = await Promise.all([
          fetch("/api/v1/permissions"),
          fetch("/api/v1/roles"),
        ]);

        if (permRes.ok) {
          const data = await permRes.json();
          setPermissions(Array.isArray(data) ? data : data.data || []);
        } else {
          pushToast({
            type: "error",
            title: "Failed to load permissions",
            message: "Please try again.",
          });
        }

        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        } else {
          pushToast({
            type: "error",
            title: "Failed to load roles",
            message: "Permissions page needs roles to assign.",
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        pushToast({
          type: "error",
          title: "Network error",
          message: "Could not fetch permissions/roles.",
        });
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filteredSortedPermissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const getRoleCount = (p: Permission) =>
      p._count?.roles ?? p.roles?.length ?? 0;

    const filtered = q
      ? permissions.filter((p) => {
          const k = p.key?.toLowerCase() ?? "";
          const d = p.description?.toLowerCase() ?? "";
          const roleNames =
            p.roles?.map((r) => r.role.name.toLowerCase()).join(" ") ?? "";
          return k.includes(q) || d.includes(q) || roleNames.includes(q);
        })
      : permissions;

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "key-asc") return a.key.localeCompare(b.key);
      if (sort === "key-desc") return b.key.localeCompare(a.key);
      if (sort === "roles-desc") return getRoleCount(b) - getRoleCount(a);
      if (sort === "roles-asc") return getRoleCount(a) - getRoleCount(b);
      return 0;
    });

    return sorted;
  }, [permissions, query, sort]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, sort]);

  const paginatedPermissions = useMemo(
    () => paginateItems(filteredSortedPermissions, page, pageSize),
    [filteredSortedPermissions, page, pageSize],
  );

  const totals = useMemo(() => {
    const totalPerms = permissions.length;
    const assignedPerms = permissions.reduce((acc, p) => {
      const n = p._count?.roles ?? p.roles?.length ?? 0;
      return acc + (n > 0 ? 1 : 0);
    }, 0);
    const totalAssignments = permissions.reduce((acc, p) => {
      const n = p._count?.roles ?? p.roles?.length ?? 0;
      return acc + n;
    }, 0);

    return { totalPerms, assignedPerms, totalAssignments };
  }, [permissions]);

  const handleOpenAddModal = () => {
    setFormData({ key: "", description: "" });
    setFormError("");
    setSelectedPermission(null);
    setModalType("add");
    setShowModal(true);
  };

  const handleOpenAssignRolesModal = (permission: Permission) => {
    setSelectedPermission(permission);
    setSelectedRoles(permission.roles?.map((r) => r.role.id) || []);
    setModalType("assignRoles");
    setShowModal(true);
  };

  const handleOpenDeleteModal = (permission: Permission) => {
    setSelectedPermission(permission);
    setModalType("delete");
    setShowModal(true);
  };

  const handleAddPermission = async () => {
    setFormError("");

    const key = formData.key.trim().toLowerCase();
    if (!key) {
      setFormError("Permission key is required");
      return;
    }

    // quick duplicate guard
    if (permissions.some((p) => p.key === key)) {
      setFormError("This permission key already exists");
      return;
    }

    try {
      const response = await fetch("/api/v1/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          description: formData.description || null,
        }),
      });

      if (response.ok) {
        const newPermission = await response.json();
        setPermissions((prev) => [newPermission, ...prev]);
        setShowModal(false);
        setFormData({ key: "", description: "" });
        pushToast({
          type: "success",
          title: "Permission created",
          message: key,
        });
      } else {
        const error = await response.json().catch(() => ({}));
        const msg = error.error || "Failed to create permission";
        setFormError(msg);
        pushToast({ type: "error", title: "Create failed", message: msg });
      }
    } catch (error) {
      console.error("Error creating permission:", error);
      setFormError("Error creating permission");
      pushToast({
        type: "error",
        title: "Network error",
        message: "Could not create permission.",
      });
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedPermission) return;

    try {
      const response = await fetch(
        `/api/v1/permissions/${selectedPermission.id}/roles`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleIds: selectedRoles }),
        },
      );

      if (response.ok) {
        // update local state to reflect assignment
        setPermissions((prev) =>
          prev.map((p) => {
            if (p.id !== selectedPermission.id) return p;

            const mappedRoles = selectedRoles
              .map((roleId) => roles.find((r) => r.id === roleId))
              .filter(Boolean)
              .map((role) => ({ role: role! }));

            return {
              ...p,
              roles: mappedRoles,
              _count: { roles: selectedRoles.length },
            };
          }),
        );

        setShowModal(false);
        const key = selectedPermission.key;
        setSelectedPermission(null);

        pushToast({
          type: "success",
          title: "Roles updated",
          message: key,
        });
      } else {
        pushToast({
          type: "error",
          title: "Update failed",
          message: "Failed to update roles.",
        });
      }
    } catch (error) {
      console.error("Error updating roles:", error);
      pushToast({
        type: "error",
        title: "Network error",
        message: "Could not update roles.",
      });
    }
  };

  const handleDeletePermission = async () => {
    if (!selectedPermission) return;

    try {
      const response = await fetch(
        `/api/v1/permissions/${selectedPermission.id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        const deletedKey = selectedPermission.key;
        setPermissions((prev) =>
          prev.filter((p) => p.id !== selectedPermission.id),
        );
        setShowModal(false);
        setSelectedPermission(null);

        pushToast({
          type: "success",
          title: "Permission deleted",
          message: deletedKey,
        });
      } else {
        const error = await response.json().catch(() => ({}));
        pushToast({
          type: "error",
          title: "Delete failed",
          message: error.error || "Failed to delete permission",
        });
      }
    } catch (error) {
      console.error("Error deleting permission:", error);
      pushToast({
        type: "error",
        title: "Network error",
        message: "Could not delete permission.",
      });
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 overflow-auto bg-zinc-50">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-zinc-100" />
              <div className="flex-1">
                <div className="h-5 w-56 animate-pulse rounded bg-zinc-100" />
                <div className="mt-2 h-4 w-80 animate-pulse rounded bg-zinc-100" />
              </div>
              <div className="h-10 w-32 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="h-5 w-44 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

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
                  <span className="text-sm font-semibold">P</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Manage permissions
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Create permissions and assign them to roles.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
              >
                + Add permission
              </button>

              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                ← Back to Admin
              </Link>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total permissions
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totals.totalPerms}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Assigned permissions
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totals.assignedPerms}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Role assignments
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totals.totalAssignments}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by key, description, or role..."
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 pr-10 text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-zinc-700">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              >
                <option value="key-asc">Key (A → Z)</option>
                <option value="key-desc">Key (Z → A)</option>
                <option value="roles-desc">Most roles</option>
                <option value="roles-asc">Least roles</option>
              </select>
            </div>
          </div>

          {/* Info strip */}
          <div className="mt-6 rounded-2xl border bg-zinc-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-lg">🔑</div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">
                  About permissions
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Use a consistent format like{" "}
                  <span className="font-mono">resource:action</span>. Example:
                  <span className="ml-2 rounded-md bg-white px-2 py-0.5 font-mono text-xs ring-1 ring-zinc-200">
                    users:read
                  </span>
                  <span className="ml-2 rounded-md bg-white px-2 py-0.5 font-mono text-xs ring-1 ring-zinc-200">
                    users:write
                  </span>
                  <span className="ml-2 rounded-md bg-white px-2 py-0.5 font-mono text-xs ring-1 ring-zinc-200">
                    users:manage
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        {filteredSortedPermissions.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Permission
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Roles
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedPermissions.items.map((permission) => {
                    const roleCount =
                      permission._count?.roles ?? permission.roles?.length ?? 0;

                    return (
                      <tr key={permission.id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-lg bg-zinc-100 px-3 py-1 font-mono text-sm font-semibold text-zinc-900">
                            {permission.key}
                          </span>
                          <div className="mt-2 text-xs text-zinc-500">
                            {roleCount > 0
                              ? `${roleCount} role(s) assigned`
                              : "Not assigned"}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {permission.description || "—"}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {permission.roles && permission.roles.length > 0 ? (
                              permission.roles.slice(0, 4).map((r) => (
                                <span
                                  key={r.role.id}
                                  className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100"
                                >
                                  {r.role.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-zinc-500">—</span>
                            )}

                            {permission.roles &&
                              permission.roles.length > 4 && (
                                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                                  +{permission.roles.length - 4}
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() =>
                                handleOpenAssignRolesModal(permission)
                              }
                              className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                            >
                              Roles
                            </button>
                            <button
                              onClick={() => handleOpenDeleteModal(permission)}
                              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ClientPaginationControls
              page={paginatedPermissions.currentPage}
              totalPages={paginatedPermissions.totalPages}
              pageSize={paginatedPermissions.pageSize}
              totalItems={paginatedPermissions.totalItems}
              itemLabel="permissions"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) =>
                setPageSize(
                  DEFAULT_PAGE_SIZE_OPTIONS.includes(
                    nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                  )
                    ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                    : 10,
                )
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-700 ring-1 ring-orange-100">
              🔎
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">
              {query ? "No results" : "No permissions yet"}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {query
                ? "Try a different search."
                : "Create your first permission to start controlling access."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                >
                  Clear search
                </button>
              ) : null}

              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
              >
                Create permission
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            {modalType === "add" && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">
                      Create permission
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Use <span className="font-mono">resource:action</span>.
                      Stored in lowercase.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-800">
                      Permission key
                    </label>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) =>
                        setFormData({ ...formData, key: e.target.value })
                      }
                      placeholder="e.g., users:read"
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      Tip: add <span className="font-mono">:manage</span> for
                      admins of a module.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-800">
                      Description (optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe what this permission allows..."
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </div>

                  {formError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {formError}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPermission}
                    className="flex-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {modalType === "assignRoles" && selectedPermission && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">
                      Assign roles
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Permission:{" "}
                      <span className="font-mono font-semibold text-zinc-900">
                        {selectedPermission.key}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-3 max-h-72 overflow-y-auto pr-1">
                  {roles.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition hover:bg-zinc-50 ${
                          checked ? "ring-2 ring-orange-200" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles((prev) => [...prev, role.id]);
                            } else {
                              setSelectedRoles((prev) =>
                                prev.filter((r) => r !== role.id),
                              );
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-zinc-300 text-orange-600"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">
                              {role.name}
                            </span>
                            {checked && (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-orange-100">
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

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRoles}
                    className="flex-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {modalType === "delete" && selectedPermission && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">
                      Delete permission
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      This cannot be undone.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">
                    You’re about to delete{" "}
                    <span className="font-mono font-semibold text-zinc-900">
                      {selectedPermission.key}
                    </span>
                    .
                  </p>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeletePermission}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
