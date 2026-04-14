"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import tableStyles from "@/app/v2/(protected)/admin/components/ui/DataTable.module.css";

const tabs = [
  { href: "/v2/admin/settings", label: "General" },
  { href: "/v2/admin/settings/integrations", label: "Integrations" },
  { href: "/v2/admin/settings/ucr", label: "UCR" },
  { href: "/v2/admin/settings/billing", label: "Billing" },
  { href: "/v2/admin/settings/ifta-tax-rates", label: "IFTA Tax Rates" },
  { href: "/v2/admin/settings/ucr-rates", label: "UCR Rates" },
  { href: "/v2/admin/settings/2290", label: "Form 2290" },
  { href: "/v2/admin/settings/dmv", label: "DMV Registration" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== "/v2/admin/settings" && pathname?.startsWith(`${tab.href}/`));

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
