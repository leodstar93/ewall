"use client";

import Link from "next/link";
import type { Item, ItemStatus } from "@/lib/types";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import Table, { type ColumnDef, type TableAction } from "./Table";
import styles from "./DataTable.module.css";

const BADGE: Record<ItemStatus, string> = {
  Activo:     styles.bActive,
  Pendiente:  styles.bPending,
  Completado: styles.bDone,
  Inactivo:   styles.bInactive,
};

const columns: ColumnDef<Item>[] = [
  { key: "id",       label: "#",         cellClass: styles.idCell },
  { key: "name",     label: "Nombre",    cellClass: styles.nameCell },
  { key: "category", label: "Categoria", cellClass: styles.muteCell },
  {
    key: "status",
    label: "Estado",
    render: (value) => (
      <span className={`${styles.badge} ${BADGE[value as ItemStatus] ?? ""}`}>
        {value as string}
      </span>
    ),
  },
  { key: "date",   label: "Fecha",  cellClass: styles.muteCell },
  {
    key: "amount",
    label: "Monto",
    cellClass: styles.amountCell,
    render: (value) => `$${(value as number).toLocaleString()}`,
  },
  {
    key: "href",
    label: "Actions",
    sortable: false,
    render: (value) =>
      typeof value === "string" && value ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link
            href={value}
            aria-label="Open filing"
            title="Open filing"
            className={iconButtonClasses({ variant: "dark" })}
          >
            <ActionIcon name="view" />
          </Link>
        </div>
      ) : null,
  },
];

function exportCSV(data: Item[]) {
  const rows = [
    ["#", "Nombre", "Categoria", "Estado", "Fecha", "Monto"],
    ...data.map((row) => [row.id, row.name, row.category, row.status, row.date, row.amount]),
  ];
  const anchor = document.createElement("a");
  anchor.href = `data:text/csv,${encodeURIComponent(rows.map((r) => r.join(",")).join("\n"))}`;
  anchor.download = "items.csv";
  anchor.click();
}

interface Props {
  data: Item[];
  searchQuery: string;
}

export default function DataTable({ data, searchQuery }: Props) {
  const actions: TableAction[] = [];

  return (
    <Table
      data={data}
      columns={columns}
      actions={actions}
      searchQuery={searchQuery}
      title="Mys Fillings"
    />
  );
}
