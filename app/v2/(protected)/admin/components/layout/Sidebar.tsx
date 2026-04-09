"use client";

import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

const navItems = [
  {
    section: "Principal",
    items: [
      { label: "Inicio", icon: "grid", active: true },
      { label: "Usuarios", icon: "user" },
      { label: "Proyectos", icon: "building" },
    ],
  },
  {
    section: "Datos",
    items: [
      { label: "Reportes", icon: "list" },
      { label: "Analiticas", icon: "chart" },
    ],
  },
  {
    section: "Sistema",
    items: [{ label: "Configuracion", icon: "settings" }],
  },
];

const icons: Record<string, ReactNode> = {
  grid: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12V4l6-2 6 2v8" />
      <rect x="6" y="8" width="4" height="4" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="2" width="12" height="3" rx="1" />
      <rect x="2" y="7" width="12" height="3" rx="1" />
      <rect x="2" y="12" width="8" height="2" rx="1" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="2,12 5,7 8,9 11,4 14,7" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" />
    </svg>
  ),
};

interface Props {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: Props) {
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
        {navItems.map((group) => (
          <div key={group.section}>
            <div className={styles.section}>{group.section}</div>
            {group.items.map((item) => (
              <div
                key={item.label}
                className={`${styles.navItem} ${item.active ? styles.active : ""}`}
              >
                <span className={styles.navIcon}>{icons[item.icon]}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.avatar}>JG</div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>Juan Garcia</div>
          <div className={styles.userRole}>Administrador</div>
        </div>
      </div>
    </aside>
  );
}
