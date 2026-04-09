"use client";

import { useMemo, useState } from "react";
import type { Truck, TruckStatus } from "@/lib/types";
import styles from "./TrucksDropdown.module.css";

const FILTERS: { label: string; value: TruckStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "Activo" },
  { label: "En transito", value: "En transito" },
  { label: "Mantenimiento", value: "Mantenimiento" },
  { label: "Inactivos", value: "Inactivo" },
];

const STATUS_CLASS: Record<TruckStatus, string> = {
  Activo: styles.tActive,
  "En transito": styles.tTransit,
  Mantenimiento: styles.tMaint,
  Inactivo: styles.tIdle,
};

const NUM_CLASS: Record<TruckStatus, string> = {
  Activo: "",
  "En transito": "",
  Mantenimiento: styles.numRed,
  Inactivo: styles.numGray,
};

interface Props {
  trucks: Truck[];
}

export default function TrucksDropdown({ trucks }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TruckStatus | "all">("all");
  const [query, setQuery] = useState("");

  const activeCount = trucks.filter((truck) => truck.status === "Activo").length;

  const filtered = useMemo(() => {
    return trucks.filter((truck) => {
      const matchesFilter = filter === "all" || truck.status === filter;
      const normalizedQuery = query.toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        truck.id.toLowerCase().includes(normalizedQuery) ||
        truck.driver.toLowerCase().includes(normalizedQuery) ||
        truck.location.toLowerCase().includes(normalizedQuery) ||
        truck.model.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [trucks, filter, query]);

  return (
    <div className={`${styles.container} ${open ? styles.open : ""}`}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
      >
        <div className={styles.triggerLeft}>
          <div className={styles.triggerIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
              <rect x="1" y="3" width="15" height="13" rx="1" />
              <path d="M16 8h4l3 5v4h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <span className={styles.triggerLabel}>Trucks</span>
          <span className={styles.triggerCount}>({trucks.length} unidades)</span>
        </div>
        <div className={styles.triggerRight}>
          <span className={styles.activeBadge}>{activeCount} activos</span>
          <svg
            className={styles.chevron}
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--b)"
            strokeWidth="2"
          >
            <polyline points="4,6 8,10 12,6" />
          </svg>
        </div>
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <svg viewBox="0 0 14 14" fill="none" stroke="#bbb" strokeWidth="2">
                <circle cx="6" cy="6" r="4" />
                <line x1="9" y1="9" x2="13" y2="13" />
              </svg>
              <input
                type="text"
                placeholder="Buscar truck..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className={styles.pills}>
              {FILTERS.map((filterOption) => (
                <button
                  type="button"
                  key={filterOption.value}
                  className={`${styles.pill} ${filter === filterOption.value ? styles.pillActive : ""}`}
                  onClick={() => setFilter(filterOption.value)}
                >
                  {filterOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.colHeaders}>
            <div />
            <div>Unidad</div>
            <div>Conductor</div>
            <div>Ubicacion</div>
            <div>Carga</div>
            <div>Estado</div>
          </div>

          <div className={styles.list}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>Sin resultados</div>
            ) : (
              filtered.map((truck) => (
                <div key={truck.id} className={styles.row}>
                  <div className={`${styles.num} ${NUM_CLASS[truck.status]}`}>
                    {truck.id.split("-")[1]}
                  </div>
                  <div>
                    <div className={styles.truckId}>{truck.id}</div>
                    <div className={styles.truckModel}>{truck.model}</div>
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.cellLabel}>Conductor</span>
                    {truck.driver}
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.cellLabel}>Ubicacion</span>
                    {truck.location}
                  </div>
                  <div className={styles.cell}>
                    <span className={styles.cellLabel}>Carga</span>
                    <strong>{truck.load}</strong>
                  </div>
                  <div>
                    <span className={`${styles.tbadge} ${STATUS_CLASS[truck.status]}`}>
                      {truck.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.footerInfo}>
              Mostrando {filtered.length} de {trucks.length} unidades
            </span>
            <span className={styles.footerLink}>Ver flota completa {"->"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
