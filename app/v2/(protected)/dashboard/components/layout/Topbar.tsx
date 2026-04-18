"use client";

import { usePathname } from "next/navigation";
import type { NavGroup } from "./LayoutWrap";
import styles from "./Topbar.module.css";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface Props {
  onToggleSidebar: () => void;
  searchValue: string;
  onSearch: (value: string) => void;
  navGroups: NavGroup[];
}

function resolveCurrentLabel(pathname: string | null, navGroups: NavGroup[]) {
  if (!pathname) return "Dashboard";

  const matches = navGroups
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((left, right) => right.href.length - left.href.length);

  return matches[0]?.label ?? "Dashboard";
}

export default function Topbar({
  onToggleSidebar,
  searchValue,
  onSearch,
  navGroups,
}: Props) {
  const pathname = usePathname();
  const currentLabel = resolveCurrentLabel(pathname, navGroups);

  return (
    <header className={styles.topbar}>
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="1" y1="3" x2="13" y2="3" />
          <line x1="1" y1="7" x2="13" y2="7" />
          <line x1="1" y1="11" x2="13" y2="11" />
        </svg>
      </button>

      <div className={styles.titleWrap}>
        <div className={styles.title}>{currentLabel}</div>
        <div className={styles.breadcrumb}>
          Inicio <span className={styles.sep}>{">"}</span>{" "}
          <span className={styles.current}>{currentLabel}</span>
        </div>
      </div>

      <div className={styles.searchBox}>
        <svg viewBox="0 0 14 14" fill="none" stroke="#aaa" strokeWidth="2">
          <circle cx="6" cy="6" r="4" />
          <line x1="9" y1="9" x2="13" y2="13" />
        </svg>
        <input
          type="text"
          placeholder="Buscar..."
          value={searchValue}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <div className={styles.topActions}>
        <NotificationBell />
      </div>
    </header>
  );
}
