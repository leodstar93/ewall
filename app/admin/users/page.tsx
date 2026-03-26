"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  roles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "blue" | "green" | "red" | "purple";
}) {
  const styles =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : tone === "red"
          ? "bg-rose-50 text-rose-700 border-rose-100"
          : tone === "purple"
            ? "bg-violet-50 text-violet-700 border-violet-100"
            : "bg-zinc-50 text-zinc-700 border-zinc-100";

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        styles,
      )}
    >
      {children}
    </span>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", styles)}>
      {children}
    </div>
  );
}

type ModalType = "roles" | "delete" | "add" | "bulkRoles" | "bulkDelete";
type UserSortBy = "name" | "email" | "created";
type UserPageSize = 10 | 25 | 50;

function parseSortBy(value: string): UserSortBy {
  return value === "email" || value === "created" ? value : "name";
}

function parsePageSize(value: string): UserPageSize {
  const parsed = Number(value);
  return parsed === 25 || parsed === 50 ? parsed : 10;
}

function getImpersonationDestination(permissions: string[]) {
  if (permissions.includes("dashboard:access")) return "/panel";
  if (permissions.includes("settings:read")) return "/settings";
  if (permissions.includes("documents:read")) return "/documents";
  if (permissions.includes("truck:read")) return "/trucks";
  if (permissions.includes("ifta:read")) return "/ifta";
  if (permissions.includes("ucr:read")) return "/ucr";
  if (permissions.includes("dmv:read")) return "/dmv";
  if (permissions.includes("compliance2290:view")) return "/2290";
  return "/settings";
}

export default function AdminUsersPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>("roles");
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<UserSortBy>("name");

  const [newUserForm, setNewUserForm] = useState({
    email: "",
    name: "",
    password: "",
    roles: [] as string[],
  });
  const [formError, setFormError] = useState("");

  const [toast, setToast] = useState<{
    tone: "success" | "error";
    msg: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  // Pagination
  const [pageSize, setPageSize] = useState<UserPageSize>(10);
  const [page, setPage] = useState(1);

  // Delete confirmation
  const [confirmText, setConfirmText] = useState("");

  // Admin access
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (
      status === "authenticated" &&
      !session?.user?.roles?.includes("ADMIN")
    ) {
      router.replace("/panel");
    }
  }, [status, session, router]);

  // Close modal on outside click / ESC
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!showModal) return;
      const el = modalRef.current;
      if (el && !el.contains(e.target as Node)) setShowModal(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [showModal]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch users + roles
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, rolesRes] = await Promise.all([
          fetch("/api/v1/users"),
          fetch("/api/v1/roles"),
        ]);

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(Array.isArray(usersData) ? usersData : usersData.data || []);
        }

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(Array.isArray(rolesData) ? rolesData : rolesData.data || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setToast({ tone: "error", msg: "Failed to load users/roles." });
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.roles?.includes("ADMIN")) fetchData();
  }, [session]);

  // Filter + sort
  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = users.filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      const name = (u.name ?? "").toLowerCase();
      return email.includes(q) || name.includes(q);
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case "email":
          return (a.email || "").localeCompare(b.email || "");
        case "created":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "name":
        default:
          return (a.name || "").localeCompare(b.name || "");
      }
    });

    return list;
  }, [users, searchTerm, sortBy]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageUsers = filteredUsers.slice(pageStart, pageEnd);

  // Helpers
  const adminOk = session?.user?.roles?.includes("ADMIN");

  const isSelected = (id: string) => selectedIds.has(id);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const pageIds = pageUsers.map((u) => u.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openRolesModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles.map((r) => r.role.id));
    setFormError("");
    setModalType("roles");
    setShowModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setConfirmText("");
    setFormError("");
    setModalType("delete");
    setShowModal(true);
  };

  const openAddModal = () => {
    setNewUserForm({ email: "", name: "", password: "", roles: [] });
    setFormError("");
    setModalType("add");
    setShowModal(true);
  };

  const openBulkRolesModal = () => {
    setSelectedUser(null);
    setSelectedRoles([]);
    setFormError("");
    setModalType("bulkRoles");
    setShowModal(true);
  };

  const openBulkDeleteModal = () => {
    setSelectedUser(null);
    setConfirmText("");
    setFormError("");
    setModalType("bulkDelete");
    setShowModal(true);
  };

  // Actions
  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    try {
      setBusy(true);
      const response = await fetch(`/api/v1/users/${selectedUser.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });

      if (!response.ok) throw new Error("Failed to update roles");

      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                roles: selectedRoles.map((roleId) => ({
                  role: roles.find((r) => r.id === roleId)!,
                })),
              }
            : u,
        ),
      );

      setToast({ tone: "success", msg: "Roles updated." });
      setShowModal(false);
      setSelectedUser(null);
    } catch (e) {
      console.error(e);
      setToast({ tone: "error", msg: "Error updating roles." });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    const mustMatch = selectedUser.email.trim().toLowerCase();
    if (confirmText.trim().toLowerCase() !== mustMatch) {
      setFormError("Type the user's email exactly to confirm deletion.");
      return;
    }

    try {
      setBusy(true);
      const response = await fetch(`/api/v1/users/${selectedUser.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete user");

      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setToast({ tone: "success", msg: "User deleted." });
      setShowModal(false);
      setSelectedUser(null);
      setConfirmText("");
    } catch (e) {
      console.error(e);
      setToast({ tone: "error", msg: "Error deleting user." });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateUser = async () => {
    setFormError("");

    if (!newUserForm.email.trim()) return setFormError("Email is required");
    if (!newUserForm.password.trim())
      return setFormError("Password is required");

    try {
      setBusy(true);
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUserForm.email,
          name: newUserForm.name || null,
          password: newUserForm.password,
          roleIds: newUserForm.roles,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setFormError(error.error || "Failed to create user");
        return;
      }

      const newUser = await response.json();
      setUsers((prev) => [newUser, ...prev]);
      setToast({ tone: "success", msg: "User created." });
      setShowModal(false);
    } catch (e) {
      console.error(e);
      setFormError("Error creating user");
    } finally {
      setBusy(false);
    }
  };

  // Bulk apply roles (assign selected roles to each selected user)
  const handleBulkAssignRoles = async () => {
    if (selectedIds.size === 0) return;

    try {
      setBusy(true);

      const ids = Array.from(selectedIds);
      // NOTE: backend no tiene bulk endpoint, así que hacemos requests en paralelo.
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/v1/users/${id}/roles`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleIds: selectedRoles }),
          }).then((r) => {
            if (!r.ok) throw new Error("bulk roles failed");
          }),
        ),
      );

      // Update local state
      setUsers((prev) =>
        prev.map((u) => {
          if (!selectedIds.has(u.id)) return u;
          return {
            ...u,
            roles: selectedRoles.map((roleId) => ({
              role: roles.find((r) => r.id === roleId)!,
            })),
          };
        }),
      );

      setToast({ tone: "success", msg: "Roles updated for selected users." });
      setShowModal(false);
      clearSelection();
    } catch (e) {
      console.error(e);
      setToast({ tone: "error", msg: "Bulk role update failed." });
    } finally {
      setBusy(false);
    }
  };

  // Bulk delete (requires typing DELETE)
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setFormError('Type "DELETE" to confirm bulk deletion.');
      return;
    }

    try {
      setBusy(true);
      const ids = Array.from(selectedIds);

      await Promise.all(
        ids.map((id) =>
          fetch(`/api/v1/users/${id}`, { method: "DELETE" }).then((r) => {
            if (!r.ok) throw new Error("bulk delete failed");
          }),
        ),
      );

      setUsers((prev) => prev.filter((u) => !selectedIds.has(u.id)));
      setToast({ tone: "success", msg: "Selected users deleted." });
      setShowModal(false);
      clearSelection();
      setConfirmText("");
    } catch (e) {
      console.error(e);
      setToast({ tone: "error", msg: "Bulk delete failed." });
    } finally {
      setBusy(false);
    }
  };

  // Quick copy helpers
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: "success", msg: "Copied." });
    } catch {
      setToast({ tone: "error", msg: "Copy failed." });
    }
  };

  const handleLoginAsUser = async (user: User) => {
    try {
      setImpersonatingUserId(user.id);
      const updatedSession = await update({
        impersonation: {
          action: "start",
          targetUserId: user.id,
        },
      });

      if (updatedSession?.user?.id !== user.id) {
        throw new Error("Could not start impersonation for this user.");
      }

      const nextPermissions = Array.isArray(updatedSession.user.permissions)
        ? updatedSession.user.permissions
        : [];
      const destination = getImpersonationDestination(nextPermissions);

      setToast({
        tone: "success",
        msg: `Now acting as ${user.name || user.email}.`,
      });
      window.location.assign(destination);
    } catch (error) {
      console.error(error);
      setToast({
        tone: "error",
        msg: "Could not login as this user.",
      });
    } finally {
      setImpersonatingUserId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-44 rounded bg-zinc-100 animate-pulse" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full rounded bg-zinc-100 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-zinc-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-zinc-100 animate-pulse" />
          </div>
          <div className="mt-6 h-10 w-full rounded-xl bg-zinc-100 animate-pulse" />
          <div className="mt-3 text-center text-sm text-zinc-600">
            Loading users…
          </div>
        </div>
      </div>
    );
  }

  if (!adminOk) return null;

  const allSelectedOnPage =
    pageUsers.length > 0 && pageUsers.every((u) => selectedIds.has(u.id));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Admin</div>
            <h1 className="text-xl font-semibold text-zinc-900">Users</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage users, assign roles, and control access.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddModal}
              className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition"
            >
              Add user
            </button>
            <Link
              href="/admin"
              className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="p-4">
            <Alert tone={toast.tone}>{toast.msg}</Alert>
          </div>
        </div>
      )}

      {/* Controls + Bulk bar */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-2">
                Search
              </label>
              <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-600">
                <span className="text-zinc-400">⌕</span>
                <input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or email…"
                  className="w-full outline-none bg-transparent text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-2">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(parseSortBy(e.target.value));
                  setPage(1);
                }}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="created">Recently created</option>
              </select>
            </div>

            <div className="flex items-end justify-between md:justify-end gap-3">
              <div className="text-sm text-zinc-600">
                Showing{" "}
                <span className="font-semibold text-zinc-900">
                  {filteredUsers.length}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-zinc-900">
                  {users.length}
                </span>
              </div>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parsePageSize(e.target.value));
                  setPage(1);
                }}
                className="rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                title="Rows per page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="rounded-2xl border bg-zinc-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm text-zinc-700">
                <span className="font-semibold text-zinc-900">
                  {selectedCount}
                </span>{" "}
                selected
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={openBulkRolesModal}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Assign roles
                </button>
                <button
                  onClick={openBulkDeleteModal}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 transition"
                >
                  Delete selected
                </button>
                <button
                  onClick={clearSelection}
                  className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {pageUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAllPage}
                        className="h-4 w-4 rounded border-zinc-300"
                        aria-label="Select all on page"
                      />
                      User
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Roles
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {pageUsers.map((user) => {
                  const letter = (
                    (user.name || user.email || "U")[0] || "U"
                  ).toUpperCase();
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-zinc-50/70 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected(user.id)}
                            onChange={() => toggleSelected(user.id)}
                            className="h-4 w-4 rounded border-zinc-300"
                            aria-label={`Select ${user.email}`}
                          />

                          <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
                            {letter}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 truncate">
                              {user.name || "No name"}
                            </div>
                            <button
                              onClick={() => copyToClipboard(user.id)}
                              className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
                              title="Copy user id"
                            >
                              Copy ID
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-700">
                            {user.email}
                          </span>
                          <button
                            onClick={() => copyToClipboard(user.email)}
                            className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
                            title="Copy email"
                          >
                            Copy
                          </button>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.length ? (
                            user.roles.map((r) => (
                              <Badge key={r.role.id} tone="purple">
                                {r.role.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-zinc-500">
                              No roles
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-zinc-700">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="rounded-2xl border bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                          >
                            View
                          </Link>

                          <button
                            onClick={() => openRolesModal(user)}
                            className="rounded-2xl border bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                          >
                            Roles
                          </button>

                          <button
                            onClick={() => void handleLoginAsUser(user)}
                            disabled={
                              impersonatingUserId === user.id ||
                              session?.user?.id === user.id
                            }
                            className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                          >
                            {session?.user?.id === user.id
                              ? "Current user"
                              : impersonatingUserId === user.id
                                ? "Opening..."
                                : "Login as this user"}
                          </button>

                          <button
                            onClick={() => openDeleteModal(user)}
                            className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 transition"
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
        ) : (
          <div className="p-10 text-center">
            <div className="text-sm text-zinc-600">No users found.</div>
          </div>
        )}

        {/* Pagination footer */}
        <div className="border-t bg-white px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-zinc-600">
            Page <span className="font-semibold text-zinc-900">{safePage}</span>{" "}
            of <span className="font-semibold text-zinc-900">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          <div
            ref={modalRef}
            className="relative w-full max-w-md rounded-2xl border bg-white shadow-xl"
          >
            <div className="p-6">
              {/* Roles */}
              {modalType === "roles" && selectedUser && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Edit roles</div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        {selectedUser.name || selectedUser.email}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        Select roles for this user.
                      </p>
                    </div>
                    <button
                      className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600"
                      onClick={() => setShowModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 max-h-64 overflow-y-auto rounded-2xl border bg-white">
                    <div className="divide-y">
                      {roles.map((role) => {
                        const checked = selectedRoles.includes(role.id);
                        return (
                          <label
                            key={role.id}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setSelectedRoles([...selectedRoles, role.id]);
                                else
                                  setSelectedRoles(
                                    selectedRoles.filter((r) => r !== role.id),
                                  );
                              }}
                              className="mt-1 h-4 w-4 rounded border-zinc-300"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900">
                                {role.name}
                              </div>
                              {role.description && (
                                <div className="text-sm text-zinc-600">
                                  {role.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveRoles}
                      className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                  </div>
                </>
              )}

              {/* Delete (safe) */}
              {modalType === "delete" && selectedUser && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Danger zone</div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        Delete user
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        Type the user email to confirm deletion.
                      </p>
                    </div>
                    <button
                      className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600"
                      onClick={() => setShowModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    You are deleting{" "}
                    <span className="font-semibold">{selectedUser.email}</span>.
                    This cannot be undone.
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-600 mb-2">
                      Confirm email
                    </label>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={selectedUser.email}
                      className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                    />
                  </div>

                  {formError && (
                    <div className="mt-4">
                      <Alert tone="error">{formError}</Alert>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition disabled:opacity-50"
                      disabled={busy}
                    >
                      {busy ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </>
              )}

              {/* Add */}
              {modalType === "add" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Create</div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        New user
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        Create a user and optionally assign roles.
                      </p>
                    </div>
                    <button
                      className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600"
                      onClick={() => setShowModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            email: e.target.value,
                          })
                        }
                        placeholder="user@example.com"
                        className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newUserForm.name}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Full name"
                        className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) =>
                          setNewUserForm({
                            ...newUserForm,
                            password: e.target.value,
                          })
                        }
                        placeholder="Enter password"
                        className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">
                        Roles
                      </label>
                      <div className="max-h-36 overflow-y-auto rounded-2xl border bg-white">
                        <div className="divide-y">
                          {roles.map((role) => {
                            const checked = newUserForm.roles.includes(role.id);
                            return (
                              <label
                                key={role.id}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewUserForm({
                                        ...newUserForm,
                                        roles: [...newUserForm.roles, role.id],
                                      });
                                    } else {
                                      setNewUserForm({
                                        ...newUserForm,
                                        roles: newUserForm.roles.filter(
                                          (r) => r !== role.id,
                                        ),
                                      });
                                    }
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-zinc-300"
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-zinc-900">
                                    {role.name}
                                  </div>
                                  {role.description && (
                                    <div className="text-sm text-zinc-600">
                                      {role.description}
                                    </div>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {formError && <Alert tone="error">{formError}</Alert>}
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateUser}
                      className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
                      disabled={busy}
                    >
                      {busy ? "Creating…" : "Create"}
                    </button>
                  </div>
                </>
              )}

              {/* Bulk roles */}
              {modalType === "bulkRoles" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Bulk action</div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        Assign roles
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        This will set the selected roles for{" "}
                        <span className="font-semibold">{selectedCount}</span>{" "}
                        users.
                      </p>
                    </div>
                    <button
                      className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600"
                      onClick={() => setShowModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 max-h-64 overflow-y-auto rounded-2xl border bg-white">
                    <div className="divide-y">
                      {roles.map((role) => {
                        const checked = selectedRoles.includes(role.id);
                        return (
                          <label
                            key={role.id}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked)
                                  setSelectedRoles([...selectedRoles, role.id]);
                                else
                                  setSelectedRoles(
                                    selectedRoles.filter((r) => r !== role.id),
                                  );
                              }}
                              className="mt-1 h-4 w-4 rounded border-zinc-300"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900">
                                {role.name}
                              </div>
                              {role.description && (
                                <div className="text-sm text-zinc-600">
                                  {role.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkAssignRoles}
                      className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
                      disabled={busy || selectedRoles.length === 0}
                      title={
                        selectedRoles.length === 0
                          ? "Select at least one role"
                          : ""
                      }
                    >
                      {busy ? "Applying…" : "Apply roles"}
                    </button>
                  </div>
                </>
              )}

              {/* Bulk delete */}
              {modalType === "bulkDelete" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Bulk action</div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        Delete selected users
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        This will delete{" "}
                        <span className="font-semibold">{selectedCount}</span>{" "}
                        users.
                      </p>
                    </div>
                    <button
                      className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600"
                      onClick={() => setShowModal(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    Type <span className="font-semibold">DELETE</span> to
                    confirm.
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-600 mb-2">
                      Confirm
                    </label>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                    />
                  </div>

                  {formError && (
                    <div className="mt-4">
                      <Alert tone="error">{formError}</Alert>
                    </div>
                  )}

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition disabled:opacity-50"
                      disabled={busy}
                    >
                      {busy ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
