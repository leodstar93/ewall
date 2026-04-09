"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActionIcon, IconButton, iconButtonClasses } from "@/components/ui/icon-button";
import Table, { type ColumnDef, type TableAction } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  roles: Array<{ role: { id: string; name: string } }>;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

type ModalType = "roles" | "delete" | "add" | "bulkRoles" | "bulkDelete";

// ─── Small UI helpers (kept local) ───────────────────────────────────────────

function Alert({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function RoleBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
      {children}
    </span>
  );
}

function getImpersonationDestination(permissions: string[]) {
  if (permissions.includes("settings:read")) return "/settings";
  if (permissions.includes("dashboard:access")) return "/settings";
  if (permissions.includes("documents:read")) return "/documents";
  if (permissions.includes("truck:read")) return "/trucks";
  if (permissions.includes("ifta:read")) return "/ifta";
  if (permissions.includes("ucr:read")) return "/ucr";
  if (permissions.includes("dmv:read")) return "/dmv";
  if (permissions.includes("compliance2290:view")) return "/2290";
  return "/settings";
}

// ─── Page ────────────────────────────────────────────────────────────────────

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

  const [newUserForm, setNewUserForm] = useState({ email: "", name: "", password: "", roles: [] as string[] });
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ tone: "success" | "error"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !session?.user?.roles?.includes("ADMIN")) {
      router.replace("/panel");
    }
  }, [status, session, router]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!showModal) return;
      const el = modalRef.current;
      if (el && !el.contains(e.target as Node)) setShowModal(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [showModal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, rolesRes] = await Promise.all([fetch("/api/v1/users"), fetch("/api/v1/roles")]);
        if (usersRes.ok) {
          const d = await usersRes.json();
          setUsers(Array.isArray(d) ? d : d.data || []);
        }
        if (rolesRes.ok) {
          const d = await rolesRes.json();
          setRoles(Array.isArray(d) ? d : d.data || []);
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

  // ─── Selection helpers ─────────────────────────────────────────────────────

  const isSelected = (id: string) => selectedIds.has(id);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ─── Modal openers ─────────────────────────────────────────────────────────

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

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/v1/users/${selectedUser.id}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });
      if (!res.ok) throw new Error("Failed to update roles");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, roles: selectedRoles.map((roleId) => ({ role: roles.find((r) => r.id === roleId)! })) }
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
    if (confirmText.trim().toLowerCase() !== selectedUser.email.trim().toLowerCase()) {
      setFormError("Type the user's email exactly to confirm deletion.");
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(`/api/v1/users/${selectedUser.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
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
    if (!newUserForm.password.trim()) return setFormError("Password is required");
    try {
      setBusy(true);
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserForm.email, name: newUserForm.name || null, password: newUserForm.password, roleIds: newUserForm.roles }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || "Failed to create user");
        return;
      }
      const newUser = await res.json();
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

  const handleBulkAssignRoles = async () => {
    if (selectedIds.size === 0) return;
    try {
      setBusy(true);
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/v1/users/${id}/roles`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleIds: selectedRoles }),
          }).then((r) => { if (!r.ok) throw new Error("bulk roles failed"); }),
        ),
      );
      setUsers((prev) =>
        prev.map((u) =>
          !selectedIds.has(u.id) ? u : { ...u, roles: selectedRoles.map((roleId) => ({ role: roles.find((r) => r.id === roleId)! })) },
        ),
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
          fetch(`/api/v1/users/${id}`, { method: "DELETE" }).then((r) => { if (!r.ok) throw new Error("bulk delete failed"); }),
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
      const updatedSession = await update({ impersonation: { action: "start", targetUserId: user.id } });
      if (updatedSession?.user?.id !== user.id) throw new Error("Could not start impersonation for this user.");
      const nextPermissions = Array.isArray(updatedSession.user.permissions) ? updatedSession.user.permissions : [];
      const destination = getImpersonationDestination(nextPermissions);
      setToast({ tone: "success", msg: `Now acting as ${user.name || user.email}.` });
      window.location.assign(destination);
    } catch (error) {
      console.error(error);
      setToast({ tone: "error", msg: "Could not login as this user." });
    } finally {
      setImpersonatingUserId(null);
    }
  };

  // ─── Table columns (defined here to close over state) ─────────────────────

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        key: "_sel",
        label: "",
        sortable: false,
        render: (_, user) => (
          <input
            type="checkbox"
            checked={isSelected(user.id)}
            onChange={() => toggleSelected(user.id)}
            className="h-4 w-4 rounded border-zinc-300"
            aria-label={`Select ${user.email}`}
          />
        ),
        cellClass: tableStyles.idCell,
      },
      {
        key: "name",
        label: "User",
        render: (_, user) => {
          const letter = ((user.name || user.email || "U")[0] || "U").toUpperCase();
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className={tableStyles.avatar} style={{ width: 34, height: 34, borderRadius: 8, background: "var(--b)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
                {letter}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={tableStyles.nameCell}>{user.name || "No name"}</div>
                <button onClick={() => copyToClipboard(user.id)} style={{ fontSize: 11, color: "#aaa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Copy ID
                </button>
              </div>
            </div>
          );
        },
      },
      {
        key: "email",
        label: "Email",
        render: (_, user) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={tableStyles.muteCell}>{user.email}</span>
            <button onClick={() => copyToClipboard(user.email)} style={{ fontSize: 11, color: "#aaa", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Copy
            </button>
          </div>
        ),
      },
      {
        key: "_roles",
        label: "Roles",
        sortable: false,
        render: (_, user) =>
          user.roles.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {user.roles.map((r) => <RoleBadge key={r.role.id}>{r.role.name}</RoleBadge>)}
            </div>
          ) : (
            <span className={tableStyles.muteCell}>No roles</span>
          ),
      },
      {
        key: "createdAt",
        label: "Created",
        render: (value) => <span className={tableStyles.muteCell}>{new Date(value as string).toLocaleDateString()}</span>,
      },
      {
        key: "_actions",
        label: "Actions",
        sortable: false,
        render: (_, user) => (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <Link
              href={`/v2/admin/users/${user.id}`}
              aria-label="View user"
              title="View user"
              className={iconButtonClasses({ variant: "default" })}
            >
              <ActionIcon name="view" />
            </Link>
            <IconButton onClick={() => openRolesModal(user)} label="Manage roles" icon="roles" />
            <IconButton
              onClick={() => void handleLoginAsUser(user)}
              disabled={impersonatingUserId === user.id || session?.user?.id === user.id}
              variant="brand"
              label={session?.user?.id === user.id ? "Current user" : impersonatingUserId === user.id ? "Opening..." : "Login as this user"}
              icon="login"
            />
            <IconButton onClick={() => openDeleteModal(user)} variant="danger" label="Delete user" icon="delete" />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, impersonatingUserId, session?.user?.id],
  );

  const tableActions: TableAction[] = [
    {
      label: "Add user",
      variant: "primary",
      onClick: openAddModal,
      icon: (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="7" y1="1" x2="7" y2="13" />
          <line x1="1" y1="7" x2="13" y2="7" />
        </svg>
      ),
    },
  ];

  // ─── Loading / auth guard ──────────────────────────────────────────────────

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
          <div className="mt-3 text-center text-sm text-zinc-600">Loading users…</div>
        </div>
      </div>
    );
  }

  if (!session?.user?.roles?.includes("ADMIN")) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Toast */}
      {toast && <Alert tone={toast.tone}>{toast.msg}</Alert>}

      {/* Bulk bar */}
      {selectedCount > 0 && (
        <div className={tableStyles.card} style={{ padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--b)", fontWeight: 500 }}>
              {selectedCount} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={openBulkRolesModal} className={tableStyles.btn}>Assign roles</button>
              <button type="button" onClick={openBulkDeleteModal} className={tableStyles.btn} style={{ color: "#c00", borderColor: "#fca5a5" }}>Delete selected</button>
              <button type="button" onClick={clearSelection} className={tableStyles.btn}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Table
        data={users}
        columns={columns}
        actions={tableActions}
        title="Users"
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div ref={modalRef} className="relative w-full max-w-md rounded-2xl border bg-white shadow-xl">
            <div className="p-6">

              {/* Roles */}
              {modalType === "roles" && selectedUser && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Edit roles</div>
                      <h3 className="text-base font-semibold text-zinc-900">{selectedUser.name || selectedUser.email}</h3>
                      <p className="mt-1 text-sm text-zinc-600">Select roles for this user.</p>
                    </div>
                    <button className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600" onClick={() => setShowModal(false)}>✕</button>
                  </div>
                  <div className="mt-6 max-h-64 overflow-y-auto rounded-2xl border bg-white">
                    <div className="divide-y">
                      {roles.map((role) => {
                        const checked = selectedRoles.includes(role.id);
                        return (
                          <label key={role.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setSelectedRoles([...selectedRoles, role.id]); else setSelectedRoles(selectedRoles.filter((r) => r !== role.id)); }} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900">{role.name}</div>
                              {role.description && <div className="text-sm text-zinc-600">{role.description}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition" disabled={busy}>Cancel</button>
                    <button onClick={handleSaveRoles} className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                  </div>
                </>
              )}

              {/* Delete */}
              {modalType === "delete" && selectedUser && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Danger zone</div>
                      <h3 className="text-base font-semibold text-zinc-900">Delete user</h3>
                      <p className="mt-1 text-sm text-zinc-600">Type the user email to confirm deletion.</p>
                    </div>
                    <button className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600" onClick={() => setShowModal(false)}>✕</button>
                  </div>
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    You are deleting <span className="font-semibold">{selectedUser.email}</span>. This cannot be undone.
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-600 mb-2">Confirm email</label>
                    <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={selectedUser.email} className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10" />
                  </div>
                  {formError && <div className="mt-4"><Alert tone="error">{formError}</Alert></div>}
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition" disabled={busy}>Cancel</button>
                    <button onClick={handleConfirmDelete} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition disabled:opacity-50" disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
                  </div>
                </>
              )}

              {/* Add */}
              {modalType === "add" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Create</div>
                      <h3 className="text-base font-semibold text-zinc-900">New user</h3>
                      <p className="mt-1 text-sm text-zinc-600">Create a user and optionally assign roles.</p>
                    </div>
                    <button className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600" onClick={() => setShowModal(false)}>✕</button>
                  </div>
                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">Email *</label>
                      <input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} placeholder="user@example.com" className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">Name</label>
                      <input type="text" value={newUserForm.name} onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })} placeholder="Full name" className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">Password *</label>
                      <input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} placeholder="Enter password" className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-2">Roles</label>
                      <div className="max-h-36 overflow-y-auto rounded-2xl border bg-white">
                        <div className="divide-y">
                          {roles.map((role) => {
                            const checked = newUserForm.roles.includes(role.id);
                            return (
                              <label key={role.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                                <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setNewUserForm({ ...newUserForm, roles: [...newUserForm.roles, role.id] }); else setNewUserForm({ ...newUserForm, roles: newUserForm.roles.filter((r) => r !== role.id) }); }} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-zinc-900">{role.name}</div>
                                  {role.description && <div className="text-sm text-zinc-600">{role.description}</div>}
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
                    <button onClick={() => setShowModal(false)} className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition" disabled={busy}>Cancel</button>
                    <button onClick={handleCreateUser} className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
                  </div>
                </>
              )}

              {/* Bulk roles */}
              {modalType === "bulkRoles" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Bulk action</div>
                      <h3 className="text-base font-semibold text-zinc-900">Assign roles</h3>
                      <p className="mt-1 text-sm text-zinc-600">This will set the selected roles for <span className="font-semibold">{selectedCount}</span> users.</p>
                    </div>
                    <button className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600" onClick={() => setShowModal(false)}>✕</button>
                  </div>
                  <div className="mt-6 max-h-64 overflow-y-auto rounded-2xl border bg-white">
                    <div className="divide-y">
                      {roles.map((role) => {
                        const checked = selectedRoles.includes(role.id);
                        return (
                          <label key={role.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setSelectedRoles([...selectedRoles, role.id]); else setSelectedRoles(selectedRoles.filter((r) => r !== role.id)); }} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-zinc-900">{role.name}</div>
                              {role.description && <div className="text-sm text-zinc-600">{role.description}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition" disabled={busy}>Cancel</button>
                    <button onClick={handleBulkAssignRoles} className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50" disabled={busy || selectedRoles.length === 0}>{busy ? "Applying…" : "Apply roles"}</button>
                  </div>
                </>
              )}

              {/* Bulk delete */}
              {modalType === "bulkDelete" && (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Bulk action</div>
                      <h3 className="text-base font-semibold text-zinc-900">Delete selected users</h3>
                      <p className="mt-1 text-sm text-zinc-600">This will delete <span className="font-semibold">{selectedCount}</span> users.</p>
                    </div>
                    <button className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600" onClick={() => setShowModal(false)}>✕</button>
                  </div>
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    Type <span className="font-semibold">DELETE</span> to confirm.
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-zinc-600 mb-2">Confirm</label>
                    <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10" />
                  </div>
                  {formError && <div className="mt-4"><Alert tone="error">{formError}</Alert></div>}
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition" disabled={busy}>Cancel</button>
                    <button onClick={handleBulkDelete} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition disabled:opacity-50" disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
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
