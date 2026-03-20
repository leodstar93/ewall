"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

interface LinkedAccount {
  provider: string;
  providerAccountId: string;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "blue" | "green" | "red";
}) {
  const styles =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 border-blue-100"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : tone === "red"
          ? "bg-rose-50 text-rose-700 border-rose-100"
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
    <div className={cx("mt-4 rounded-2xl border px-4 py-3 text-sm", styles)}>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [accountMessage, setAccountMessage] = useState("");
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const initials = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (!name) return "U";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("");
  }, [session?.user?.name]);

  const googleLinked = useMemo(
    () => linkedAccounts.some((acc) => acc.provider === "google"),
    [linkedAccounts],
  );
  const userRoles = session?.user?.roles ?? [];
  const userPermissions = session?.user?.permissions ?? [];
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Fetch linked accounts
  useEffect(() => {
    const fetchLinkedAccounts = async () => {
      try {
        const response = await fetch(
          `/api/v1/users/${session?.user?.id}/accounts`,
        );
        if (response.ok) {
          const data = await response.json();
          setLinkedAccounts(data.accounts || []);
        }
      } catch (error) {
        console.error("Error fetching linked accounts:", error);
      } finally {
        setLoadingAccounts(false);
      }
    };

    if (session?.user?.id) fetchLinkedAccounts();
  }, [session?.user?.id]);

  // Sync form with session
  useEffect(() => {
    if (status === "authenticated") {
      setFormData({
        name: userName,
        email: userEmail,
      });
    }
  }, [status, userName, userEmail]);

  if (status === "unauthenticated") return null;

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
          <div className="h-6 w-40 rounded bg-zinc-100 animate-pulse" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full rounded bg-zinc-100 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-zinc-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-zinc-100 animate-pulse" />
          </div>
          <div className="mt-6 h-10 w-full rounded-xl bg-zinc-100 animate-pulse" />
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/v1/users/${session?.user?.id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile");
      }

      const updatedUser = await res.json();

      await update({ user: { name: updatedUser.name } });

      setMessage("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to update profile. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordMessage("");

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPasswordMessage("All fields are required");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage("New passwords do not match");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/v1/users/${session?.user?.id}/password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to change password");
      }

      setPasswordMessage("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordMessage("");
      }, 1200);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordMessage(
        error instanceof Error
          ? error.message
          : "Failed to change password. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: session?.user?.name || "",
      email: session?.user?.email || "",
    });
    setIsEditing(false);
    setMessage("");
  };

  const handleLinkGoogle = () => {
    setAccountMessage("");
    const currentPath = pathname || `/users/${session?.user?.id}`;
    router.push(
      `/auth/link-account?provider=google&callbackUrl=${encodeURIComponent(currentPath)}`,
    );
  };

  const handleUnlinkGoogle = async () => {
    if (
      !confirm(
        "Are you sure you want to unlink your Google account? You will still be able to log in with your email and password.",
      )
    ) {
      return;
    }

    setAccountMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/v1/users/${session?.user?.id}/accounts/google`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to unlink Google account");
      }

      setAccountMessage("Google account unlinked successfully!");

      const accountsResponse = await fetch(
        `/api/v1/users/${session?.user?.id}/accounts`,
      );
      if (accountsResponse.ok) {
        const data = await accountsResponse.json();
        setLinkedAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error unlinking Google account:", error);
      setAccountMessage(
        error instanceof Error
          ? error.message
          : "Failed to unlink Google account. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const memberSince = session?.user?.createdAt
    ? new Date(session.user.createdAt).toLocaleDateString()
    : "Unknown";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Account</div>
            <h1 className="text-xl font-semibold text-zinc-900">
              Profile settings
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Manage your personal information, linked accounts, and security.
            </p>
          </div>

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
              disabled={isLoading}
            >
              Edit profile
            </button>
          ) : (
            <Badge tone="zinc">Editing</Badge>
          )}
        </div>
      </div>

      {/* Personal info */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              Personal information
            </h2>
            <div className="flex gap-2">
              {userRoles.slice(0, 3).map((role) => (
                <Badge key={String(role)} tone="blue">
                  {String(role)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {session?.user?.name || "User"}
              </div>
              <div className="text-sm text-zinc-600 truncate">
                {session?.user?.email}
              </div>
              <div className="mt-2">
                <Badge tone="green">Active</Badge>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-2">
                Full name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="Enter your full name"
                />
              ) : (
                <div className="rounded-2xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
                  {session?.user?.name || "Not provided"}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-2">
                Email address
              </label>
              <div className="rounded-2xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
                {session?.user?.email || "Unknown"}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Email cannot be changed
              </p>
            </div>
          </div>

          {/* Permissions */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-zinc-600">
                Permissions
              </label>
              <span className="text-xs text-zinc-500">
                {(session?.user?.permissions?.length ?? 0).toString()} total
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {userPermissions.length ? (
                userPermissions.map((permission) => (
                  <Badge key={String(permission)} tone="green">
                    {String(permission)}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-zinc-500">
                  No permissions assigned
                </span>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="mt-8 flex items-center justify-end gap-3 border-t pt-6">
              <button
                onClick={handleCancel}
                className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}

          {message && (
            <Alert
              tone={
                message.toLowerCase().includes("success") ? "success" : "error"
              }
            >
              {message}
            </Alert>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6">
          <h2 className="text-base font-semibold text-zinc-900">
            Account information
          </h2>

          <div className="mt-6 divide-y rounded-2xl border bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-zinc-600">Account status</span>
              <Badge tone="green">Active</Badge>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-zinc-600">Member since</span>
              <span className="text-sm text-zinc-900">{memberSince}</span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-zinc-600">Last login</span>
              <span className="text-sm text-zinc-900">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-6">
          <h2 className="text-base font-semibold text-zinc-900">Security</h2>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border bg-white p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  Password
                </div>
                <div className="text-sm text-zinc-600">
                  Update your password regularly.
                </div>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
              >
                Change password
              </button>
            </div>

            <div className="rounded-2xl border bg-white p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  Two-factor authentication
                </div>
                <div className="text-sm text-zinc-600">
                  Add an extra layer of security.
                </div>
              </div>
              <button
                className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                disabled
                title="Coming soon"
              >
                Enable 2FA
              </button>
            </div>

            <div className="rounded-2xl border bg-white p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-900">
                  Google account
                </div>
                <div className="text-sm text-zinc-600">
                  {loadingAccounts
                    ? "Checking linked accounts…"
                    : googleLinked
                      ? "Your Google account is linked."
                      : "Link your Google account for easier login."}
                </div>
              </div>

              {googleLinked ? (
                <button
                  onClick={handleUnlinkGoogle}
                  disabled={isLoading}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                >
                  Unlink Google
                </button>
              ) : (
                <button
                  onClick={handleLinkGoogle}
                  disabled={isLoading || loadingAccounts}
                  className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  {isLoading ? "Linking..." : "Link Google"}
                </button>
              )}
            </div>

            {accountMessage && (
              <Alert
                tone={
                  accountMessage.toLowerCase().includes("success")
                    ? "success"
                    : "error"
                }
              >
                {accountMessage}
              </Alert>
            )}
          </div>
        </div>
      </div>

      {/* Password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowPasswordModal(false);
              setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
              });
              setPasswordMessage("");
            }}
          />
          <div className="relative w-full max-w-md mx-4 rounded-2xl border bg-white shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Change password
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">
                    Choose a strong password you don’t use elsewhere.
                  </p>
                </div>
                <button
                  className="rounded-xl p-2 hover:bg-zinc-100 text-zinc-600"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setPasswordMessage("");
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">
                    Current password
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">
                    New password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordInputChange}
                    className="w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-900/10"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              {passwordMessage && (
                <Alert
                  tone={
                    passwordMessage.toLowerCase().includes("success")
                      ? "success"
                      : "error"
                  }
                >
                  {passwordMessage}
                </Alert>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setPasswordMessage("");
                  }}
                  className="rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition disabled:opacity-50"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  className="rounded-2xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? "Changing..." : "Change password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
