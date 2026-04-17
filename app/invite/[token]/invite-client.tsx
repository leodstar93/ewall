"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "@/app/(auth)/auth.module.css";
import type { SaferLookupResponse } from "@/lib/safer-lookup";

// ─── Types ────────────────────────────────────────────────────────────────────

type InviteInfo = {
  email: string;
  invitedByName: string | null;
  expiresAt: string;
  roleNames: string[];
};

type Step = "loading" | "invalid" | "account" | "company" | "done";

type AccountForm = {
  name: string;
  password: string;
  confirmPassword: string;
};

type CompanyForm = {
  dotNumber: string;
  mcNumber: string;
  companyName: string;
  legalName: string;
  businessPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
};

const emptyAccount: AccountForm = { name: "", password: "", confirmPassword: "" };
const emptyCompany: CompanyForm = {
  dotNumber: "",
  mcNumber: "",
  companyName: "",
  legalName: "",
  businessPhone: "",
  addressLine1: "",
  city: "",
  state: "",
  zipCode: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvitePageClient({ token }: { token: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [invalidMessage, setInvalidMessage] = useState("");

  const [account, setAccount] = useState<AccountForm>(emptyAccount);
  const [company, setCompany] = useState<CompanyForm>(emptyCompany);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [searching, setSearching] = useState(false);
  const [saferBanner, setSaferBanner] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const isStaffInvite = (inviteInfo?.roleNames ?? []).includes("STAFF");
  const totalSteps = isStaffInvite ? 1 : 2;

  // ─── Validate token ───────────────────────────────────────────────────────

  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`/api/v1/invitations/${token}`);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setInvalidMessage(data.error ?? "This invitation is invalid.");
          setStep("invalid");
          return;
        }
        const data = (await res.json()) as InviteInfo;
        setInviteInfo(data);
        setStep("account");
      } catch {
        setInvalidMessage("Could not verify the invitation. Please try again.");
        setStep("invalid");
      }
    };
    void validate();
  }, [token]);

  // ─── SAFER lookup ─────────────────────────────────────────────────────────

  const handleSaferSearch = async () => {
    const dot = company.dotNumber.trim();
    if (!dot) {
      setSaferBanner({ tone: "error", message: "Enter a USDOT number before searching SAFER." });
      return;
    }

    try {
      setSearching(true);
      setSaferBanner({ tone: "info", message: "Searching SAFER for your carrier details..." });

      const res = await fetch("/api/v1/invitations/safer-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dotNumber: dot, token }),
      });

      const payload = (await res.json().catch(() => ({}))) as SaferLookupResponse & { error?: string };

      if (!res.ok) {
        setSaferBanner({ tone: "error", message: payload.error ?? "SAFER lookup failed." });
        return;
      }

      if (!payload.found || !payload.company) {
        setSaferBanner({
          tone: "info",
          message: payload.warnings?.[0] ?? "No company found for that USDOT number.",
        });
        return;
      }

      const c = payload.company;
      setCompany((prev) => ({
        dotNumber: c.dotNumber ?? prev.dotNumber,
        mcNumber: c.mcNumber ?? prev.mcNumber,
        companyName: c.companyName ?? c.legalName ?? prev.companyName,
        legalName: c.legalName ?? prev.legalName,
        businessPhone: c.businessPhone ?? prev.businessPhone,
        addressLine1: c.addressLine1 ?? prev.addressLine1,
        city: c.city ?? prev.city,
        state: c.state ?? prev.state,
        zipCode: c.zipCode ?? prev.zipCode,
      }));
      setSaferBanner({ tone: "success", message: "Carrier data loaded from SAFER. Review and continue." });
    } catch {
      setSaferBanner({ tone: "error", message: "SAFER lookup failed. Please try again." });
    } finally {
      setSearching(false);
    }
  };

  // ─── Step 1 — account ─────────────────────────────────────────────────────

  const handleAccountNext = () => {
    setError("");
    if (!account.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (account.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (account.password !== account.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (isStaffInvite) {
      void handleSubmit();
      return;
    }
    setSaferBanner(null);
    setStep("company");
  };

  // ─── Step 2 — company + submit ────────────────────────────────────────────

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);

    try {
      const payload = isStaffInvite
        ? {
            name: account.name.trim(),
            password: account.password,
          }
        : {
            name: account.name.trim(),
            password: account.password,
            companyName: company.companyName.trim() || undefined,
            legalName: company.legalName.trim() || undefined,
            dotNumber: company.dotNumber.trim() || undefined,
            mcNumber: company.mcNumber.trim() || undefined,
            businessPhone: company.businessPhone.trim() || undefined,
            addressLine1: company.addressLine1.trim() || undefined,
            city: company.city.trim() || undefined,
            state: company.state.trim() || undefined,
            zipCode: company.zipCode.trim() || undefined,
          };

      const res = await fetch(`/api/v1/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to create account. Please try again.");
        return;
      }

      setStep("done");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Shared field style ───────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(8, 38, 63, 0.22)",
    borderRadius: "0.7rem",
    background: "#fbfdff",
    color: "#173651",
    padding: "0.7rem 0.75rem",
    fontSize: "0.98rem",
    outline: "none",
    boxSizing: "border-box",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.authShell}>
      <div className={styles.authContainer}>
        {/* Brand header */}
        <div className={styles.authHeader}>
          <Link href="/" className={styles.authBrand}>
            <Image
              src="/brand/truckers-unidos-logo.png"
              alt="Truckers Unidos logo"
              width={96}
              height={96}
              className={styles.authLogo}
              priority
            />
            <div>
              <p className={styles.brandName}>Truckers Unidos</p>
              <p className={styles.brandTagline}>Proud to Drive America</p>
            </div>
          </Link>
          {(step === "account" || step === "company") && (
            <p className={styles.authLead}>
              {inviteInfo?.invitedByName
                ? `${inviteInfo.invitedByName} invited you to join EWALL.`
                : "You've been invited to join EWALL."}
            </p>
          )}
        </div>

        <div className={styles.authCard}>
          {/* ── Loading ─────────────────────────────────────────────────────── */}
          {step === "loading" && (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem 0" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "3px solid #d72840",
                  borderTopColor: "transparent",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Invalid ──────────────────────────────────────────────────────── */}
          {step === "invalid" && (
            <div className={styles.statusPage}>
              <p className={styles.statusCode}>!</p>
              <p className={styles.statusTitle}>Invitation unavailable</p>
              <p className={styles.statusText}>{invalidMessage}</p>
              <div className={styles.statusActions}>
                <Link href="/login" className={`${styles.button} ${styles.primaryButton}`}>
                  Go to login
                </Link>
              </div>
            </div>
          )}

          {/* ── Step 1: Account setup ────────────────────────────────────────── */}
          {step === "account" && (
            <>
              <h2 className={styles.sectionTitle}>Create account</h2>
              <div style={{ marginTop: 6, marginBottom: 12, textAlign: "center" }}>
                <span style={{ fontSize: "0.88rem", color: "#3a5b76" }}>
                  Step 1 of {totalSteps} - Account info
                </span>
              </div>

              {inviteInfo && (
                <div
                  style={{
                    background: "#f0f5fb",
                    border: "1px solid #d7e3f1",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 16,
                    fontSize: "0.9rem",
                    color: "#1f4060",
                  }}
                >
                  Signing up as <strong>{inviteInfo.email}</strong>
                </div>
              )}

              {error && <p className={styles.error} style={{ marginBottom: 10 }}>{error}</p>}

              <div className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.label}>Full name</label>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="John Smith"
                    value={account.name}
                    onChange={(e) => setAccount((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password</label>
                  <input
                    type="password"
                    style={inputStyle}
                    placeholder="At least 8 characters"
                    value={account.password}
                    onChange={(e) => setAccount((p) => ({ ...p, password: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Confirm password</label>
                  <input
                    type="password"
                    style={inputStyle}
                    placeholder="Repeat password"
                    value={account.confirmPassword}
                    onChange={(e) => setAccount((p) => ({ ...p, confirmPassword: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className={`${styles.button} ${styles.primaryButton}`}
                  onClick={handleAccountNext}
                  disabled={submitting}
                >
                  {isStaffInvite ? (submitting ? "Creating account..." : "Create account") : "Continue"}
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Company info ─────────────────────────────────────────── */}
          {step === "company" && (
            <>
              <h2 className={styles.sectionTitle}>Company info</h2>
              <div style={{ marginTop: 6, marginBottom: 12, textAlign: "center" }}>
                <span style={{ fontSize: "0.88rem", color: "#3a5b76" }}>
                  Step 2 of 2 — Required for IFTA &amp; UCR workflows
                </span>
              </div>

              {/* DOT + SAFER lookup */}
              <div className={styles.field} style={{ marginBottom: 8 }}>
                <label className={styles.label}>USDOT number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  style={inputStyle}
                  placeholder="1234567"
                  value={company.dotNumber}
                  onChange={(e) => setCompany((p) => ({ ...p, dotNumber: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className={`${styles.button} ${styles.secondaryButton}`}
                style={{ marginBottom: 14, fontSize: "0.82rem" }}
                onClick={() => void handleSaferSearch()}
                disabled={searching || !company.dotNumber.trim()}
              >
                {searching ? "Searching SAFER..." : "Auto-fill from SAFER"}
              </button>

              {/* SAFER banner */}
              {saferBanner && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "9px 14px",
                    borderRadius: 10,
                    fontSize: "0.88rem",
                    lineHeight: 1.4,
                    ...(saferBanner.tone === "success"
                      ? { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }
                      : saferBanner.tone === "info"
                        ? { background: "#f0f5fb", border: "1px solid #d7e3f1", color: "#1f4060" }
                        : { background: "#fff0f0", border: "1px solid #fca5a5", color: "#c00" }),
                  }}
                >
                  {saferBanner.message}
                </div>
              )}

              {error && <p className={styles.error} style={{ marginBottom: 10 }}>{error}</p>}

              <div className={styles.form}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                  }}
                >
                  <div className={styles.field}>
                    <label className={styles.label}>MC number</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="MC-123456"
                      value={company.mcNumber}
                      onChange={(e) => setCompany((p) => ({ ...p, mcNumber: e.target.value }))}
                    />
                  </div>

                  <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                    <label className={styles.label}>Company name</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="ACME Trucking LLC"
                      value={company.companyName}
                      onChange={(e) => setCompany((p) => ({ ...p, companyName: e.target.value }))}
                    />
                  </div>

                  <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                    <label className={styles.label}>Legal name</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="ACME Trucking, LLC"
                      value={company.legalName}
                      onChange={(e) => setCompany((p) => ({ ...p, legalName: e.target.value }))}
                    />
                  </div>

                  <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                    <label className={styles.label}>Business phone</label>
                    <input
                      type="tel"
                      style={inputStyle}
                      placeholder="(702) 555-0100"
                      value={company.businessPhone}
                      onChange={(e) =>
                        setCompany((p) => ({ ...p, businessPhone: e.target.value }))
                      }
                    />
                  </div>

                  <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                    <label className={styles.label}>Address</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="123 Main St"
                      value={company.addressLine1}
                      onChange={(e) =>
                        setCompany((p) => ({ ...p, addressLine1: e.target.value }))
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>City</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="Las Vegas"
                      value={company.city}
                      onChange={(e) => setCompany((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>State</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="NV"
                      maxLength={2}
                      value={company.state}
                      onChange={(e) =>
                        setCompany((p) => ({ ...p, state: e.target.value.toUpperCase() }))
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>ZIP code</label>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="89101"
                      value={company.zipCode}
                      onChange={(e) => setCompany((p) => ({ ...p, zipCode: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.secondaryButton}`}
                    onClick={() => {
                      setError("");
                      setSaferBanner(null);
                      setStep("account");
                    }}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.primaryButton}`}
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? "Creating account..." : "Create account"}
                  </button>
                </div>

                <p className={styles.helperText} style={{ fontSize: "0.82rem" }}>
                  Company info can be updated later in your dashboard.
                </p>
              </div>
            </>
          )}

          {/* ── Done ─────────────────────────────────────────────────────────── */}
          {step === "done" && (
            <div className={styles.statusPage}>
              <p className={styles.statusTitle}>Account created!</p>
              <p className={styles.statusText}>
                Your account is ready. Redirecting to login&hellip;
              </p>
              <div className={styles.statusActions}>
                <Link href="/login" className={`${styles.button} ${styles.primaryButton}`}>
                  Go to login
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className={styles.authFooter}>
          By creating an account, you agree to our{" "}
          <a href="/terms" className={styles.authFooterLink}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className={styles.authFooterLink}>
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
