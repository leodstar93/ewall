"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { NavGroup } from "./LayoutWrap";

export const ADMIN_RECENT_ACCESS_KEY = "ewall.admin.recentAccess";

export type AdminRecentAccessLink = {
  href: string;
  label: string;
};

function resolveLabel(pathname: string, navGroups: NavGroup[]) {
  const items = navGroups.flatMap((group) => group.items);
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0];

  return match?.label ?? "Admin";
}

function readRecentAccess() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_RECENT_ACCESS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is AdminRecentAccessLink =>
        typeof item?.href === "string" && typeof item?.label === "string",
    );
  } catch {
    return [];
  }
}

export default function AdminRecentAccessTracker({ navGroups }: { navGroups: NavGroup[] }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/admin" || !pathname.startsWith("/admin")) return;

    const label = resolveLabel(pathname, navGroups);
    const current = { href: pathname, label };
    const next = [
      current,
      ...readRecentAccess().filter((item) => item.href !== current.href),
    ].slice(0, 3);

    localStorage.setItem(ADMIN_RECENT_ACCESS_KEY, JSON.stringify(next));
  }, [navGroups, pathname]);

  return null;
}
