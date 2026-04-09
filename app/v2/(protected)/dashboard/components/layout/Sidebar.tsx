"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  SidebarNavIcon,
  resolveSidebarIcon,
} from "@/components/navigation/SidebarNavIcon";
import type { NavGroup } from "./LayoutWrap";
import styles from "./Sidebar.module.css";

interface Props {
  collapsed: boolean;
  navGroups: NavGroup[];
}

export default function Sidebar({ collapsed, navGroups }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const displayName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const displayRole = roles.includes("ADMIN")
    ? "Administrador"
    : roles.includes("STAFF")
      ? "Staff"
      : roles.includes("TRUCKER")
        ? "Trucker"
        : "Usuario";
  const avatarLabel = (displayName[0] || "U").toUpperCase();

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname?.startsWith(href));

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.header}>
        <div className={styles.logoBox}>
          <svg viewBox="0 0 16 16" fill="#fff">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
        </div>
        <span className={styles.title}>MiApp</span>
      </div>

      <nav className={styles.nav}>
        {navGroups.map((group) => (
          <div key={group.heading}>
            <div className={styles.section}>{group.heading}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.active : ""}`}
                title={item.label}
              >
                <span className={styles.navIcon}>
                  <SidebarNavIcon
                    name={resolveSidebarIcon({
                      href: item.href,
                      label: item.label,
                      section: group.heading,
                    })}
                  />
                </span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.avatar}>{avatarLabel}</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userRole}>{displayRole}</div>
        </div>
        <Link
          href="/logout"
          className={styles.logoutButton}
          aria-label="Sign out"
          title="Sign out"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 4H5.75A1.75 1.75 0 0 0 4 5.75v8.5C4 15.216 4.784 16 5.75 16H8" />
            <path d="M11 6l4 4-4 4" />
            <path d="M7 10h8" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
