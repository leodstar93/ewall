"use client";

import { useMemo, useState, type ReactNode } from "react";
import styles from "./DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ColumnDef<T> = {
  /** Unique column identifier. Also used as data accessor key when it matches a field in T. */
  key: string;
  label: string;
  sortable?: boolean;
  /** Custom cell renderer. Receives the raw value and the full row. */
  render?: (value: unknown, row: T) => ReactNode;
  /** Extra CSS class applied to every <td> in this column. */
  cellClass?: string;
};

export type TableAction = {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary";
  icon?: ReactNode;
};

interface Props<T extends object> {
  data: T[];
  columns: ColumnDef<T>[];
  actions?: TableAction[];
  searchQuery?: string;
  title?: ReactNode;
  toolbar?: ReactNode;
  /** Keys used for full-text search. Defaults to all string columns. */
  searchKeys?: (keyof T & string)[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SortDir = 1 | -1;

// ─── Component ───────────────────────────────────────────────────────────────

export default function Table<T extends object>({
  data,
  columns,
  actions = [],
  searchQuery = "",
  title,
  toolbar,
  searchKeys,
}: Props<T>) {
  const firstKey = columns[0]?.key ?? "";
  const [sortCol, setSortCol] = useState<string>(firstKey);
  const [sortDir, setSortDir] = useState<SortDir>(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Default search keys: all columns whose values are strings
  const effectiveSearchKeys = useMemo<string[]>(() => {
    if (searchKeys) return searchKeys;
    if (!data.length) return [];
    const first = data[0] as Record<string, unknown>;
    return columns
      .filter((col) => typeof first[col.key] === "string")
      .map((col) => col.key);
  }, [searchKeys, columns, data]);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) return data;
    return data.filter((row) => {
      const r = row as Record<string, unknown>;
      return effectiveSearchKeys.some((key) =>
        String(r[key] ?? "").toLowerCase().includes(query),
      );
    });
  }, [data, searchQuery, effectiveSearchKeys]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const r = a as Record<string, unknown>;
      const s = b as Record<string, unknown>;
      const av = r[sortCol];
      const bv = s[sortCol];
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * sortDir;
      }
      return (Number(av) - Number(bv)) * sortDir;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage) || 1;
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const slice = sorted.slice(start, start + perPage);

  function handleSort(key: string) {
    if (sortCol === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortCol(key);
      setSortDir(1);
    }
    setPage(1);
  }

  function buildPages() {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let low = Math.max(1, safePage - half);
    const high = Math.min(totalPages, low + maxVisible - 1);
    if (high - low < maxVisible - 1) low = Math.max(1, high - maxVisible + 1);

    const pages: Array<number | "..."> = [];
    if (low > 1) { pages.push(1); if (low > 2) pages.push("..."); }
    for (let i = low; i <= high; i++) pages.push(i);
    if (high < totalPages) { if (high < totalPages - 1) pages.push("..."); pages.push(totalPages); }
    return pages;
  }

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          {title && <div className={styles.title}>{title}</div>}
          <div className={styles.subtitle}>
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            {searchQuery ? " encontrados" : " totales"}
          </div>
        </div>

        {actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={`${styles.btn} ${action.variant === "primary" ? styles.btnPrimary : ""}`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {toolbar ? <div className={styles.toolbar}>{toolbar}</div> : null}

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={sortCol === col.key ? styles.sorted : ""}
                  style={{ cursor: col.sortable === false ? "default" : "pointer" }}
                >
                  {col.label}
                  {col.sortable !== false && (
                    <span className={styles.sortIcon}>
                      {sortCol === col.key ? (sortDir === 1 ? "↑" : "↓") : "↕"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: "24px", color: "#aaa" }}
                >
                  Sin resultados
                </td>
              </tr>
            ) : (
              slice.map((row, rowIndex) => {
                const r = row as Record<string, unknown>;
                return (
                  <tr key={rowIndex}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.cellClass}>
                        {col.render
                          ? col.render(r[col.key], row)
                          : String(r[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className={styles.pagination}>
        <div className={styles.perPage}>
          Filas:
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className={styles.pageInfo}>
          {start + 1}–{Math.min(start + perPage, sorted.length)} de {sorted.length}
        </div>

        <div className={styles.pageButtons}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => p - 1)}
            disabled={safePage <= 1}
          >
            {"<"}
          </button>

          {buildPages().map((v, i) =>
            v === "..." ? (
              <span key={`ellipsis-${i}`} className={styles.ellipsis}>...</span>
            ) : (
              <button
                type="button"
                key={v}
                className={`${styles.pageBtn} ${v === safePage ? styles.pageBtnActive : ""}`}
                onClick={() => setPage(v)}
              >
                {v}
              </button>
            ),
          )}

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => p + 1)}
            disabled={safePage >= totalPages}
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
}
