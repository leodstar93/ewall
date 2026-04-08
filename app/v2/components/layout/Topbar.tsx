"use client";

import styles from "./Topbar.module.css";

interface Props {
  onToggleSidebar: () => void;
  searchValue: string;
  onSearch: (value: string) => void;
}

export default function Topbar({
  onToggleSidebar,
  searchValue,
  onSearch,
}: Props) {
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
        <div className={styles.title}>Panel principal</div>
        <div className={styles.breadcrumb}>
          Inicio <span className={styles.sep}>{">"}</span>{" "}
          <span className={styles.current}>Dashboard</span>
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
    </header>
  );
}
