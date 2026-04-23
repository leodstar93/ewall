"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
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

function parsePageSize(value: string) {
  const next = Number(value);
  return DEFAULT_PAGE_SIZE_OPTIONS.includes(
    next as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
  )
    ? (next as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
    : 10;
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

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("key-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

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

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

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

    return [...filtered].sort((a, b) => {
      if (sort === "key-asc") return a.key.localeCompare(b.key);
      if (sort === "key-desc") return b.key.localeCompare(a.key);
      if (sort === "roles-desc") return getRoleCount(b) - getRoleCount(a);
      if (sort === "roles-asc") return getRoleCount(a) - getRoleCount(b);
      return 0;
    });
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-44 animate-pulse rounded bg-zinc-100" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="mt-6 h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
          <div className="mt-3 text-center text-sm text-zinc-600">
            Loading permissions...
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="w-full min-w-0 space-y-6">
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
                x
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 p-6">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Admin</div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Permissions
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage permission keys and assign them to roles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Add permission
            </button>
            <Link
              href="/admin"
              className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total permissions
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900">
            {totals.totalPerms}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Assigned
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900">
            {totals.assignedPerms}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Role assignments
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900">
            {totals.totalAssignments}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-600">
              Search
            </label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-600">
              <svg
                className="h-4 w-4 text-zinc-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M8.5 3.5a5 5 0 103.14 8.9l3.48 3.48a.75.75 0 101.06-1.06l-3.48-3.48A5 5 0 008.5 3.5zM5 8.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by key, description, or role..."
                className="w-full bg-transparent text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-600">
              Sort by
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
            >
              <option value="key-asc">Key</option>
              <option value="key-desc">Key desc</option>
              <option value="roles-desc">Most roles</option>
              <option value="roles-asc">Least roles</option>
            </select>
          </div>

          <div className="flex items-end justify-between gap-3 md:justify-end">
            <div className="text-sm text-zinc-600">
              Showing{" "}
              <span className="font-semibold text-zinc-900">
                {filteredSortedPermissions.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-zinc-900">
                {permissions.length}
              </span>
            </div>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(parsePageSize(e.target.value))}
              className="rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              title="Rows per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {paginatedPermissions.totalItems > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b bg-zinc-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Permission
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Roles
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Assigned
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedPermissions.items.map((permission) => {
                    const roleCount =
                      permission._count?.roles ?? permission.roles?.length ?? 0;

                    return (
                      <tr
                        key={permission.id}
                        className="transition-colors hover:bg-zinc-50/70"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 font-semibold text-white">
                              {(permission.key[0] || "P").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-mono text-sm font-semibold text-zinc-900">
                                {permission.key}
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {roleCount > 0
                                  ? `${roleCount} role(s) assigned`
                                  : "Not assigned"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {permission.description || "No description"}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {permission.roles && permission.roles.length > 0 ? (
                              permission.roles.slice(0, 4).map((r) => (
                                <Badge key={r.role.id} tone="primary">
                                  {r.role.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-zinc-500">
                                No roles
                              </span>
                            )}

                            {permission.roles &&
                              permission.roles.length > 4 && (
                                <Badge tone="light">
                                  +{permission.roles.length - 4}
                                </Badge>
                              )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <Badge tone={roleCount > 0 ? "success" : "light"}>
                            {roleCount}
                          </Badge>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <IconButton
                              onClick={() =>
                                handleOpenAssignRolesModal(permission)
                              }
                              label="Assign roles"
                              icon="roles"
                            />
                            <IconButton
                              onClick={() => handleOpenDeleteModal(permission)}
                              variant="danger"
                              label="Delete permission"
                              icon="delete"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-600">
                Page{" "}
                <span className="font-semibold text-zinc-900">
                  {paginatedPermissions.currentPage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-zinc-900">
                  {paginatedPermissions.totalPages}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={paginatedPermissions.currentPage === 1}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  First
                </button>
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={paginatedPermissions.currentPage === 1}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() =>
                    setPage((current) =>
                      Math.min(paginatedPermissions.totalPages, current + 1),
                    )
                  }
                  disabled={
                    paginatedPermissions.currentPage ===
                    paginatedPermissions.totalPages
                  }
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(paginatedPermissions.totalPages)}
                  disabled={
                    paginatedPermissions.currentPage ===
                    paginatedPermissions.totalPages
                  }
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Last
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <div className="text-sm text-zinc-600">
              {query ? "No permissions found." : "No permissions created yet."}
            </div>
          </div>
        )}
      </div>

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
                    x
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
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10"
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
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10"
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
                    className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
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
                    x
                  </button>
                </div>

                <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {roles.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition hover:bg-zinc-50 ${
                          checked ? "ring-2 ring-zinc-200" : ""
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
                          className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">
                              {role.name}
                            </span>
                            {checked ? (
                              <Badge tone="light">Selected</Badge>
                            ) : null}
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
                    className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
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
                    x
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">
                    You&apos;re about to delete{" "}
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
