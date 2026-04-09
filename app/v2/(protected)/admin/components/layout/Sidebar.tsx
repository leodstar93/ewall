"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
        <div className={styles.avatar}>A</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>Admin</div>
          <div className={styles.userRole}>Administrador</div>
        </div>
      </div>
    </aside>
  );
}
