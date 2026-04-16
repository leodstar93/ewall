"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmptyState,
  Field,
  InlineAlert,
  LoadingPanel,
  PanelCard,
  StatusBadge,
  StickyActions,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";
import tableStyles from "../../components/ui/DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserDetail {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  roles: Array<{ role: Role }>;
}

type TabId = "account" | "roles" | "security";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "account", label: "Account" },
  { id: "roles", label: "Roles" },
  { id: "security", label: "Security" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UserProfileAdminClient({ userId }: { userId: string }) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Roles tab
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [initialRoles, setInitialRoles] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [rolesMessage, setRolesMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Security tab
  const [resettingPassword, setResettingPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const rolesDirty = useMemo(
    () =>
      JSON.stringify([...selectedRoles].sort()) !==
      JSON.stringify([...initialRoles].sort()),
    [selectedRoles, initialRoles],
  );

  // ─── Load ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setPageError("");
        setNotFound(false);

        const [uRes, rRes] = await Promise.all([
          fetch(`/api/v1/users/${userId}`, { cache: "no-store" }),
          fetch(`/api/v1/roles`, { cache: "no-store" }),
        ]);

        if (!active) return;

        if (uRes.status === 404) {
          setNotFound(true);
          return;
        }

        if (!uRes.ok) {
          throw new Error("Failed to load user.");
        }

        const userData: UserDetail = await uRes.json();
        const rolesPayload = await rRes.json().catch(() => ({}));
        const rolesData: Role[] = Array.isArray(rolesPayload)
          ? rolesPayload
          : rolesPayload.data || [];

        if (!active) return;

        setUser(userData);
        const currentRoleIds = userData.roles.map((r) => r.role.id);
        setSelectedRoles(currentRoleIds);
        setInitialRoles(currentRoleIds);
        setAllRoles(rolesData);
      } catch (loadError) {
        if (!active) return;
        setPageError(
          loadError instanceof Error ? loadError.message : "Failed to load user.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {
      if (active) setPageError("Failed to load user.");
    });

    return () => {
      active = false;
    };
  }, [userId]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveRoles = async () => {
    try {
      setSavingRoles(true);
      setRolesMessage(null);

      const res = await fetch(`/api/v1/users/${userId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleIds: selectedRoles }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to update roles.");

      const updatedUser: UserDetail = payload;
      setUser(updatedUser);
      const updatedRoleIds = updatedUser.roles.map((r) => r.role.id);
      setSelectedRoles(updatedRoleIds);
      setInitialRoles(updatedRoleIds);
      setRolesMessage({ tone: "success", message: "Roles updated successfully." });
    } catch (err) {
      setRolesMessage({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to update roles.",
      });
    } finally {
      setSavingRoles(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      setResettingPassword(true);
      setSecurityMessage(null);

      const res = await fetch(`/api/v1/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "reset-and-email" }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to reset password.");

      setSecurityMessage({
        tone: "success",
        message: body.message || "Temporary password sent to user email.",
      });
    } catch (err) {
      setSecurityMessage({
        tone: "error",
        message:
          err instanceof Error ? err.message : "Error resetting password.",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    const mustMatch = user?.email?.trim().toLowerCase() ?? "";
    if (confirmDelete.trim().toLowerCase() !== mustMatch) {
      setDeleteError("Type the user's email exactly to confirm deletion.");
      return;
    }
    try {
      setDeletingUser(true);
      setDeleteError("");

      const res = await fetch(`/api/v1/users/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete user.");
      }

      router.push("/v2/admin/users");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Error deleting user.",
      );
    } finally {
      setDeletingUser(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  // ─── States ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={tableStyles.card} style={{ padding: 24 }}>
        <div className={tableStyles.title} style={{ marginBottom: 8 }}>
          Loading user profile
        </div>
        <div className={tableStyles.subtitle} style={{ marginBottom: 20 }}>
          Fetching account details and roles.
        </div>
        <LoadingPanel />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={tableStyles.card} style={{ padding: 24 }}>
        <div className={tableStyles.title} style={{ marginBottom: 4 }}>
          User not found
        </div>
        <div className={tableStyles.subtitle} style={{ marginBottom: 20 }}>
          The user may have been deleted or does not exist.
        </div>
        <EmptyState
          title="No user profile available"
          description="Return to the user directory and choose a different user."
        />
        <div style={{ marginTop: 20 }}>
          <Link href="/v2/admin/users" className={tableStyles.btn}>
            ← Back to users
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={tableStyles.card} style={{ padding: 24 }}>
        <div className={tableStyles.title} style={{ marginBottom: 16 }}>
          Unable to load profile
        </div>
        <InlineAlert
          tone="error"
          message={pageError || "Failed to load user profile."}
        />
      </div>
    );
  }

  const displayName = user.name || user.email || "User";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Header */}
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <Link
              href="/v2/admin/users"
              style={{ fontSize: 12, color: "var(--r)", textDecoration: "none" }}
            >
              ← Back to users
            </Link>
            <div
              className={tableStyles.title}
              style={{ fontSize: 18, marginTop: 4 }}
            >
              {displayName}
            </div>
            <div className={tableStyles.subtitle}>
              Manage account roles and security settings for this platform user.
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {user.roles.length > 0 ? (
              user.roles.map((r) => (
                <StatusBadge key={r.role.id} tone="blue">
                  {r.role.name}
                </StatusBadge>
              ))
            ) : (
              <StatusBadge tone="zinc">No roles</StatusBadge>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div
          style={{
            padding: "0 20px 16px",
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {[
            { label: "Email", value: user.email || "—" },
            { label: "Joined", value: formatDateTime(user.createdAt) },
            { label: "Roles", value: String(user.roles.length) },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                borderRadius: 10,
                border: "1px solid var(--brl)",
                background: "var(--off)",
                padding: "10px 14px",
              }}
            >
              <div
                className={tableStyles.subtitle}
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                {label}
              </div>
              <div
                className={tableStyles.nameCell}
                style={{ fontSize: 13 }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className={tableStyles.card} style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  isActive
                    ? `${tableStyles.btn} ${tableStyles.btnPrimary}`
                    : tableStyles.btn
                }
                style={{ borderRadius: 20, padding: "6px 16px" }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Account tab ─────────────────────────────────────────────────────── */}
      {activeTab === "account" ? (
        <PanelCard
          title="Account information"
          description="Platform account details for this user. Contact a database admin for email changes."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full name">
              <input
                value={user.name || ""}
                readOnly
                className={textInputClassName(true)}
              />
            </Field>

            <Field label="Email address">
              <input
                value={user.email || ""}
                readOnly
                className={textInputClassName(true)}
              />
            </Field>

            <Field label="User ID">
              <div className="flex items-center gap-2">
                <input
                  value={user.id}
                  readOnly
                  className={textInputClassName(true)}
                />
                <button
                  type="button"
                  onClick={() => void copyToClipboard(user.id)}
                  className="shrink-0 rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Copy
                </button>
              </div>
            </Field>

            <Field label="Joined">
              <input
                value={formatDateTime(user.createdAt)}
                readOnly
                className={textInputClassName(true)}
              />
            </Field>
          </div>
        </PanelCard>
      ) : null}

      {/* ── Roles tab ───────────────────────────────────────────────────────── */}
      {activeTab === "roles" ? (
        <PanelCard
          title="Roles"
          description="Assign roles to control what this user can see and do across the platform."
        >
          <div className="space-y-6">
            {rolesMessage ? (
              <InlineAlert
                tone={rolesMessage.tone}
                message={rolesMessage.message}
              />
            ) : null}

            {allRoles.length === 0 ? (
              <EmptyState
                title="No roles available"
                description="No roles are configured on this platform yet."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {allRoles.map((role) => {
                  const checked = selectedRoles.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition hover:bg-zinc-50 ${
                        checked ? "border-sky-200 ring-2 ring-sky-200" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles([...selectedRoles, role.id]);
                          } else {
                            setSelectedRoles(
                              selectedRoles.filter((r) => r !== role.id),
                            );
                          }
                          setRolesMessage(null);
                        }}
                        className="mt-1 h-4 w-4 rounded border-zinc-300"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900">
                            {role.name}
                          </span>
                          {checked && (
                            <StatusBadge tone="blue">Assigned</StatusBadge>
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
            )}

            {rolesDirty ? (
              <StickyActions>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoles(initialRoles);
                    setRolesMessage(null);
                  }}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  disabled={savingRoles}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveRoles()}
                  className="rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={savingRoles}
                >
                  {savingRoles ? "Saving..." : "Save roles"}
                </button>
              </StickyActions>
            ) : null}
          </div>
        </PanelCard>
      ) : null}

      {/* ── Security tab ────────────────────────────────────────────────────── */}
      {activeTab === "security" ? (
        <div className="space-y-4">
          {securityMessage ? (
            <InlineAlert
              tone={securityMessage.tone}
              message={securityMessage.message}
            />
          ) : null}

          {/* Password reset */}
          <PanelCard
            title="Password reset"
            description="Generate a temporary password and send it to the user's email address."
          >
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-900">
                Send temporary password
              </p>
              <p className="mt-1 text-sm text-amber-800">
                A new temporary password will be generated and emailed to{" "}
                <span className="font-semibold">
                  {user.email || "this user"}
                </span>
                . The user must change it after logging in.
              </p>

              {!user.email ? (
                <div className="mt-3">
                  <InlineAlert
                    tone="error"
                    message="This user account does not have an email address. Password reset is unavailable."
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void handleResetPassword()}
                disabled={resettingPassword || !user.email}
                className="mt-4 inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resettingPassword ? "Sending..." : "Reset and send email"}
              </button>
            </div>
          </PanelCard>

          {/* Danger zone */}
          <PanelCard
            title="Danger zone"
            description="Permanently delete this user account. This action cannot be undone."
          >
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
              <p className="text-sm font-semibold text-rose-900">
                Delete user account
              </p>
              <p className="mt-1 text-sm text-rose-800">
                Type{" "}
                <span className="font-semibold">{user.email}</span> to confirm.
                All data associated with this account will be permanently
                removed.
              </p>

              <div className="mt-4 space-y-3">
                <Field label="Confirm email">
                  <input
                    value={confirmDelete}
                    onChange={(e) => {
                      setConfirmDelete(e.target.value);
                      setDeleteError("");
                    }}
                    placeholder={user.email || ""}
                    className={textInputClassName()}
                  />
                </Field>

                {deleteError ? (
                  <InlineAlert tone="error" message={deleteError} />
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleDeleteUser()}
                  disabled={deletingUser}
                  className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {deletingUser ? "Deleting..." : "Delete user"}
                </button>
              </div>
            </div>
          </PanelCard>
        </div>
      ) : null}
    </div>
  );
}
