"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const tabs = [
  { href: "/admin/settings", label: "General" },
  { href: "/admin/settings/ifta-tax-rates", label: "IFTA Tax Rates" },
  { href: "/admin/settings/ucr-rates", label: "UCR Rates" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== "/admin/settings" && pathname?.startsWith(tab.href));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cx(
              "inline-flex items-center rounded-2xl border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
