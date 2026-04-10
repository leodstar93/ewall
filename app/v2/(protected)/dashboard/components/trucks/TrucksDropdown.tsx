"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Table, { type ColumnDef } from "../ui/Table";
import tableStyles from "../ui/DataTable.module.css";
import type { TruckStatus } from "@/lib/types";
import styles from "./TrucksDropdown.module.css";

export type DashboardTruckRow = {
  id: string;
  model: string;
  alias: string;
  identifier: string;
  usage: string;
  status: TruckStatus;
};

type TruckTableRow = DashboardTruckRow & {
  unitBadge: string;
  searchText: string;
  sortId: string;
  sortAlias: string;
  sortIdentifier: string;
  sortStatus: string;
};

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
  trucks: DashboardTruckRow[];
  footerHref?: string;
}

function buildRows(trucks: DashboardTruckRow[]): TruckTableRow[] {
  return trucks.map((truck) => ({
    ...truck,
    unitBadge: truck.id.split("-")[1] || truck.id,
    searchText: [
      truck.id,
      truck.model,
      truck.alias,
      truck.identifier,
      truck.usage,
      truck.status,
    ]
      .join(" ")
      .toLowerCase(),
    sortId: truck.id,
    sortAlias: truck.alias,
    sortIdentifier: truck.identifier,
    sortStatus: truck.status,
  }));
}

export default function TrucksDropdown({ trucks, footerHref }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TruckStatus | "all">("all");
  const [query, setQuery] = useState("");

  const activeCount = trucks.filter((truck) => truck.status === "Activo").length;

  const filtered = useMemo(() => {
    return trucks.filter((truck) => filter === "all" || truck.status === filter);
  }, [trucks, filter]);

  const rows = useMemo(() => buildRows(filtered), [filtered]);

  const columns: ColumnDef<TruckTableRow>[] = [
    {
      key: "unitBadge",
      label: "#",
      render: (_, truck) => (
        <div className={`${styles.num} ${NUM_CLASS[truck.status]}`}>{truck.unitBadge}</div>
      ),
    },
    {
      key: "sortId",
      label: "Unit",
      render: (_, truck) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={`${truck.id} · ${truck.model}`}
        >
          {truck.id}
        </div>
      ),
    },
    {
      key: "sortAlias",
      label: "Alias",
      render: (_, truck) => (
        <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>
          {truck.alias}
        </div>
      ),
    },
    {
      key: "sortIdentifier",
      label: "Plate / VIN",
      render: (_, truck) => (
        <div className={tableStyles.muteCell} style={{ fontSize: 13 }}>
          {truck.identifier}
        </div>
      ),
    },
    {
      key: "usage",
      label: "Activity",
      sortable: false,
      render: (_, truck) => (
        <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>
          {truck.usage}
        </div>
      ),
    },
    {
      key: "sortStatus",
      label: "Status",
      render: (_, truck) => (
        <span className={`${styles.tbadge} ${STATUS_CLASS[truck.status]}`}>{truck.status}</span>
      ),
    },
  ];

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
          <span className={styles.triggerLabel}>Trucks and Trails</span>
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

      {open ? (
        <div className={styles.body}>
          <Table
            data={rows}
            columns={columns}
            title="Trucks and Trails"
            searchQuery={query}
            searchKeys={["searchText"]}
            toolbar={
              <div className={styles.toolbar}>
                <div className={styles.searchBox}>
                  <svg viewBox="0 0 14 14" fill="none" stroke="#bbb" strokeWidth="2">
                    <circle cx="6" cy="6" r="4" />
                    <line x1="9" y1="9" x2="13" y2="13" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search truck..."
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
                {footerHref ? (
                  <Link href={footerHref} className={styles.footerLink}>
                    Manage trucks {"->"}
                  </Link>
                ) : null}
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
