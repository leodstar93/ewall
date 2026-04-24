import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "./components/SettingsTabs";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

const settingsItems = [
  {
    section: "Content",
    title: "News & Updates",
    description:
      "Create, edit, reorder, and target the slides shown in the News & Updates dashboard card.",
    href: "/admin/settings/news-updates",
    cta: "Open News Manager",
  },
  {
    section: "Integrations",
    title: "ELD raw client export",
    description:
      "Pick any customer with an ELD connection and generate a multi-sheet Excel with the raw account, sync, vehicle, driver, trip, fuel, webhook, and filing data stored in the platform.",
    href: "/admin/settings/integrations",
    cta: "Open Integrations Export",
  },
  {
    section: "Security",
    title: "ACH financial access audits",
    description:
      "Review every ACH reveal, authorization, revoke event, and manual payment usage recorded by the custody vault workflow.",
    href: "/admin/settings/security/financial-access",
    cta: "Open Financial Audit Log",
  },
  {
    section: "Billing",
    title: "Plans and entitlements",
    description:
      "Manage billing feature flags, subscription plans, premium modules, coupons, manual access grants, and provider configuration state.",
    href: "/admin/settings/billing",
    cta: "Open Billing Settings",
  },
  {
    section: "IFTA Tax Rates",
    title: "Quarter tax-rate management",
    description:
      "Load U.S. jurisdiction rates, validate missing coverage, and apply manual admin overrides for the filing workflow.",
    href: "/admin/settings/ifta-tax-rates",
    cta: "Open IFTA Tax Rates",
  },
  {
    section: "UCR Concierge",
    title: "Concierge controls and pricing defaults",
    description:
      "Configure concierge mode, customer checkout behavior, fee defaults, and the active operating year for the manual UCR payment workflow.",
    href: "/admin/settings/ucr",
    cta: "Open UCR Settings",
  },
  {
    section: "UCR Rates",
    title: "Annual UCR bracket management",
    description:
      "Maintain fleet-size brackets, activate or deactivate yearly rate tables, and control the fee engine used by the UCR compliance workflow.",
    href: "/admin/settings/ucr-rates",
    cta: "Open UCR Rates",
  },
  {
    section: "Form 2290",
    title: "HVUT period and rule management",
    description:
      "Maintain annual 2290 tax periods, set the active filing window, and tune the base vehicle eligibility threshold.",
    href: "/admin/settings/2290",
    cta: "Open Form 2290 Settings",
  },
  {
    section: "DMV Registration",
    title: "Nevada-only and IRP workspace rules",
    description:
      "Manage DMV requirement templates, internal fee rules, and jurisdiction selectors that power truck registration and renewal compliance.",
    href: "/admin/settings/dmv",
    cta: "Open DMV Settings",
  },
];

export default async function AdminSettingsPage() {
  const access = await requireAdminSettingsAccess("settings:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsTabs />

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {settingsItems.map((item) => (
          <div key={item.href} className={tableStyles.card}>
            <div className={tableStyles.header}>
              <div>
                <div className={tableStyles.subtitle}>{item.section}</div>
                <div className={tableStyles.title}>{item.title}</div>
              </div>
            </div>
            <div
              style={{
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <p style={{ fontSize: 13, color: "#777", lineHeight: 1.6, margin: 0 }}>
                {item.description}
              </p>
              <Link
                href={item.href}
                className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
                style={{ alignSelf: "flex-start", textDecoration: "none" }}
              >
                {item.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
