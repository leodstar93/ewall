"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ActionIcon,
  IconButton,
  iconButtonClasses,
} from "@/components/ui/icon-button";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

interface Role {
  id: string;
  name: string;
  description: string | null;
  _count?: {
    users: number;
    permissions: number;
  };
}

type SortKey = "name-asc" | "name-desc" | "users-desc" | "perms-desc";

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

export default function AdminRolesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"add" | "delete">("add");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [formData, setFormData] = useState({ name: "", description: "" });
  const [formError, setFormError] = useState("");

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
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
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/roles");
        if (response.ok) {
          const data = await response.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        } else {
          pushToast({
            type: "error",
            title: "Failed to load roles",
            message: "Please try again.",
          });
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
        pushToast({
          type: "error",
          title: "Network error",
          message: "Could not fetch roles.",
        });
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) fetchRoles();
  }, [isAdmin]);

  const handleOpenAddModal = () => {
    setSelectedRole(null);
    setFormData({ name: "", description: "" });
    setFormError("");
    setModalType("add");
    setShowModal(true);
  };

  const handleOpenDeleteModal = (role: Role) => {
    setSelectedRole(role);
    setModalType("delete");
    setShowModal(true);
  };

  const handleAddRole = async () => {
    setFormError("");
    const trimmed = formData.name.trim();
    if (!trimmed) {
      setFormError("Role name is required");
      return;
    }

    const upper = trimmed.toUpperCase();
    if (roles.some((r) => r.name === upper)) {
      setFormError("A role with that name already exists");
      return;
    }

    try {
      const response = await fetch("/api/v1/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: upper,
          description: formData.description || null,
        }),
      });

      if (response.ok) {
        const newRole = await response.json();
        setRoles((prev) => [newRole, ...prev]);
        setShowModal(false);
        setFormData({ name: "", description: "" });
        pushToast({
          type: "success",
          title: "Role created",
          message: `${upper} is ready.`,
        });
      } else {
        const error = await response.json().catch(() => ({}));
        const msg = error.error || "Failed to create role";
        setFormError(msg);
        pushToast({ type: "error", title: "Create failed", message: msg });
      }
    } catch (error) {
      console.error("Error creating role:", error);
      setFormError("Error creating role");
      pushToast({
        type: "error",
        title: "Network error",
        message: "Could not create role.",
      });
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/v1/roles/${selectedRole.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const deletedName = selectedRole.name;
        setRoles((prev) => prev.filter((r) => r.id !== selectedRole.id));
        setShowModal(false);
        setSelectedRole(null);
        pushToast({
          type: "success",
          title: "Role deleted",
          message: `${deletedName} removed.`,
        });
      } else {
        const error = await response.json().catch(() => ({}));
        const msg = error.error || "Failed to delete role";
        pushToast({ type: "error", title: "Delete failed", message: msg });
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      pushToast({
        type: "error",
        title: "Network error",
        message: "Could not delete role.",
      });
    }
  };

  const filteredSortedRoles = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = q
      ? roles.filter((r) => {
          const name = r.name?.toLowerCase() ?? "";
          const desc = r.description?.toLowerCase() ?? "";
          return name.includes(q) || desc.includes(q);
        })
      : roles;

    const getUsers = (r: Role) => r._count?.users || 0;
    const getPerms = (r: Role) => r._count?.permissions || 0;

    return [...filtered].sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "users-desc") return getUsers(b) - getUsers(a);
      if (sort === "perms-desc") return getPerms(b) - getPerms(a);
      return 0;
    });
  }, [roles, query, sort]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, sort]);

  const paginatedRoles = useMemo(
    () => paginateItems(filteredSortedRoles, page, pageSize),
    [filteredSortedRoles, page, pageSize],
  );

  const totalUsers = useMemo(
    () => roles.reduce((acc, r) => acc + (r._count?.users || 0), 0),
    [roles],
  );

  const totalPerms = useMemo(
    () => roles.reduce((acc, r) => acc + (r._count?.permissions || 0), 0),
    [roles],
  );

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
            Loading roles...
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
            <h1 className="text-xl font-semibold text-zinc-900">Roles</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage role definitions and access distribution.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Add role
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
            Total roles
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900">
            {roles.length}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Assigned users
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900">
            {totalUsers}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Permissions
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900">
            {totalPerms}
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
                placeholder="Search by role or description..."
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
              <option value="name-asc">Name</option>
              <option value="name-desc">Name desc</option>
              <option value="users-desc">Most users</option>
              <option value="perms-desc">Most permissions</option>
            </select>
          </div>

          <div className="flex items-end justify-between gap-3 md:justify-end">
            <div className="text-sm text-zinc-600">
              Showing{" "}
              <span className="font-semibold text-zinc-900">
                {filteredSortedRoles.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-zinc-900">{roles.length}</span>
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
        {paginatedRoles.totalItems > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b bg-zinc-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Users
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Permissions
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedRoles.items.map((role) => {
                    const usersCount = role._count?.users || 0;
                    const permsCount = role._count?.permissions || 0;
                    const locked = role.name === "ADMIN" || usersCount > 0;

                    return (
                      <tr
                        key={role.id}
                        className="transition-colors hover:bg-zinc-50/70"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 font-semibold text-white">
                              {(role.name[0] || "R").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-medium text-zinc-900">
                                  {role.name}
                                </div>
                                <Badge
                                  tone={role.name === "ADMIN" ? "dark" : "info"}
                                  variant={
                                    role.name === "ADMIN" ? "solid" : "light"
                                  }
                                >
                                  {role.name === "ADMIN" ? "System" : "Custom"}
                                </Badge>
                              </div>
                              <div className="mt-1 text-xs text-zinc-500">
                                {locked
                                  ? role.name === "ADMIN"
                                    ? "Protected system role"
                                    : "Delete disabled while users are assigned"
                                  : "Role available for updates"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-zinc-700">
                          {role.description || "No description"}
                        </td>

                        <td className="px-6 py-4">
                          <Badge tone="info">{usersCount}</Badge>
                        </td>

                        <td className="px-6 py-4">
                          <Badge tone="success">{permsCount}</Badge>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/admin/roles/${role.id}`}
                              aria-label="View role"
                              title="View role"
                              className={iconButtonClasses({ variant: "default" })}
                            >
                              <ActionIcon name="view" />
                            </Link>
                            <IconButton
                              onClick={() => handleOpenDeleteModal(role)}
                              disabled={locked}
                              variant="danger"
                              label="Delete role"
                              icon="delete"
                              title={
                                role.name === "ADMIN"
                                  ? "Cannot delete ADMIN role"
                                  : usersCount > 0
                                    ? "Cannot delete role with assigned users"
                                    : "Delete role"
                              }
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
                  {paginatedRoles.currentPage}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-zinc-900">
                  {paginatedRoles.totalPages}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={paginatedRoles.currentPage === 1}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  First
                </button>
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={paginatedRoles.currentPage === 1}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={() =>
                    setPage((current) =>
                      Math.min(paginatedRoles.totalPages, current + 1),
                    )
                  }
                  disabled={paginatedRoles.currentPage === paginatedRoles.totalPages}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(paginatedRoles.totalPages)}
                  disabled={paginatedRoles.currentPage === paginatedRoles.totalPages}
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
              {query ? "No roles found." : "No roles created yet."}
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
                      Create role
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      Names are stored in uppercase for consistency.
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
                      Role name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., EDITOR, VIEWER, SUPPORT"
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10"
                    />
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
                      placeholder="Describe this role's purpose..."
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
                    onClick={handleAddRole}
                    className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {modalType === "delete" && selectedRole && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">
                      Delete role
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      This action cannot be undone.
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
                    <span className="font-semibold text-zinc-900">
                      {selectedRole.name}
                    </span>
                    .
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Tip: unassign users first if you&apos;re reorganizing access.
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
                    onClick={handleDeleteRole}
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
