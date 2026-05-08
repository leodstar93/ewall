"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/settings/ifta-tax-rates", label: "Tax Rates" },
  { href: "/admin/settings/ifta-process", label: "IFTA Process" },
  { href: "/admin/settings/ifta", label: "Legal Disclosure" },
];

export default function IftaSubTabs() {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", gap: 6 }}>
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--br)",
              background: active ? "var(--b)" : "var(--w)",
              color: active ? "#fff" : "var(--b)",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
