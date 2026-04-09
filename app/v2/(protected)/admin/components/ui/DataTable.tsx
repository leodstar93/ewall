"use client";

import { useMemo, useState } from "react";
import type { Item, SortColumn, SortDirection } from "@/lib/types";
import styles from "./DataTable.module.css";

const BADGE: Record<string, string> = {
  Activo: styles.bActive,
  Pendiente: styles.bPending,
  Completado: styles.bDone,
  Inactivo: styles.bInactive,
};

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "id", label: "#" },
  { key: "name", label: "Nombre" },
  { key: "category", label: "Categoria" },
  { key: "status", label: "Estado" },
  { key: "date", label: "Fecha" },
  { key: "amount", label: "Monto" },
];

interface Props {
  data: Item[];
  searchQuery: string;
}

export default function DataTable({ data, searchQuery }: Props) {
  const [sortCol, setSortCol] = useState<SortColumn>("id");
  const [sortDir, setSortDir] = useState<SortDirection>(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();

    return data.filter((row) => {
      return (
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.category.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((left, right) => {
      const leftValue = left[sortCol];
      const rightValue = right[sortCol];

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * sortDir;
      }

      return (Number(leftValue) - Number(rightValue)) * sortDir;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage) || 1;
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const slice = sorted.slice(start, start + perPage);

  function handleSort(column: SortColumn) {
    if (sortCol === column) {
      setSortDir((value) => (value === 1 ? -1 : 1));
    } else {
      setSortCol(column);
      setSortDir(1);
    }

    setPage(1);
  }

  function exportCSV() {
    const rows = [
      ["#", "Nombre", "Categoria", "Estado", "Fecha", "Monto"],
      ...sorted.map((row) => [
        row.id,
        row.name,
        row.category,
        row.status,
        row.date,
        row.amount,
      ]),
    ];
    const anchor = document.createElement("a");
    anchor.href = `data:text/csv,${encodeURIComponent(
      rows.map((row) => row.join(",")).join("\n"),
    )}`;
    anchor.download = "items.csv";
    anchor.click();
  }

  function buildPages() {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    let low = Math.max(1, safePage - half);
    const high = Math.min(totalPages, low + maxVisible - 1);

    if (high - low < maxVisible - 1) {
      low = Math.max(1, high - maxVisible + 1);
    }

    const pages: Array<number | "..."> = [];

    if (low > 1) {
      pages.push(1);
      if (low > 2) pages.push("...");
    }

    for (let current = low; current <= high; current += 1) {
      pages.push(current);
    }

    if (high < totalPages) {
      if (high < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Listado de items</div>
          <div className={styles.subtitle}>
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
            {searchQuery ? " encontrados" : " totales"}
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={exportCSV}>
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 1v8M4 6l3 3 3-3" />
              <path d="M2 11h10" />
            </svg>
            Exportar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="7" y1="1" x2="7" y2="13" />
              <line x1="1" y1="7" x2="13" y2="7" />
            </svg>
            Nuevo item
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className={sortCol === column.key ? styles.sorted : ""}
                >
                  {column.label}
                  <span className={styles.sortIcon}>
                    {sortCol === column.key ? (sortDir === 1 ? "↑" : "↓") : "↕"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.id}>
                <td className={styles.idCell}>{row.id}</td>
                <td className={styles.nameCell}>{row.name}</td>
                <td className={styles.muteCell}>{row.category}</td>
                <td>
                  <span className={`${styles.badge} ${BADGE[row.status] || ""}`}>
                    {row.status}
                  </span>
                </td>
                <td className={styles.muteCell}>{row.date}</td>
                <td className={styles.amountCell}>${row.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <div className={styles.perPage}>
          Filas:
          <select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className={styles.pageInfo}>
          {start + 1}-{Math.min(start + perPage, sorted.length)} de {sorted.length}
        </div>

        <div className={styles.pageButtons}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((value) => value - 1)}
            disabled={safePage <= 1}
          >
            {"<"}
          </button>

          {buildPages().map((value, index) =>
            value === "..." ? (
              <span key={`ellipsis-${index}`} className={styles.ellipsis}>
                ...
              </span>
            ) : (
              <button
                type="button"
                key={value}
                className={`${styles.pageBtn} ${value === safePage ? styles.pageBtnActive : ""}`}
                onClick={() => setPage(value)}
              >
                {value}
              </button>
            ),
          )}

          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((value) => value + 1)}
            disabled={safePage >= totalPages}
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
}
