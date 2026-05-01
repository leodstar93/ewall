"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

const tabs = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/news-updates", label: "News & Updates" },
  { href: "/admin/settings/email-templates", label: "Email Templates" },
  { href: "/admin/settings/integrations", label: "Integrations" },
  { href: "/admin/settings/ucr", label: "UCR" },
  { href: "/admin/settings/billing", label: "Billing" },
  { href: "/admin/settings/ifta-tax-rates", label: "IFTA Tax Rates" },
  { href: "/admin/settings/ucr-rates", label: "UCR Rates" },
  { href: "/admin/settings/2290", label: "Form 2290" },
  { href: "/admin/settings/dmv", label: "DMV Registration" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== "/admin/settings" && pathname?.startsWith(`${tab.href}/`));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? `${tableStyles.btn} ${tableStyles.btnPrimary}` : tableStyles.btn}
            style={{ textDecoration: "none" }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
