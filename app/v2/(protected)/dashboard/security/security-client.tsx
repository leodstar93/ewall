"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "../profile/page.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type LinkedAccount = {
  provider: string;
  providerAccountId: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type Banner = {
  tone: "success" | "error" | "info";
  message: string;
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function providerLabel(provider: string) {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SecurityPageClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);

  const [banner, setBanner] = useState<Banner | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  // ─── Load linked accounts ─────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.user?.id) {
      setLoadingAccounts(false);
      return;
    }

    let active = true;

    const load = async () => {
      try {
        setLoadingAccounts(true);
        const response = await fetch(
          `/api/v1/users/${session.user.id}/accounts`,
          { cache: "no-store" },
        );
        const data = (await response.json().catch(() => ({}))) as {
          accounts?: LinkedAccount[];
        };
        if (!active) return;
        setLinkedAccounts(data.accounts ?? []);
      } catch {
        // non-critical — show empty state
        if (active) setLinkedAccounts([]);
      } finally {
        if (active) setLoadingAccounts(false);
      }
    };

    load().catch(() => {
      if (active) setLoadingAccounts(false);
    });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // ─── Password ─────────────────────────────────────────────────────────────

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setPasswordForm((current) => {
      const next = { ...current, [name]: value };
      setPasswordDirty(
        next.currentPassword !== "" ||
          next.newPassword !== "" ||
          next.confirmPassword !== "",
      );
      return next;
    });
    setBanner(null);
  };

  const handlePasswordSave = async () => {
    if (!session?.user?.id) {
      setBanner({ tone: "error", message: "You must be logged in to change your password." });
      return;
    }

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setBanner({ tone: "error", message: "All password fields are required." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setBanner({ tone: "error", message: "New passwords do not match." });
      return;
    }

    try {
      setSavingPassword(true);
      setBanner(null);

      const response = await fetch(
        `/api/v1/users/${session.user.id}/password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update password.");
      }

      setPasswordForm(emptyPasswordForm);
      setPasswordDirty(false);
      setBanner({ tone: "success", message: "Password updated successfully." });
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "Failed to update password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  // ─── Google linking ───────────────────────────────────────────────────────

  const googleLinked = linkedAccounts.some(
    (account) => account.provider === "google",
  );

  const handleLinkGoogle = () => {
    setLinkingGoogle(true);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "security");
    const callbackUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.push(
      `/v2/auth/link-account?provider=google&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  };

  // ─── Logout ───────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut({ callbackUrl: "/" });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {banner ? (
        <div
          className={`${styles.alert} ${
            banner.tone === "success"
              ? styles.alertSuccess
              : banner.tone === "info"
                ? styles.alertInfo
                : styles.alertError
          }`}
        >
          {banner.message}
        </div>
      ) : null}

      <div className={styles.shell}>

        {/* ── Change password ─────────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.sectionEyebrow}>Security</p>
            <h3 className={styles.panelTitle}>Change password</h3>
          </div>

          <div className={styles.fieldsGrid}>
            <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <span className={styles.fieldLabel}>Current password</span>
              <input
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter your current password"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>New password</span>
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="New password"
                className={styles.input}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Confirm new password</span>
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Repeat new password"
                className={styles.input}
              />
            </label>
          </div>
        </section>

        {passwordDirty ? (
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => {
                setPasswordForm(emptyPasswordForm);
                setPasswordDirty(false);
                setBanner(null);
              }}
              disabled={savingPassword}
              className={styles.secondaryButton}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handlePasswordSave()}
              disabled={savingPassword}
              className={styles.primaryButton}
            >
              {savingPassword ? "Updating..." : "Update password"}
            </button>
          </div>
        ) : null}

        {/* ── Connected accounts ──────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.sectionEyebrow}>Accounts</p>
            <h3 className={styles.panelTitle}>Connected accounts</h3>
          </div>

          {loadingAccounts ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 58,
                    borderRadius: 12,
                    background:
                      "linear-gradient(90deg, #eef2fb, #f8faff, #eef2fb)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.6s linear infinite",
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {linkedAccounts.length === 0 && googleLinked === false ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  No external providers linked. Credential login is active.
                </p>
              ) : null}

              {linkedAccounts.map((account) => (
                <div
                  key={`${account.provider}-${account.providerAccountId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderRadius: 12,
                    border: "1px solid var(--br)",
                    background: "var(--off)",
                    padding: "12px 14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--b)",
                      }}
                    >
                      {providerLabel(account.provider)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {account.providerAccountId}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0e6b40",
                      background: "#ebfff4",
                      border: "1px solid #b9efd0",
                      borderRadius: 20,
                      padding: "3px 10px",
                    }}
                  >
                    Linked
                  </span>
                </div>
              ))}

              {!googleLinked ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    borderRadius: 12,
                    border: "1px solid var(--br)",
                    background: "var(--off)",
                    padding: "12px 14px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--b)",
                      }}
                    >
                      Google account
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      Link your Google account for faster sign-in.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLinkGoogle}
                    disabled={linkingGoogle}
                    className={styles.primaryButton}
                    style={{ padding: "0 16px", minHeight: 36, fontSize: 12 }}
                  >
                    {linkingGoogle ? "Redirecting..." : "Link Google"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        {/* ── Session ─────────────────────────────────────────────────────── */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.sectionEyebrow}>Session</p>
            <h3 className={styles.panelTitle}>Session controls</h3>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className={styles.primaryButton}
            >
              {loggingOut ? "Logging out..." : "Logout current session"}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
