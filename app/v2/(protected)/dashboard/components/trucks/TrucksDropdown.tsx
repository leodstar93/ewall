"use client";

import { useMemo, useState, type FormEvent } from "react";
import Table, { type ColumnDef } from "../ui/Table";
import tableStyles from "../ui/DataTable.module.css";
import type { TruckRecord } from "@/features/trucks/shared";
import type { TruckStatus } from "@/lib/types";
import styles from "./TrucksDropdown.module.css";

export type DashboardTruckRow = {
  truckId: string;
  unitNumber: string;
  vehicleLabel: string;
  alias: string;
  identifier: string;
  usage: string;
  status: TruckStatus;
  nickname: string;
  plateNumber: string;
  vin: string;
  make: string;
  modelName: string;
  year: string;
  grossWeight: string;
};

type TruckTableRow = DashboardTruckRow & {
  searchText: string;
  sortUnit: string;
  sortAlias: string;
  sortIdentifier: string;
  sortStatus: string;
};

type TruckFormState = {
  unitNumber: string;
  nickname: string;
  plateNumber: string;
  vin: string;
  make: string;
  modelName: string;
  year: string;
  grossWeight: string;
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

const emptyForm: TruckFormState = {
  unitNumber: "",
  nickname: "",
  plateNumber: "",
  vin: "",
  make: "",
  modelName: "",
  year: "",
  grossWeight: "",
};

interface Props {
  trucks: DashboardTruckRow[];
  onTruckUpdated?: (truck: TruckRecord) => void;
}

function buildRows(trucks: DashboardTruckRow[]): TruckTableRow[] {
  return trucks.map((truck) => ({
    ...truck,
    searchText: [
      truck.unitNumber,
      truck.vehicleLabel,
      truck.alias,
      truck.identifier,
      truck.usage,
      truck.status,
      truck.nickname,
      truck.plateNumber,
      truck.vin,
      truck.make,
      truck.modelName,
    ]
      .join(" ")
      .toLowerCase(),
    sortUnit: truck.unitNumber,
    sortAlias: truck.alias,
    sortIdentifier: truck.identifier,
    sortStatus: truck.status,
  }));
}

function toFormState(truck: DashboardTruckRow): TruckFormState {
  return {
    unitNumber: truck.unitNumber,
    nickname: truck.nickname,
    plateNumber: truck.plateNumber,
    vin: truck.vin,
    make: truck.make,
    modelName: truck.modelName,
    year: truck.year,
    grossWeight: truck.grossWeight,
  };
}

function toPayload(form: TruckFormState) {
  return {
    unitNumber: form.unitNumber,
    nickname: form.nickname || null,
    plateNumber: form.plateNumber || null,
    vin: form.vin || null,
    make: form.make || null,
    model: form.modelName || null,
    year: form.year ? Number(form.year) : null,
    grossWeight: form.grossWeight ? Number(form.grossWeight) : null,
  };
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75z" />
      <path d="M10.75 6.5 13.5 9.25" />
      <path d="M11.5 4.25 14.25 1.5 18.5 5.75 15.75 8.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5 15 15" />
      <path d="M15 5 5 15" />
    </svg>
  );
}

export default function TrucksDropdown({ trucks, onTruckUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TruckStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [form, setForm] = useState<TruckFormState>(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return trucks.filter((truck) => filter === "all" || truck.status === filter);
  }, [trucks, filter]);

  const rows = useMemo(() => buildRows(filtered), [filtered]);

  function startEdit(truck: DashboardTruckRow) {
    setEditingTruckId(truck.truckId);
    setForm(toFormState(truck));
    setSaveError("");
    setIsModalOpen(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;
    setIsModalOpen(false);
    setEditingTruckId(null);
    setForm(emptyForm);
    setSaveError("");
  }

  async function saveTruck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTruckId) return;

    try {
      setSaving(true);
      setSaveError("");

      const response = await fetch(`/api/v1/features/ifta/trucks/${editingTruckId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload(form)),
      });

      const payload = (await response.json().catch(() => ({}))) as TruckRecord & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not update the truck.");
      }

      onTruckUpdated?.(payload);
      closeModal(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not update the truck.");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnDef<TruckTableRow>[] = [
    {
      key: "sortUnit",
      label: "Unit",
      render: (_, truck) => (
        <div className={styles.unitCell}>
          <div className={`${styles.num} ${NUM_CLASS[truck.status]}`}>{truck.unitNumber}</div>
          <div
            className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
            title={`${truck.unitNumber} · ${truck.vehicleLabel}`}
          >
            {truck.vehicleLabel}
          </div>
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
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, truck) => (
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => startEdit(truck)}
          aria-label={`Edit truck ${truck.unitNumber}`}
          title={`Edit truck ${truck.unitNumber}`}
        >
          <EditIcon />
        </button>
      ),
    },
  ];

  return (
    <>
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
                </div>
              }
            />
          </div>
        ) : null}
      </div>

      {isModalOpen ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <div className={styles.modalHero}>
              <div className={styles.modalBadge}>USA Fleet Edit</div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => closeModal()}
                aria-label="Close truck editor"
              >
                <CloseIcon />
              </button>
              <p className={styles.modalEyebrow}>Dashboard truck editor</p>
              <h3 className={styles.modalTitle}>Update truck details</h3>
              <p className={styles.modalText}>
                Edit this unit without leaving the dashboard. Keep the fleet card clean and current.
              </p>
              <div className={styles.flagRow} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <form className={styles.modalBody} onSubmit={saveTruck}>
              {saveError ? <div className={styles.modalError}>{saveError}</div> : null}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Unit number</span>
                  <input
                    value={form.unitNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, unitNumber: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Nickname</span>
                  <input
                    value={form.nickname}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, nickname: event.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Plate number</span>
                  <input
                    value={form.plateNumber}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, plateNumber: event.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>VIN</span>
                  <input
                    value={form.vin}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, vin: event.target.value.toUpperCase() }))
                    }
                    className={styles.uppercaseInput}
                  />
                </label>
                <label className={styles.field}>
                  <span>Make</span>
                  <input
                    value={form.make}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, make: event.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Model</span>
                  <input
                    value={form.modelName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, modelName: event.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Year</span>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, year: event.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Gross weight</span>
                  <input
                    type="number"
                    value={form.grossWeight}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, grossWeight: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => closeModal()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={saving || !form.unitNumber.trim()}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
