"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  EmptyState,
  Field,
  InlineAlert,
  PanelCard,
  textInputClassName,
} from "./settings-ui";

type LinkedAccount = {
  provider: string;
  providerAccountId: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function providerLabel(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function SecurityTab({
  onNotify,
}: {
  onNotify: (input: { tone: "success" | "error"; message: string }) => void;
}) {
  const { data: session } = useSession();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [error, setError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAccounts = async () => {
      if (!session?.user?.id) {
        if (active) setLoadingAccounts(false);
        return;
      }

      try {
        setLoadingAccounts(true);
        const response = await fetch(`/api/v1/users/${session.user.id}/accounts`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Failed to load connected accounts.");
        }

        const data = (await response.json()) as { accounts?: LinkedAccount[] };
        if (active) setLinkedAccounts(data.accounts ?? []);
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load connected accounts.";
        setError(message);
      } finally {
        if (active) setLoadingAccounts(false);
      }
    };

    loadAccounts().catch(() => {
      if (active) {
        setError("Failed to load connected accounts.");
        setLoadingAccounts(false);
      }
    });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const handlePasswordChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = event.target;
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const handlePasswordSave = async () => {
    if (!session?.user?.id) {
      const message = "You must be logged in to change your password.";
      setError(message);
      onNotify({ tone: "error", message });
      return;
    }

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      const message = "All password fields are required.";
      setError(message);
      onNotify({ tone: "error", message });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      const message = "New passwords do not match.";
      setError(message);
      onNotify({ tone: "error", message });
      return;
    }

    try {
      setSavingPassword(true);
      setError("");

      const response = await fetch(`/api/v1/users/${session.user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update password.");
      }

      setPasswordForm(emptyPasswordForm);
      onNotify({ tone: "success", message: "Password updated." });
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to update password.";
      setError(message);
      onNotify({ tone: "error", message });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut({ callbackUrl: "/" });
  };

  return (
    <PanelCard
      title="Security"
      description="Password and connected accounts."
    >
      <div className="space-y-6">
        {error ? <InlineAlert tone="error" message={error} /> : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-zinc-950">Change password</h3>

              <div className="mt-5 space-y-4">
              <Field label="Current password">
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="New password">
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className={textInputClassName()}
                />
              </Field>

              <Field label="Confirm new password">
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className={textInputClassName()}
                />
              </Field>

              <button
                type="button"
                onClick={handlePasswordSave}
                className="w-full rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                disabled={savingPassword}
              >
                {savingPassword ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-950">Connected accounts</h3>
                </div>
                {loadingAccounts ? <span className="text-sm text-zinc-500">Loading...</span> : null}
              </div>

              <div className="mt-5 space-y-3">
                {!loadingAccounts && linkedAccounts.length === 0 ? (
                  <EmptyState
                    title="No external providers linked"
                    description="Credential login is active. Link additional providers from your profile flow when needed."
                  />
                ) : null}

                {linkedAccounts.map((account) => (
                  <div
                    key={`${account.provider}-${account.providerAccountId}`}
                    className="rounded-[22px] border border-zinc-200 bg-zinc-50/70 px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-950">
                          {providerLabel(account.provider)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {account.providerAccountId}
                        </p>
                      </div>
                      <span className="text-sm text-zinc-500">Linked</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-zinc-950">Session controls</h3>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  disabled={loggingOut}
                >
                  {loggingOut ? "Logging out..." : "Logout current session"}
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-400"
                >
                  Logout all sessions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelCard>
  );
}
