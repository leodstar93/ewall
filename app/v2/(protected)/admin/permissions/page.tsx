"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import Table, { type ColumnDef, type TableAction } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type Toast = { id: string; type: "success" | "error" | "info"; title: string; message?: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminPermissionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"add" | "delete" | "assignRoles">("add");
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({ key: "", description: "" });
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
    const fetchData = async () => {
      try {
        setLoading(true);
        const [permRes, rolesRes] = await Promise.all([fetch("/api/v1/permissions"), fetch("/api/v1/roles")]);
        if (permRes.ok) {
          const data = await permRes.json();
          setPermissions(Array.isArray(data) ? data : data.data || []);
        } else {
          pushToast({ type: "error", title: "Failed to load permissions", message: "Please try again." });
        }
        if (rolesRes.ok) {
          const data = await rolesRes.json();
          setRoles(Array.isArray(data) ? data : data.data || []);
        } else {
          pushToast({ type: "error", title: "Failed to load roles", message: "Permissions page needs roles to assign." });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        pushToast({ type: "error", title: "Network error", message: "Could not fetch permissions/roles." });
      } finally {
        setLoading(false);
      }
    };
    if (isAdmin) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ─── Modal openers ─────────────────────────────────────────────────────────

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

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleAddPermission = async () => {
    setFormError("");
    const key = formData.key.trim().toLowerCase();
    if (!key) return setFormError("Permission key is required");
    if (permissions.some((p) => p.key === key)) return setFormError("This permission key already exists");

    try {
      const res = await fetch("/api/v1/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, description: formData.description || null }),
      });
      if (res.ok) {
        const newPermission = await res.json();
        setPermissions((prev) => [newPermission, ...prev]);
        setShowModal(false);
        setFormData({ key: "", description: "" });
        pushToast({ type: "success", title: "Permission created", message: key });
      } else {
        const error = await res.json().catch(() => ({}));
        const msg = error.error || "Failed to create permission";
        setFormError(msg);
        pushToast({ type: "error", title: "Create failed", message: msg });
      }
    } catch (error) {
      console.error("Error creating permission:", error);
      setFormError("Error creating permission");
      pushToast({ type: "error", title: "Network error", message: "Could not create permission." });
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedPermission) return;
    try {
      const res = await fetch(`/api/v1/permissions/${selectedPermission.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });
      if (res.ok) {
        setPermissions((prev) =>
          prev.map((p) => {
            if (p.id !== selectedPermission.id) return p;
            const mappedRoles = selectedRoles
              .map((roleId) => roles.find((r) => r.id === roleId))
              .filter(Boolean)
              .map((role) => ({ role: role! }));
            return { ...p, roles: mappedRoles, _count: { roles: selectedRoles.length } };
          }),
        );
        setShowModal(false);
        const key = selectedPermission.key;
        setSelectedPermission(null);
        pushToast({ type: "success", title: "Roles updated", message: key });
      } else {
        pushToast({ type: "error", title: "Update failed", message: "Failed to update roles." });
      }
    } catch (error) {
      console.error("Error updating roles:", error);
      pushToast({ type: "error", title: "Network error", message: "Could not update roles." });
    }
  };

  const handleDeletePermission = async () => {
    if (!selectedPermission) return;
    try {
      const res = await fetch(`/api/v1/permissions/${selectedPermission.id}`, { method: "DELETE" });
      if (res.ok) {
        const deletedKey = selectedPermission.key;
        setPermissions((prev) => prev.filter((p) => p.id !== selectedPermission.id));
        setShowModal(false);
        setSelectedPermission(null);
        pushToast({ type: "success", title: "Permission deleted", message: deletedKey });
      } else {
        const error = await res.json().catch(() => ({}));
        pushToast({ type: "error", title: "Delete failed", message: error.error || "Failed to delete permission" });
      }
    } catch (error) {
      console.error("Error deleting permission:", error);
      pushToast({ type: "error", title: "Network error", message: "Could not delete permission." });
    }
  };

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Permission>[]>(
    () => [
      {
        key: "key",
        label: "Permission",
        render: (_, permission) => {
          const roleCount = permission._count?.roles ?? permission.roles?.length ?? 0;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                {(permission.key[0] || "P").toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: "var(--b)" }}>{permission.key}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {roleCount > 0 ? `${roleCount} role(s) assigned` : "Not assigned"}
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
        key: "_roles",
        label: "Roles",
        sortable: false,
        render: (_, permission) =>
          permission.roles && permission.roles.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {permission.roles.slice(0, 4).map((r) => (
                <Badge key={r.role.id} tone="primary">{r.role.name}</Badge>
              ))}
              {permission.roles.length > 4 && <Badge tone="light">+{permission.roles.length - 4}</Badge>}
            </div>
          ) : (
            <span className={tableStyles.muteCell}>No roles</span>
          ),
      },
      {
        key: "_count",
        label: "Assigned",
        sortable: false,
        render: (_, permission) => {
          const roleCount = permission._count?.roles ?? permission.roles?.length ?? 0;
          return <Badge tone={roleCount > 0 ? "success" : "light"}>{roleCount}</Badge>;
        },
      },
      {
        key: "_actions",
        label: "Actions",
        sortable: false,
        render: (_, permission) => (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <IconButton onClick={() => handleOpenAssignRolesModal(permission)} label="Assign roles" icon="roles" />
            <IconButton onClick={() => handleOpenDeleteModal(permission)} variant="danger" label="Delete permission" icon="delete" />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const tableActions: TableAction[] = [
    {
      label: "Add permission",
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
          <div className="mt-3 text-center text-sm text-zinc-600">Loading permissions...</div>
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
          <div key={t.id} className={`pointer-events-auto rounded-2xl border bg-white p-4 shadow-lg ${t.type === "success" ? "border-emerald-100" : t.type === "error" ? "border-red-100" : "border-zinc-200"}`}>
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
        data={permissions}
        columns={columns}
        actions={tableActions}
        searchKeys={["key", "description"]}
        title="Permissions"
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
                    <h3 className="text-base font-semibold text-zinc-900">Create permission</h3>
                    <p className="mt-1 text-sm text-zinc-600">Use <span className="font-mono">resource:action</span>. Stored in lowercase.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" aria-label="Close">x</button>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-800">Permission key</label>
                    <input type="text" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} placeholder="e.g., users:read" className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10" />
                    <p className="mt-1 text-xs text-zinc-500">Tip: add <span className="font-mono">:manage</span> for admins of a module.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-800">Description (optional)</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe what this permission allows..." rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/10" />
                  </div>
                  {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">Cancel</button>
                  <button onClick={handleAddPermission} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">Create</button>
                </div>
              </>
            )}

            {/* Assign roles */}
            {modalType === "assignRoles" && selectedPermission && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">Assign roles</h3>
                    <p className="mt-1 text-sm text-zinc-600">Permission: <span className="font-mono font-semibold text-zinc-900">{selectedPermission.key}</span></p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" aria-label="Close">x</button>
                </div>
                <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                  {roles.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label key={role.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition hover:bg-zinc-50 ${checked ? "ring-2 ring-zinc-200" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setSelectedRoles((prev) => [...prev, role.id]); else setSelectedRoles((prev) => prev.filter((r) => r !== role.id)); }} className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">{role.name}</span>
                            {checked && <Badge tone="light">Selected</Badge>}
                          </div>
                          {role.description && <p className="mt-1 text-sm text-zinc-600">{role.description}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">Cancel</button>
                  <button onClick={handleSaveRoles} className="flex-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800">Save</button>
                </div>
              </>
            )}

            {/* Delete */}
            {modalType === "delete" && selectedPermission && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">Delete permission</h3>
                    <p className="mt-1 text-sm text-zinc-600">This cannot be undone.</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50" aria-label="Close">x</button>
                </div>
                <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-700">You're about to delete <span className="font-mono font-semibold text-zinc-900">{selectedPermission.key}</span>.</p>
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50">Cancel</button>
                  <button onClick={handleDeletePermission} className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">Delete</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
