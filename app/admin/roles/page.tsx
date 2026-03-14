"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
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

  // Search + sort
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  // Toasts
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

  // Fetch roles
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // optimistic guard: prevent duplicates by name
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

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "users-desc") return getUsers(b) - getUsers(a);
      if (sort === "perms-desc") return getPerms(b) - getPerms(a);
      return 0;
    });

    return sorted;
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

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >
                <div className="h-5 w-40 animate-pulse rounded bg-zinc-100" />
                <div className="mt-3 h-4 w-56 animate-pulse rounded bg-zinc-100" />
                <div className="mt-5 flex gap-3">
                  <div className="h-16 flex-1 animate-pulse rounded-xl bg-zinc-100" />
                  <div className="h-16 flex-1 animate-pulse rounded-xl bg-zinc-100" />
                </div>
                <div className="mt-5 h-10 w-full animate-pulse rounded-xl bg-zinc-100" />
              </div>
            ))}
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
                  <span className="text-sm font-semibold">R</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Manage roles
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Search, sort, and maintain roles for your RBAC.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
              >
                + Add role
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
                Total roles
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {roles.length}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Assigned users
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totalUsers}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total permissions
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totalPerms}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search roles by name or description..."
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 pr-10 text-sm text-zinc-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
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
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="name-desc">Name (Z → A)</option>
                <option value="users-desc">Most users</option>
                <option value="perms-desc">Most permissions</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        {filteredSortedRoles.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedRoles.items.map((role) => {
                const usersCount = role._count?.users || 0;
                const permsCount = role._count?.permissions || 0;

              const locked = role.name === "ADMIN" || usersCount > 0;

              return (
                <div
                  key={role.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-zinc-900">
                        {role.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                        {role.description || "—"}
                      </p>
                    </div>

                    {role.name === "ADMIN" ? (
                      <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white">
                        System
                      </span>
                    ) : (
                      <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 ring-1 ring-purple-100">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-zinc-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Users
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900">
                        {usersCount}
                      </p>
                    </div>

                    <div className="rounded-2xl border bg-zinc-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Permissions
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-zinc-900">
                        {permsCount}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/roles/${role.id}`}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                    >
                      View
                    </Link>

                    <button
                      onClick={() => handleOpenDeleteModal(role)}
                      disabled={locked}
                      className={`inline-flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition ${
                        locked
                          ? "cursor-not-allowed border bg-zinc-100 text-zinc-400"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                      title={
                        role.name === "ADMIN"
                          ? "Cannot delete ADMIN role"
                          : usersCount > 0
                            ? "Cannot delete role with assigned users"
                            : "Delete role"
                      }
                    >
                      Delete
                    </button>
                  </div>

                  {locked && (
                    <p className="mt-3 text-xs text-zinc-500">
                      {role.name === "ADMIN"
                        ? "ADMIN is a protected system role."
                        : "Unassign users before deleting this role."}
                    </p>
                  )}
                </div>
                );
              })}
            </div>
            <div className="rounded-2xl border bg-white shadow-sm">
              <ClientPaginationControls
                page={paginatedRoles.currentPage}
                totalPages={paginatedRoles.totalPages}
                pageSize={paginatedRoles.pageSize}
                totalItems={paginatedRoles.totalItems}
                itemLabel="roles"
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
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 ring-1 ring-purple-100">
              🔎
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-900">
              No results
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Try a different search or create a new role.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => setQuery("")}
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              >
                Clear search
              </button>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
              >
                Create role
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
                    ✕
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
                      placeholder="e.g., EDITOR, VIEWER, DOCTOR"
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
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
                      placeholder="Describe this role’s purpose..."
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
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
                    className="flex-1 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
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
                    ✕
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">
                    You’re about to delete{" "}
                    <span className="font-semibold text-zinc-900">
                      {selectedRole.name}
                    </span>
                    .
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Tip: unassign users first if you’re reorganizing access.
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
