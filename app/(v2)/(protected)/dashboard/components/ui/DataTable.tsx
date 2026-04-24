"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getStatusTone } from "@/lib/ui/status-utils";
import type { Item } from "@/lib/types";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import Table, { type ColumnDef, type TableAction } from "./Table";
import styles from "./DataTable.module.css";

const columns: ColumnDef<Item>[] = [
  { key: "id",       label: "#",         cellClass: styles.idCell },
  { key: "name",     label: "Nombre",    cellClass: styles.nameCell },
  { key: "category", label: "Categoria", cellClass: styles.muteCell },
  {
    key: "status",
    label: "Estado",
    render: (value, row) => (
      <Badge tone={row.statusTone ?? getStatusTone(String(value ?? ""))} variant="light">
        {String(value ?? "")}
      </Badge>
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
      title="My Filings"
    />
  );
}
