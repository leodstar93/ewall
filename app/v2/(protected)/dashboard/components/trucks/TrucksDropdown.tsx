"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { MouseEvent } from "react";
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
  sortPlate: string;
  sortVin: string;
};

type TruckFormState = {
  unitNumber: string;
  plateNumber: string;
  hasNoPlate: boolean;
  vin: string;
  make: string;
  modelName: string;
  year: string;
  grossWeight: string;
};

type TrucksPayload = {
  trucks?: TruckRecord[];
  error?: string;
};

type ProviderTruckSyncPayload = {
  message?: string;
  error?: string;
};

const NUM_CLASS: Record<TruckStatus, string> = {
  Activo: "",
  "En transito": "",
  Mantenimiento: styles.numRed,
  Inactivo: styles.numGray,
};

const emptyForm: TruckFormState = {
  unitNumber: "",
  plateNumber: "",
  hasNoPlate: false,
  vin: "",
  make: "",
  modelName: "",
  year: "",
  grossWeight: "",
};

interface Props {
  trucks: DashboardTruckRow[];
  onTruckCreated?: (truck: TruckRecord) => void;
  onTruckHidden?: (truckId: string) => void;
  onTrucksSynced?: (trucks: TruckRecord[]) => void;
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
    sortPlate: truck.plateNumber || "No plate",
    sortVin: truck.vin || "No VIN",
  }));
}

function toFormState(truck: DashboardTruckRow): TruckFormState {
  return {
    unitNumber: truck.unitNumber,
    plateNumber: truck.plateNumber,
    hasNoPlate: !truck.plateNumber,
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
    plateNumber: form.hasNoPlate ? null : form.plateNumber || null,
    vin: form.vin || null,
    make: form.make || null,
    model: form.modelName || null,
    year: form.year ? Number(form.year) : null,
    grossWeight: form.grossWeight ? Number(form.grossWeight) : null,
  };
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75z" />
      <path d="M10.75 6.5 13.5 9.25" />
      <path d="M11.5 4.25 14.25 1.5 18.5 5.75 15.75 8.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 5 15 15" />
      <path d="M15 5 5 15" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 5h14" />
      <path d="M8 5V3.5h4V5" />
      <path d="M6 7v9.5h8V7" />
      <path d="M8.5 9.5v4.5" />
      <path d="M11.5 9.5v4.5" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M16.5 7.5A6 6 0 0 0 5.4 5.2L3.5 7.5" />
      <path d="M3.5 4.2v3.3h3.3" />
      <path d="M3.5 12.5a6 6 0 0 0 11.1 2.3l1.9-2.3" />
      <path d="M16.5 15.8v-3.3h-3.3" />
    </svg>
  );
}

export default function TrucksDropdown({
  trucks,
  onTruckCreated,
  onTruckHidden,
  onTrucksSynced,
  onTruckUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [form, setForm] = useState<TruckFormState>(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [hidingTruckId, setHidingTruckId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const rows = useMemo(() => buildRows(trucks), [trucks]);

  function startAdd() {
    setEditingTruckId(null);
    setForm(emptyForm);
    setSaveError("");
    setIsModalOpen(true);
  }

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

    try {
      setSaving(true);
      setSaveError("");

      const response = await fetch(
        editingTruckId
          ? `/api/v1/features/ifta/trucks/${editingTruckId}`
          : "/api/v1/features/ifta/trucks",
        {
          method: editingTruckId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toPayload(form)),
        },
      );

      const payload = (await response
        .json()
        .catch(() => ({}))) as TruckRecord & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (editingTruckId
              ? "Could not update the truck."
              : "Could not create the truck."),
        );
      }

      if (editingTruckId) {
        onTruckUpdated?.(payload);
      } else {
        onTruckCreated?.(payload);
        setOpen(true);
      }

      closeModal(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : editingTruckId
            ? "Could not update the truck."
            : "Could not create the truck.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function hideTruck(truck: DashboardTruckRow) {
    const confirmed = window.confirm(
      `Delete truck ${truck.unitNumber} from your dashboard? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setHidingTruckId(truck.truckId);
      const response = await fetch(
        `/api/v1/features/ifta/trucks/${truck.truckId}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete the truck.");
      }

      onTruckHidden?.(truck.truckId);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not delete the truck.",
      );
      setEditingTruckId(null);
      setForm(emptyForm);
      setIsModalOpen(true);
    } finally {
      setHidingTruckId(null);
    }
  }

  async function syncTrucksFromEld(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    try {
      setSyncing(true);
      setSaveError("");

      const syncResponse = await fetch(
        "/api/v1/features/ifta/trucks/sync-provider",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const syncPayload = (await syncResponse
        .json()
        .catch(() => ({}))) as ProviderTruckSyncPayload;

      if (!syncResponse.ok) {
        throw new Error(syncPayload.error || "Could not sync trucks from ELD.");
      }

      const trucksResponse = await fetch("/api/v1/features/ifta/trucks", {
        cache: "no-store",
      });
      const trucksPayload = (await trucksResponse
        .json()
        .catch(() => ({}))) as TrucksPayload;

      if (!trucksResponse.ok) {
        throw new Error(trucksPayload.error || "Could not refresh trucks.");
      }

      onTrucksSynced?.(
        Array.isArray(trucksPayload.trucks) ? trucksPayload.trucks : [],
      );
      setOpen(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not sync trucks from ELD.",
      );
      setEditingTruckId(null);
      setForm(emptyForm);
      setIsModalOpen(true);
    } finally {
      setSyncing(false);
    }
  }

  const tableTitle = "";

  const columns: ColumnDef<TruckTableRow>[] = [
    {
      key: "sortUnit",
      label: "Unit",
      render: (_, truck) => (
        <div className={styles.unitCell}>
          <div className={`${styles.num} ${NUM_CLASS[truck.status]}`}>
            {truck.unitNumber}
          </div>
          <div
            className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
            title={`${truck.unitNumber} - ${truck.vehicleLabel}`}
          >
            {truck.vehicleLabel}
          </div>
        </div>
      ),
    },
    {
      key: "sortPlate",
      label: "Plate",
      render: (_, truck) => (
        <div className={tableStyles.muteCell} style={{ fontSize: 13 }}>
          {truck.plateNumber || "No plate"}
        </div>
      ),
    },
    {
      key: "sortVin",
      label: "VIN",
      render: (_, truck) => (
        <div className={tableStyles.muteCell} style={{ fontSize: 13 }}>
          {truck.vin || "No VIN"}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, truck) => (
        <div className={styles.actionCell}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => startEdit(truck)}
            aria-label={`Edit truck ${truck.unitNumber}`}
            title={`Edit truck ${truck.unitNumber}`}
            disabled={hidingTruckId === truck.truckId}
          >
            <EditIcon />
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.dangerActionButton}`}
            onClick={() => void hideTruck(truck)}
            aria-label={`Delete truck ${truck.unitNumber}`}
            title={`Delete truck ${truck.unitNumber}`}
            disabled={hidingTruckId === truck.truckId}
          >
            {hidingTruckId === truck.truckId ? (
              <span className={styles.busyDot} />
            ) : (
              <DeleteIcon />
            )}
          </button>
        </div>
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
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
              >
                <rect x="1" y="3" width="15" height="13" rx="1" />
                <path d="M16 8h4l3 5v4h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span className={styles.triggerLabel}>Trucks and Trails</span>
            <span className={styles.triggerCount}>
              ({trucks.length} unidades)
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                startAdd();
              }}
              disabled={saving || syncing}
              className={styles.iconActionButton}
              aria-label="Add truck"
              title="Add truck"
            >
              <span className={styles.iconActionPlus}>+</span>
            </button>
            <button
              type="button"
              onClick={syncTrucksFromEld}
              disabled={saving || syncing}
              className={`${styles.iconActionButton} ${styles.syncActionButton}`}
              aria-label="Sync Trucks from ELD"
              title="Sync Trucks from ELD"
            >
              {syncing ? <span className={styles.busyDot} /> : <SyncIcon />}
              <span>{syncing ? "Syncing..." : "Sync"}</span>
            </button>
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
              title={tableTitle}
              hideHeader
              searchQuery={query}
              searchKeys={["searchText"]}
              toolbar={
                <div className={styles.toolbar}>
                  <div className={styles.searchBox}>
                    <svg
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="#bbb"
                      strokeWidth="2"
                    >
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
              <h3 className={styles.modalTitle}>
                {editingTruckId ? "Update truck details" : "Add truck"}
              </h3>
              <p className={styles.modalText}>
                {editingTruckId
                  ? "Edit this unit without leaving the dashboard. Keep the fleet card clean and current."
                  : "Register a new unit without leaving the dashboard. It will appear in this fleet table immediately."}
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
              {saveError ? (
                <div className={styles.modalError}>{saveError}</div>
              ) : null}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Unit number</span>
                  <input
                    value={form.unitNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        unitNumber: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <div className={styles.field}>
                  <span>Plate</span>
                  <div className={styles.plateInputRow}>
                    <input
                      value={form.plateNumber}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          plateNumber: event.target.value.toUpperCase(),
                          hasNoPlate: false,
                        }))
                      }
                      className={styles.uppercaseInput}
                      disabled={form.hasNoPlate}
                      aria-label="Plate"
                    />
                    <label className={styles.noPlateCheck}>
                      <input
                        type="checkbox"
                        checked={form.hasNoPlate}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            hasNoPlate: event.target.checked,
                            plateNumber: event.target.checked
                              ? ""
                              : current.plateNumber,
                          }))
                        }
                      />
                      <span>No plate</span>
                    </label>
                  </div>
                </div>
                <label className={styles.field}>
                  <span>VIN</span>
                  <input
                    value={form.vin}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vin: event.target.value.toUpperCase(),
                      }))
                    }
                    className={styles.uppercaseInput}
                  />
                </label>
                <label className={styles.field}>
                  <span>Make</span>
                  <input
                    value={form.make}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        make: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Model</span>
                  <input
                    value={form.modelName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        modelName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Year</span>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        year: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Gross weight</span>
                  <input
                    type="number"
                    min="0"
                    value={form.grossWeight}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        grossWeight: event.target.value,
                      }))
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
                  {saving
                    ? "Saving..."
                    : editingTruckId
                      ? "Save changes"
                      : "Create truck"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
