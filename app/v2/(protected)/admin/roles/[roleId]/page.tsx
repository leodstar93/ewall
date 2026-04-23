"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import Table, { type ColumnDef } from "../../components/ui/Table";
import tableStyles from "../../components/ui/DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Permission {
  id: string;
  key: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions?: Permission[];
  users?: Array<{ id: string; name: string; email: string }>;
}

type Toast = { id: string; type: "success" | "error" | "info"; message: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RoleDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const roleId = params.roleId as string;

  const [role, setRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ description: "" });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const isAdmin = !!session?.user?.roles?.includes("ADMIN");

  // ─── Toast helpers ─────────────────────────────────────────────────────────

  const pushToast = (t: Omit<Toast, "id">) => {
    const id = uid();
    setToasts((prev) => [{ id, ...t }, ...prev]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500);
  };

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const roleRes = await fetch(`/api/v1/roles/${roleId}`);
        if (!roleRes.ok) throw new Error("Failed to fetch role");
        const roleData = await roleRes.json();
        setRole(roleData);
        setFormData({ description: roleData.description || "" });
        setSelectedPermissions((roleData.permissions || []).map((p: Permission) => p.id));

        const permsRes = await fetch("/api/v1/permissions");
        if (permsRes.ok) {
          const permsData = await permsRes.json();
          setAllPermissions(permsData.permissions || permsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        pushToast({ type: "error", message: "Failed to load role details" });
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin && roleId) fetchData();
  }, [roleId, isAdmin]);

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleSaveDescription = async () => {
    try {
      const res = await fetch(`/api/v1/roles/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: formData.description || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRole(updated);
        setIsEditing(false);
        pushToast({ type: "success", message: "Role description updated" });
      } else {
        pushToast({ type: "error", message: "Failed to update role description" });
      }
    } catch (updateError) {
      console.error("Error updating role:", updateError);
      pushToast({ type: "error", message: "An error occurred" });
    }
  };

  const handleTogglePermission = async (permissionId: string) => {
    const isSelected = selectedPermissions.includes(permissionId);
    const newSelected = isSelected
      ? selectedPermissions.filter((id) => id !== permissionId)
      : [...selectedPermissions, permissionId];

    setSelectedPermissions(newSelected);

    try {
      const res = await fetch(`/api/v1/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: newSelected }),
      });
      if (res.ok) {
        pushToast({ type: "success", message: isSelected ? "Permission removed" : "Permission added" });
      } else {
        setSelectedPermissions(selectedPermissions);
        pushToast({ type: "error", message: "Failed to update permissions" });
      }
    } catch {
      setSelectedPermissions(selectedPermissions);
      pushToast({ type: "error", message: "An error occurred" });
    }
  };

  // ─── Users table columns ───────────────────────────────────────────────────

  const userColumns: ColumnDef<{ id: string; name: string; email: string }>[] = [
    {
      key: "name",
      label: "Name",
      render: (value) => <span className={tableStyles.nameCell}>{value as string}</span>,
    },
    {
      key: "email",
      label: "Email",
      render: (value) => <span className={tableStyles.muteCell}>{value as string}</span>,
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, user) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link
            href={`/v2/admin/users/${user.id}`}
            aria-label="View user"
            title="View user"
            className={iconButtonClasses({ variant: "default" })}
          >
            <ActionIcon name="view" />
          </Link>
        </div>
      ),
    },
  ];

  // ─── Loading / guard ───────────────────────────────────────────────────────

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className={tableStyles.card} style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "#c00" }}>Role not found</p>
        <Link href="/v2/admin/roles" style={{ color: "var(--r)", fontSize: 13, marginTop: 8, display: "inline-block" }}>
          ← Back to Roles
        </Link>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-2xl border bg-white p-4 shadow-lg text-sm ${t.type === "success" ? "border-emerald-100 text-emerald-800" : t.type === "error" ? "border-red-100 text-red-800" : "border-zinc-200 text-zinc-800"}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <Link href="/v2/admin/roles" style={{ fontSize: 12, color: "var(--r)", textDecoration: "none" }}>
              ← Back to Roles
            </Link>
            <div className={tableStyles.title} style={{ fontSize: 18, marginTop: 4 }}>{role.name}</div>
          </div>
        </div>
      </div>

      {/* Role info */}
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div className={tableStyles.title}>Role Information</div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className={tableStyles.subtitle} style={{ marginBottom: 4 }}>Role Name</div>
            <div className={tableStyles.nameCell}>{role.name}</div>
          </div>
          <div>
            <div className={tableStyles.subtitle} style={{ marginBottom: 4 }}>Description</div>
            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ description: e.target.value })}
                  rows={3}
                  placeholder="Enter role description"
                  style={{ width: "100%", border: "1px solid var(--br)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={handleSaveDescription} className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}>Save</button>
                  <button type="button" onClick={() => { setIsEditing(false); setFormData({ description: role.description || "" }); }} className={tableStyles.btn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <span className={tableStyles.muteCell}>{role.description || "No description"}</span>
                <button type="button" onClick={() => setIsEditing(true)} className={tableStyles.btn}>Edit</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div className={tableStyles.title}>Permissions</div>
          <div className={tableStyles.subtitle}>{selectedPermissions.length} of {allPermissions.length} assigned</div>
        </div>
        <div style={{ padding: "12px 0", maxHeight: 320, overflowY: "auto" }}>
          {allPermissions.length === 0 ? (
            <div style={{ padding: "16px 20px", color: "#aaa", fontSize: 13 }}>No permissions available</div>
          ) : (
            allPermissions.map((permission) => (
              <label key={permission.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid var(--brl)" }}>
                <input
                  type="checkbox"
                  id={`perm-${permission.id}`}
                  checked={selectedPermissions.includes(permission.id)}
                  onChange={() => handleTogglePermission(permission.id)}
                  style={{ marginTop: 2, width: 14, height: 14, cursor: "pointer", flexShrink: 0 }}
                />
                <div>
                  <div className={tableStyles.nameCell}>{permission.key}</div>
                  {permission.description && <div className={tableStyles.muteCell} style={{ fontSize: 12, marginTop: 2 }}>{permission.description}</div>}
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Users with this role */}
      <Table
        data={role.users ?? []}
        columns={userColumns}
        title="Users with this Role"
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Users", value: role.users?.length || 0 },
          { label: "Assigned Permissions", value: selectedPermissions.length },
          { label: "Available Permissions", value: allPermissions.length },
        ].map(({ label, value }) => (
          <div key={label} className={tableStyles.card} style={{ padding: "16px 20px" }}>
            <div className={tableStyles.subtitle}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "var(--b)", marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
