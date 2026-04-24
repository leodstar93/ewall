"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ActionIcon, IconButton, iconButtonClasses } from "@/components/ui/icon-button";
import Table, { type ColumnDef, type TableAction } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";
import { getPostLoginRedirectPath } from "@/lib/navigation/post-login";

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  roles: Array<{ role: { id: string; name: string } }>;
  companyProfile?: {
    legalName: string | null;
    companyName: string | null;
  } | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

type ModalType = "roles" | "delete" | "add" | "invite" | "bulkRoles" | "bulkDelete";

// ─── Small UI helpers (kept local) ───────────────────────────────────────────

function RoleBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
      {children}
    </span>
  );
}

function getCompanyLegalName(user: User) {
  if (user.roles.some((r) => r.role.name === "STAFF")) return "STAFF";
  return user.companyProfile?.legalName || user.companyProfile?.companyName || "Not set";
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
  const [inviteForm, setInviteForm] = useState({ email: "", roleNames: ["TRUCKER", "USER"] as string[], note: "" });
  const [formError, setFormError] = useState("");
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
      router.replace(getPostLoginRedirectPath(session?.user?.roles));
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
        toast.error("Failed to load users/roles.");
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

  const openInviteModal = () => {
    setInviteForm({ email: "", roleNames: ["TRUCKER", "USER"], note: "" });
    setFormError("");
    setModalType("invite");
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
      toast.success("Roles updated.");
      setShowModal(false);
      setSelectedUser(null);
    } catch (e) {
      console.error(e);
      toast.error("Error updating roles.");
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
      toast.success("User deleted.");
      setShowModal(false);
      setSelectedUser(null);
      setConfirmText("");
    } catch (e) {
      console.error(e);
      toast.error("Error deleting user.");
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
      toast.success("User created.");
      setShowModal(false);
    } catch (e) {
      console.error(e);
      setFormError("Error creating user");
    } finally {
      setBusy(false);
    }
  };

  const handleSendInvite = async () => {
    setFormError("");
    if (!inviteForm.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    try {
      setBusy(true);
      const res = await fetch("/api/v1/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email.trim().toLowerCase(),
          roleNames: inviteForm.roleNames,
          note: inviteForm.note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setFormError(err.error || "Failed to send invitation.");
        return;
      }
      toast.success(`Invitation sent to ${inviteForm.email}.`);
      setShowModal(false);
    } catch {
      setFormError("Network error. Please try again.");
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
      toast.success("Roles updated for selected users.");
      setShowModal(false);
      clearSelection();
    } catch (e) {
      console.error(e);
      toast.error("Bulk role update failed.");
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
      toast.success("Selected users deleted.");
      setShowModal(false);
      clearSelection();
      setConfirmText("");
    } catch (e) {
      console.error(e);
      toast.error("Bulk delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const handleLoginAsUser = async (user: User) => {
    try {
      setImpersonatingUserId(user.id);
      const updatedSession = await update({ impersonation: { action: "start", targetUserId: user.id } });
      if (updatedSession?.user?.id !== user.id) throw new Error("Could not start impersonation for this user.");
      const nextRoles = Array.isArray(updatedSession.user.roles) ? updatedSession.user.roles : [];
      const destination = getPostLoginRedirectPath(nextRoles);
      toast.success(`Now acting as ${user.name || user.email}.`);
      window.location.assign(destination);
    } catch (error) {
      console.error(error);
      toast.error("Could not login as this user.");
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
        key: "_companyLegalName",
        label: "Legal name",
        sortable: false,
        render: (_, user) => (
          <span className={tableStyles.muteCell}>
            {getCompanyLegalName(user)}
          </span>
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
              href={`/admin/users/${user.id}`}
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
      label: "Invite user",
      variant: "default",
      onClick: openInviteModal,
      icon: (
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="3" width="12" height="9" rx="1.5" />
          <polyline points="1,3 7,8.5 13,3" />
        </svg>
      ),
    },
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
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} onClick={() => setShowModal(false)}>
          <div ref={modalRef} className={tableStyles.card} style={{ width: "100%", maxWidth: 440, boxShadow: "0 20px 40px rgba(0,0,0,0.12)", position: "relative" }} onClick={(e) => e.stopPropagation()}>

            {/* Roles */}
            {modalType === "roles" && selectedUser && (
              <>
                <div className={tableStyles.header}>
                  <div>
                    <div className={tableStyles.title}>{selectedUser.name || selectedUser.email}</div>
                    <div className={tableStyles.subtitle}>Select roles for this user.</div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} aria-label="Close">✕</button>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {roles.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label key={role.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid var(--brl)", background: checked ? "var(--bl)" : "transparent" }}>
                        <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setSelectedRoles([...selectedRoles, role.id]); else setSelectedRoles(selectedRoles.filter((r) => r !== role.id)); }} style={{ marginTop: 2, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }} />
                        <div>
                          <div className={tableStyles.nameCell}>{role.name}</div>
                          {role.description && <div className={tableStyles.subtitle} style={{ marginTop: 2 }}>{role.description}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} disabled={busy}>Cancel</button>
                  <button type="button" onClick={handleSaveRoles} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                </div>
              </>
            )}

            {/* Delete */}
            {modalType === "delete" && selectedUser && (
              <>
                <div className={tableStyles.header}>
                  <div>
                    <div className={tableStyles.title}>Delete user</div>
                    <div className={tableStyles.subtitle}>Type the user email to confirm deletion.</div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} aria-label="Close">✕</button>
                </div>
                <div style={{ padding: "12px 16px", background: "#fff0f0", borderBottom: "1px solid #fca5a5", fontSize: 13, color: "#c00" }}>
                  You are deleting <strong>{selectedUser.email}</strong>. This cannot be undone.
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className={tableStyles.subtitle}>Confirm email</div>
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={selectedUser.email} style={{ width: "100%", border: "1px solid var(--br)", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  {formError && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#c00" }}>{formError}</div>}
                </div>
                <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} disabled={busy}>Cancel</button>
                  <button type="button" onClick={handleConfirmDelete} className={tableStyles.btn} style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
                </div>
              </>
            )}

            {/* Add */}
            {modalType === "add" && (
              <>
                <div className={tableStyles.header}>
                  <div>
                    <div className={tableStyles.title}>New user</div>
                    <div className={tableStyles.subtitle}>Create a user and optionally assign roles.</div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} aria-label="Close">✕</button>
                </div>
                <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Email *", type: "email", value: newUserForm.email, onChange: (v: string) => setNewUserForm({ ...newUserForm, email: v }), placeholder: "user@example.com" },
                    { label: "Name", type: "text", value: newUserForm.name, onChange: (v: string) => setNewUserForm({ ...newUserForm, name: v }), placeholder: "Full name" },
                    { label: "Password *", type: "password", value: newUserForm.password, onChange: (v: string) => setNewUserForm({ ...newUserForm, password: v }), placeholder: "Enter password" },
                  ].map(({ label, type, value, onChange, placeholder }) => (
                    <div key={label}>
                      <div className={tableStyles.subtitle} style={{ marginBottom: 4 }}>{label}</div>
                      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", border: "1px solid var(--br)", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  ))}
                  <div>
                    <div className={tableStyles.subtitle} style={{ marginBottom: 4 }}>Roles</div>
                    <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--brl)", borderRadius: 6 }}>
                      {roles.map((role) => {
                        const checked = newUserForm.roles.includes(role.id);
                        return (
                          <label key={role.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--brl)", background: checked ? "var(--bl)" : "transparent" }}>
                            <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setNewUserForm({ ...newUserForm, roles: [...newUserForm.roles, role.id] }); else setNewUserForm({ ...newUserForm, roles: newUserForm.roles.filter((r) => r !== role.id) }); }} style={{ marginTop: 2, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }} />
                            <div>
                              <div className={tableStyles.nameCell}>{role.name}</div>
                              {role.description && <div className={tableStyles.subtitle} style={{ marginTop: 2 }}>{role.description}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {formError && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#c00" }}>{formError}</div>}
                </div>
                <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} disabled={busy}>Cancel</button>
                  <button type="button" onClick={handleCreateUser} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} disabled={busy}>{busy ? "Creating…" : "Create"}</button>
                </div>
              </>
            )}

            {/* Invite */}
            {modalType === "invite" && (
              <>
                <div className={tableStyles.header}>
                  <div>
                    <div className={tableStyles.title}>Invite user</div>
                    <div className={tableStyles.subtitle}>Send an email invitation with an onboarding link.</div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} aria-label="Close">✕</button>
                </div>
                <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div className={tableStyles.subtitle} style={{ marginBottom: 4 }}>Email *</div>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="user@example.com"
                      style={{ width: "100%", border: "1px solid var(--br)", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <div className={tableStyles.subtitle} style={{ marginBottom: 4 }}>Note (optional)</div>
                    <textarea
                      value={inviteForm.note}
                      onChange={(e) => setInviteForm({ ...inviteForm, note: e.target.value })}
                      placeholder="Welcome to EWALL!"
                      rows={2}
                      style={{ width: "100%", border: "1px solid var(--br)", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <div className={tableStyles.subtitle} style={{ marginBottom: 6 }}>Roles assigned on signup</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {["TRUCKER", "USER", "STAFF", "ADMIN"].map((roleName) => {
                        const checked = inviteForm.roleNames.includes(roleName);
                        return (
                          <label key={roleName} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1px solid ${checked ? "var(--b)" : "var(--br)"}`, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500, background: checked ? "var(--b)" : "transparent", color: checked ? "#fff" : "var(--b)" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) setInviteForm({ ...inviteForm, roleNames: [...inviteForm.roleNames, roleName] });
                                else setInviteForm({ ...inviteForm, roleNames: inviteForm.roleNames.filter((r) => r !== roleName) });
                              }}
                              style={{ display: "none" }}
                            />
                            {roleName}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {formError && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#c00" }}>{formError}</div>}
                </div>
                <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} disabled={busy}>Cancel</button>
                  <button type="button" onClick={() => void handleSendInvite()} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button>
                </div>
              </>
            )}

            {/* Bulk roles */}
            {modalType === "bulkRoles" && (
              <>
                <div className={tableStyles.header}>
                  <div>
                    <div className={tableStyles.title}>Assign roles</div>
                    <div className={tableStyles.subtitle}>This will set the selected roles for <strong>{selectedCount}</strong> users.</div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} aria-label="Close">✕</button>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {roles.map((role) => {
                    const checked = selectedRoles.includes(role.id);
                    return (
                      <label key={role.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid var(--brl)", background: checked ? "var(--bl)" : "transparent" }}>
                        <input type="checkbox" checked={checked} onChange={(e) => { if (e.target.checked) setSelectedRoles([...selectedRoles, role.id]); else setSelectedRoles(selectedRoles.filter((r) => r !== role.id)); }} style={{ marginTop: 2, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }} />
                        <div>
                          <div className={tableStyles.nameCell}>{role.name}</div>
                          {role.description && <div className={tableStyles.subtitle} style={{ marginTop: 2 }}>{role.description}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} disabled={busy}>Cancel</button>
                  <button type="button" onClick={handleBulkAssignRoles} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`} disabled={busy || selectedRoles.length === 0}>{busy ? "Applying…" : "Apply roles"}</button>
                </div>
              </>
            )}

            {/* Bulk delete */}
            {modalType === "bulkDelete" && (
              <>
                <div className={tableStyles.header}>
                  <div>
                    <div className={tableStyles.title}>Delete selected users</div>
                    <div className={tableStyles.subtitle}>This will delete <strong>{selectedCount}</strong> users.</div>
                  </div>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} aria-label="Close">✕</button>
                </div>
                <div style={{ padding: "12px 16px", background: "#fff0f0", borderBottom: "1px solid #fca5a5", fontSize: 13, color: "#c00" }}>
                  Type <strong>DELETE</strong> to confirm.
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className={tableStyles.subtitle}>Confirm</div>
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" style={{ width: "100%", border: "1px solid var(--br)", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  {formError && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#c00" }}>{formError}</div>}
                </div>
                <div className={tableStyles.header} style={{ borderTop: "1px solid var(--brl)", borderBottom: "none", justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" onClick={() => setShowModal(false)} className={tableStyles.btn} disabled={busy}>Cancel</button>
                  <button type="button" onClick={handleBulkDelete} className={tableStyles.btn} style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
