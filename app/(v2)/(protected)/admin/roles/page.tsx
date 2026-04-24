"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ActionIcon, IconButton, iconButtonClasses } from "@/components/ui/icon-button";
import Table, { type ColumnDef, type TableAction } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  description: string | null;
  _count?: { users: number; permissions: number };
}

type Toast = { id: string; type: "success" | "error" | "info"; title: string; message?: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isAdmin = useMemo(() => !!session?.user?.roles?.includes("ADMIN"), [session]);

  // ─── Toast helpers ─────────────────────────────────────────────────────────

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = uid();
    setToasts((prev) => [{ id, ...t }, ...prev]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500);
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((x) => x.id !== id));

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/roles");
        if (res.ok) {
          const data = await res.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        } else {
          pushToast({ type: "error", title: "Failed to load roles", message: "Please try again." });
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
        pushToast({ type: "error", title: "Network error", message: "Could not fetch roles." });
      } finally {
        setLoading(false);
      }
    };
    if (isAdmin) fetchRoles();
  }, [isAdmin]);

  // ─── Modal openers ─────────────────────────────────────────────────────────

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

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleAddRole = async () => {
    setFormError("");
    const trimmed = formData.name.trim();
    if (!trimmed) return setFormError("Role name is required");
    const upper = trimmed.toUpperCase();
    if (roles.some((r) => r.name === upper)) return setFormError("A role with that name already exists");

    try {
      const res = await fetch("/api/v1/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: upper, description: formData.description || null }),
      });
      if (res.ok) {
        const newRole = await res.json();
        setRoles((prev) => [newRole, ...prev]);
        setShowModal(false);
        setFormData({ name: "", description: "" });
        pushToast({ type: "success", title: "Role created", message: `${upper} is ready.` });
      } else {
        const error = await res.json().catch(() => ({}));
        const msg = error.error || "Failed to create role";
        setFormError(msg);
        pushToast({ type: "error", title: "Create failed", message: msg });
      }
    } catch (error) {
      console.error("Error creating role:", error);
      setFormError("Error creating role");
      pushToast({ type: "error", title: "Network error", message: "Could not create role." });
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    try {
      const res = await fetch(`/api/v1/roles/${selectedRole.id}`, { method: "DELETE" });
      if (res.ok) {
        const deletedName = selectedRole.name;
        setRoles((prev) => prev.filter((r) => r.id !== selectedRole.id));
        setShowModal(false);
        setSelectedRole(null);
        pushToast({ type: "success", title: "Role deleted", message: `${deletedName} removed.` });
      } else {
        const error = await res.json().catch(() => ({}));
        const msg = error.error || "Failed to delete role";
        pushToast({ type: "error", title: "Delete failed", message: msg });
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      pushToast({ type: "error", title: "Network error", message: "Could not delete role." });
    }
  };

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        key: "name",
        label: "Role",
        render: (_, role) => {
          const usersCount = role._count?.users || 0;
          const locked = role.name === "ADMIN" || usersCount > 0;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                {(role.name[0] || "R").toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={tableStyles.nameCell}>{role.name}</span>
                  <Badge tone={role.name === "ADMIN" ? "dark" : "info"} variant={role.name === "ADMIN" ? "solid" : "light"}>
                    {role.name === "ADMIN" ? "System" : "Custom"}
                  </Badge>
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {locked
                    ? role.name === "ADMIN"
                      ? "Protected system role"
                      : "Delete disabled while users are assigned"
                    : "Role available for updates"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "description",
        label: "Description",
        render: (value) => (
          <span className={tableStyles.muteCell}>{(value as string | null) || "No description"}</span>
        ),
      },
      {
        key: "_users",
        label: "Users",
        sortable: false,
        render: (_, role) => <Badge tone="info">{role._count?.users || 0}</Badge>,
      },
      {
        key: "_perms",
        label: "Permissions",
        sortable: false,
        render: (_, role) => <Badge tone="success">{role._count?.permissions || 0}</Badge>,
      },
      {
        key: "_actions",
        label: "Actions",
        sortable: false,
        render: (_, role) => {
          const usersCount = role._count?.users || 0;
          const locked = role.name === "ADMIN" || usersCount > 0;
          return (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
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
          );
        },
      },
    ],
    [],
  );

  const tableActions: TableAction[] = [
    {
      label: "Add role",
      variant: "primary",
      onClick: handleOpenAddModal,
      icon: (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="7" y1="1" x2="7" y2="13" />
          <line x1="1" y1="7" x2="13" y2="7" />
        </svg>
      ),
    },
  ];

  // ─── Loading / guard ───────────────────────────────────────────────────────

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
          <div className="mt-3 text-center text-sm text-zinc-600">Loading roles...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[92vw] max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl border bg-white p-4 shadow-lg ${t.type === "success" ? "border-emerald-100" : t.type === "error" ? "border-red-100" : "border-zinc-200"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{t.title}</p>
                {t.message && <p className="mt-1 text-sm text-zinc-600">{t.message}</p>}
              </div>
              <button onClick={() => removeToast(t.id)} className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" aria-label="Dismiss">x</button>
            </div>
          </div>
        ))}
      </div>


      {/* Table */}
      <Table
        data={roles}
        columns={columns}
        actions={tableActions}
        searchKeys={["name", "description"]}
        title="Roles"
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">

            {/* Add */}
            {modalType === "add" && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">Create role</h3>
                    <p className="mt-1 text-sm text-zinc-600">Names are stored in uppercase for consistency.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" aria-label="Close">x</button>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-800">Role name</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., EDITOR, VIEWER, SUPPORT" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-800">Description (optional)</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe this role's purpose..." rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10" />
                  </div>
                  {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">Cancel</button>
                  <button onClick={handleAddRole} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">Create</button>
                </div>
              </>
            )}

            {/* Delete */}
            {modalType === "delete" && selectedRole && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">Delete role</h3>
                    <p className="mt-1 text-sm text-zinc-600">This action cannot be undone.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" aria-label="Close">x</button>
                </div>
                <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">You&apos;re about to delete <span className="font-semibold text-zinc-900">{selectedRole.name}</span>.</p>
                  <p className="mt-2 text-xs text-zinc-500">Tip: unassign users first if you&apos;re reorganizing access.</p>
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">Cancel</button>
                  <button onClick={handleDeleteRole} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">Delete</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
