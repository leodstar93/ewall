"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import tableStyles from "@/app/(v2)/(protected)/dashboard/components/ui/DataTable.module.css";
import styles from "@/app/(v2)/(protected)/dashboard/ucr/[id]/ucr-detail.module.css";
import form2290Styles from "@/features/form2290/detail-page.module.css";
import StaffFilingPaymentPanel from "@/components/ach/StaffFilingPaymentPanel";
import Form2290FilingForm from "@/features/form2290/filing-form";
import {
  complianceClasses,
  complianceLabel,
  documentTypeLabel,
  Form2290DocumentType,
  Form2290Filing,
  formatCurrency,
  formatDate,
  formatDateOnly,
  getComplianceStateForFiling,
  paymentStatusClasses,
  paymentStatusLabel,
  statusClasses,
  statusLabel,
} from "@/features/form2290/shared";

type DetailPayload = {
  filing: Form2290Filing;
  compliance: {
    compliant: boolean;
    expired: boolean;
  };
  permissions: {
    isOwner: boolean;
    canManageAll: boolean;
    canEdit: boolean;
    canDelete?: boolean;
    canSubmit: boolean;
    canMarkSubmitted: boolean;
    canRequestCorrection: boolean;
    canMarkPaid: boolean;
    canUploadSchedule1: boolean;
    canUploadDocuments: boolean;
    canAuthorize: boolean;
    canStaffWorkflow: boolean;
    canViewAudit?: boolean;
  };
};

type DetailPageProps = {
  filingId: string;
  mode: "driver" | "staff";
  apiBasePath?: string;
  documentsApiBasePath?: string;
  backHref?: string;
  detailHrefBase?: string;
};

type KeyValueRow = {
  label: string;
  value: string;
};

type DocumentRow = {
  id: string;
  name: string;
  type: string;
  date: string;
  viewHref: string;
  downloadHref: string;
};

type TimelineRow = {
  id: string;
  event: string;
  detail: string;
  date: string;
};

function formatAuditEvent(action: string) {
  return action.replaceAll("_", " ");
}

function formatAuditLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("en-US");
  if (typeof value !== "string") return null;

  if (key.toLowerCase().includes("amount")) {
    return formatCurrency(value);
  }

  if (key.toLowerCase().includes("at") && !Number.isNaN(Date.parse(value))) {
    return formatDate(value);
  }

  return value.replaceAll("_", " ");
}

function formatAuditDetail(metaJson: unknown) {
  const fallback = "Status updated";
  if (!metaJson || typeof metaJson !== "object") {
    return fallback;
  }

  const meta = metaJson as Record<string, unknown>;
  if (typeof meta.fromStatus === "string" && typeof meta.toStatus === "string") {
    return `${meta.fromStatus.replaceAll("_", " ")} to ${meta.toStatus.replaceAll("_", " ")}`;
  }

  const candidates = [
    meta.message,
    meta.reason,
    meta.documentName,
    meta.documentType,
    meta.status,
  ];
  const detail = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (detail) return detail.replaceAll("_", " ");

  const hiddenKeys = new Set([
    "documentId",
    "filingId",
    "organizationId",
    "schedule1DocumentId",
    "taxPeriodId",
    "truckId",
  ]);
  const detailParts = Object.entries(meta)
    .filter(([key]) => !hiddenKeys.has(key) && !key.toLowerCase().endsWith("id"))
    .map(([key, value]) => {
      const formattedValue = formatAuditValue(key, value);
      return formattedValue ? `${formatAuditLabel(key)}: ${formattedValue}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return detailParts.length > 0 ? detailParts.join("; ") : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const ACTION_SUCCESS_MESSAGES: Record<string, string> = {
  submit: "Filing submitted for review.",
  claim: "Filing assigned to you.",
  "start-review": "Review started.",
  "mark-ready-to-file": "Marked ready to file.",
  "mark-payment-received": "Payment received.",
  "mark-filed": "Marked as filed.",
  "mark-compliant": "Filing finalized.",
  cancel: "Filing cancelled.",
  reopen: "Filing reopened.",
  "request-correction": "Need attention sent.",
};

function StatusChip({ label, className }: { label: string; className: string }) {
  return <span className={`${styles.statusChip} ${className}`}>{label}</span>;
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
  );
}

function KeyValueTable({ rows }: { rows: KeyValueRow[] }) {
  return (
    <div className={tableStyles.tableWrap}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className={tableStyles.nameCell}>{row.label}</td>
              <td className={tableStyles.muteCell}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTable({ rows }: { rows: DocumentRow[] }) {
  return (
    <div className={tableStyles.tableWrap}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>Document</th>
            <th>Type</th>
            <th>Uploaded</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.emptyCell}>
                No documents uploaded yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className={tableStyles.nameCell}>{row.name}</td>
                <td className={tableStyles.muteCell}>{row.type}</td>
                <td className={tableStyles.muteCell}>{row.date}</td>
                <td>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href={row.viewHref} target="_blank" rel="noreferrer" className={styles.tableLink}>
                      View
                    </a>
                    <a href={row.downloadHref} className={styles.tableLink}>
                      Download
                    </a>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TimelineTable({ rows }: { rows: TimelineRow[] }) {
  return (
    <div className={`${tableStyles.tableWrap} ${styles.auditTableWrap}`}>
      <table className={tableStyles.table}>
        <thead>
          <tr>
            <th>Event</th>
            <th>Details</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className={styles.emptyCell}>
                No workflow events yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className={tableStyles.nameCell}>{row.event}</td>
                <td className={tableStyles.muteCell}>{row.detail}</td>
                <td className={tableStyles.muteCell}>{row.date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Form2290DetailPage(props: DetailPageProps) {
  const router = useRouter();
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [achModalOpen, setAchModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [schedule1File, setSchedule1File] = useState<File | null>(null);
  const schedule1InputRef = useRef<HTMLInputElement | null>(null);

  const [correctionMessage, setCorrectionMessage] = useState("");
  const [paidAt, setPaidAt] = useState("");

  const detailHrefBase =
    props.detailHrefBase ??
    (props.mode === "staff" ? "/admin/features/2290" : "/2290");
  const backHref =
    props.backHref ??
    (props.mode === "staff" ? "/admin/features/2290" : "/2290");

  const load = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}`,
        {
          cache: "no-store",
        },
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as DetailPayload & { error?: string };
      if (!response.ok || !data.filing) {
        throw new Error(data.error || "Could not load the Form 2290 filing.");
      }

      setPayload(data);
      setPaidAt(
        data.filing.paidAt
          ? new Date(data.filing.paidAt).toISOString().slice(0, 10)
          : "",
      );
      setCorrectionMessage("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the filing.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [props.apiBasePath, props.filingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const complianceState = useMemo(
    () => (payload ? getComplianceStateForFiling(payload.filing) : null),
    [payload],
  );

  async function attachSupportingDocument() {
    if (!documentFile) {
      toast.error("Please choose a file to upload.");
      return;
    }

    try {
      setBusyAction("document");
      const formData = new FormData();
      formData.append("file", documentFile);
      const documentsAttachBase =
        props.mode === "staff"
          ? "/api/v1/features/2290"
          : (props.apiBasePath ?? "/api/v1/features/2290");
      const response = await fetch(
        `${documentsAttachBase}/${props.filingId}/documents`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not attach the document.");
      }

      setDocumentFile(null);
      setDocumentModalOpen(false);
      await load();
      toast.success("Document uploaded and attached to this filing.");
    } catch (uploadError) {
      toast.error(getErrorMessage(uploadError, "Could not attach the document."));
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadSchedule1(file: File | null | undefined) {
    if (!file) {
      const message = "Please choose a Schedule 1 file to upload.";
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setBusyAction("schedule1");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}/upload-schedule1`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not upload Schedule 1.");
      }

      await load();
      toast.success("Schedule 1 uploaded and filing finalized.");
      setFinalizeModalOpen(false);
      setSchedule1File(null);
    } catch (uploadError) {
      toast.error(getErrorMessage(uploadError, "Could not upload Schedule 1."));
    } finally {
      setBusyAction(null);
      if (schedule1InputRef.current) {
        schedule1InputRef.current.value = "";
      }
    }
  }

  async function runAction(
    endpoint:
      | "submit"
      | "request-correction"
      | "claim"
      | "start-review"
      | "mark-ready-to-file"
      | "mark-payment-received"
      | "mark-filed"
      | "mark-compliant"
      | "cancel"
      | "reopen",
    body?: Record<string, unknown>,
  ) {
    try {
      setBusyAction(endpoint);
      const base =
        props.mode === "staff" &&
        endpoint !== "submit"
          ? "/api/v1/admin/2290"
          : (props.apiBasePath ?? "/api/v1/features/2290");
      const response = await fetch(`${base}/${props.filingId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
        details?: string[];
      };
      if (!response.ok) {
        if (endpoint === "submit" && data.code === "ACH_PAYMENT_METHOD_REQUIRED") {
          toast.error(
            <span>
              {data.error || "An active, authorized ACH payment method is required."}{" "}
              <Link href="/dashboard/payments" className={styles.inlineLink}>
                Add ACH payment method
              </Link>
            </span>,
          );
          return;
        }

        throw new Error(
          [data.error, ...(Array.isArray(data.details) ? data.details : [])]
            .filter(Boolean)
            .join(" ") || "The action failed.",
        );
      }

      await load();
      toast.success(ACTION_SUCCESS_MESSAGES[endpoint] ?? "Done.");
    } catch (actionError) {
      toast.error(
        actionError instanceof Error ? actionError.message : "The action failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function sendNote() {
    const message = correctionMessage.trim();
    if (!message) {
      toast.error("Write a note before sending.");
      return;
    }

    try {
      setBusyAction("request-correction");
      const base =
        props.mode === "staff"
          ? "/api/v1/admin/2290"
          : (props.apiBasePath ?? "/api/v1/features/2290");
      const response = await fetch(`${base}/${props.filingId}/request-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string[];
      };
      if (!response.ok) {
        throw new Error(
          [data.error, ...(Array.isArray(data.details) ? data.details : [])]
            .filter(Boolean)
            .join(" ") || "Could not send the note.",
        );
      }

      setCorrectionMessage("");
      await load();
      toast.success("Note sent.");
    } catch (noteError) {
      toast.error(getErrorMessage(noteError, "Could not send the note."));
    } finally {
      setBusyAction(null);
    }
  }

  async function requestAttention() {
    const result = await Swal.fire({
      title: "Need attention",
      input: "textarea",
      inputLabel: "Message to client",
      inputPlaceholder: "Tell the client what needs to be corrected.",
      inputAttributes: {
        "aria-label": "Message to client",
      },
      showCancelButton: true,
      confirmButtonText: "Send to client",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b22234",
      cancelButtonColor: "#64748b",
      inputValidator: (value) => {
        if (!value?.trim()) return "Write a message for the client.";
        return null;
      },
    });

    const message = typeof result.value === "string" ? result.value.trim() : "";
    if (!result.isConfirmed || !message) return;

    await runAction("request-correction", { message, needAttention: true });
  }

  async function deleteFiling() {
    if (!payload?.filing) return;
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete Form 2290 filing?",
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b22234",
      cancelButtonColor: "#64748b",
    });
    if (!result.isConfirmed) return;

    try {
      setBusyAction("delete");
      setError(null);
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not delete this Form 2290 filing.");
      }

      toast.success("Form 2290 filing deleted.");
      router.push(backHref);
      router.refresh();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this Form 2290 filing.";
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  }

  const filing = payload?.filing ?? null;
  const permissions = payload?.permissions ?? null;

  const documentRows = useMemo<DocumentRow[]>(() => {
    if (!filing) return [];

    return filing.documents.map((item) => ({
      id: item.id,
      name: item.document.name,
      type: documentTypeLabel(item.type),
      date: formatDate(item.createdAt),
      viewHref: `${props.documentsApiBasePath ?? "/api/v1/features/documents"}/${item.document.id}/view`,
      downloadHref: `${props.documentsApiBasePath ?? "/api/v1/features/documents"}/${item.document.id}/download`,
    }));
  }, [filing, props.documentsApiBasePath]);

  const timelineRows = useMemo<TimelineRow[]>(() => {
    if (!filing) return [];

    return [...filing.activityLogs]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      .map((entry) => ({
        id: entry.id,
        event: formatAuditEvent(entry.action),
        detail: formatAuditDetail(entry.metaJson),
        date: formatDate(entry.createdAt),
      }));
  }, [filing]);

  if (loading) {
    return <div className={styles.loadingCard}>Loading Form 2290 filing...</div>;
  }

  if (error && !payload) {
    return <div className={styles.alertError}>{error}</div>;
  }

  if (!filing || !permissions || !complianceState) {
    return null;
  }

  const vehicleRows: KeyValueRow[] = [
    { label: "Unit", value: filing.unitNumberSnapshot || filing.truck.unitNumber || "-" },
    { label: "VIN", value: filing.vinSnapshot || "-" },
    {
      label: "Vehicle",
      value: [filing.truck.year, filing.truck.make, filing.truck.model].filter(Boolean).join(" ") || "-",
    },
    {
      label: "Gross weight",
      value: filing.grossWeightSnapshot
        ? `${filing.grossWeightSnapshot.toLocaleString("en-US")} lbs`
        : "Not set",
    },
    {
      label: "Taxable gross weight",
      value: filing.taxableGrossWeightSnapshot
        ? `${filing.taxableGrossWeightSnapshot.toLocaleString("en-US")} lbs`
        : "Not set",
    },
    { label: "Logging vehicle", value: filing.loggingVehicle === null ? "Not set" : filing.loggingVehicle ? "Yes" : "No" },
    { label: "Suspended vehicle", value: filing.suspendedVehicle === null ? "Not set" : filing.suspendedVehicle ? "Yes" : "No" },
    { label: "Tax period", value: filing.taxPeriod.name },
    {
      label: "First used",
      value:
        filing.firstUsedMonth && filing.firstUsedYear
          ? `${filing.firstUsedMonth}/${filing.firstUsedYear}`
          : "Not set",
    },
    { label: "Expires", value: formatDateOnly(filing.expiresAt) },
  ];

  const paymentRows: KeyValueRow[] = [
    {
      label: "Tax amount",
      value: formatCurrency(filing.amountDue),
    },
    { label: "Service fee", value: formatCurrency(filing.serviceFeeAmount) },
    { label: "Paid amount", value: formatCurrency(filing.customerPaidAmount) },
    { label: "Balance due", value: formatCurrency(filing.customerBalanceDue) },
    { label: "Credit", value: formatCurrency(filing.customerCreditAmount) },
    { label: "Payment status", value: paymentStatusLabel(filing.paymentStatus) },
    { label: "Payment handling", value: filing.paymentHandling.replaceAll("_", " ") },
    { label: "Paid at", value: formatDateOnly(filing.paidAt) },
  ];

  const companyName =
    filing.organization?.legalName ||
    filing.organization?.companyName ||
    filing.organization?.name ||
    "-";
  const companyDot = filing.organization?.dotNumber || "-";

  return (
    <div className={styles.page}>
      <section className={styles.container}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.eyebrow}>Form 2290 Filing</p>
              <h1 className={styles.title}>
                {companyName}
              </h1>
              <p className={styles.subtitle}>
                Tax period {filing.taxPeriod.name} | Updated {formatDate(filing.updatedAt)}
              </p>
              <p className={styles.subtitle}>
                DOT {companyDot}
              </p>
            </div>
            <div className={styles.headerActions}>
              <Link href={backHref} className={styles.secondaryButton}>
                Back
              </Link>
              {props.mode === "driver" && permissions.canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className={styles.secondaryButton}
                >
                  Edit filing
                </button>
              ) : null}
              {props.mode === "driver" && permissions.canDelete ? (
                <button
                  type="button"
                  onClick={() => void deleteFiling()}
                  disabled={busyAction === "delete"}
                  className={styles.secondaryButton}
                  style={{ borderColor: "#fecaca", color: "#b91c1c" }}
                >
                  {busyAction === "delete" ? "Deleting..." : "Delete filing"}
                </button>
              ) : null}
              {props.mode === "driver" && permissions.canSubmit ? (
                <button
                  type="button"
                  onClick={() => void runAction("submit")}
                  disabled={busyAction === "submit"}
                  className={styles.primaryButton}
                >
                  {busyAction === "submit" ? "Working..." : "Submit for review"}
                </button>
              ) : null}
              {props.mode === "driver" && permissions.canMarkSubmitted ? (
                <button
                  type="button"
                  onClick={() => void runAction("submit", { markSubmitted: true })}
                  disabled={busyAction === "submit"}
                  className={styles.secondaryButton}
                >
                  Mark submitted
                </button>
              ) : null}
              {props.mode === "staff" && permissions.canStaffWorkflow ? (
                <>
                  <button
                    type="button"
                    onClick={() => void runAction("claim")}
                    disabled={busyAction === "claim" || filing.status !== "SUBMITTED"}
                    className={styles.secondaryButton}
                  >
                    Assign to me
                  </button>
                  <button
                    type="button"
                    onClick={() => setAchModalOpen(true)}
                    className={styles.secondaryButton}
                  >
                    AHC Info
                  </button>
                  {permissions.canRequestCorrection ? (
                    <button
                      type="button"
                      onClick={() => void requestAttention()}
                      disabled={busyAction === "request-correction"}
                      className={styles.secondaryButton}
                    >
                      {busyAction === "request-correction" ? "Sending..." : "Need attention"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => { setSchedule1File(null); setFinalizeModalOpen(true); }}
                    disabled={filing.status !== "IN_PROCESS"}
                    className={styles.primaryButton}
                  >
                    Finalize filing
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className={styles.statusRow}>
            <StatusChip label={statusLabel(filing.status)} className={statusClasses(filing.status)} />
            <StatusChip
              label={`Payment: ${paymentStatusLabel(filing.paymentStatus)}`}
              className={paymentStatusClasses(filing.paymentStatus)}
            />
            <StatusChip
              label={complianceLabel(complianceState)}
              className={complianceClasses(complianceState)}
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.twoUp}>
            <div className={styles.subsection}>
              <SectionTitle eyebrow="Vehicle" title="Vehicle and period" />
              <KeyValueTable rows={vehicleRows} />
            </div>
            <div className={styles.subsection}>
              <SectionTitle eyebrow="Payment" title="Payment details" />
              <KeyValueTable rows={paymentRows} />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <p className={styles.eyebrow}>Files</p>
            <div className={styles.sectionTitleLine}>
              <h2 className={styles.sectionTitle}>Documents</h2>
              {permissions.canUploadDocuments ? (
                <button type="button" onClick={() => setDocumentModalOpen(true)} disabled={busyAction === "document"} className={styles.iconActionButton} aria-label="Upload document" title="Upload document">
                  <span className={styles.iconActionPlus}>+</span>
                </button>
              ) : null}
            </div>
          </div>
          <DocumentsTable rows={documentRows} />
        </div>

        <div className={styles.section}>
          <SectionTitle eyebrow="Conversation" title="Notes" />
          <div className={styles.chatThread}>
            {filing.corrections.length === 0 ? (
              <div className={styles.chatEmpty}>No notes yet. Start the conversation here.</div>
            ) : (
              filing.corrections.map((note) => {
                const isClientNote = note.requestedById === filing.userId;
                const authorName = isClientNote
                  ? filing.user?.name || filing.user?.email || "Client"
                  : "Staff/Admin";
                const ownSide =
                  props.mode === "staff" ? !isClientNote : isClientNote;
                return (
                  <article
                    key={note.id}
                    className={`${styles.chatMessage} ${
                      ownSide ? styles.chatMessageClient : styles.chatMessageStaff
                    }`}
                  >
                    <div className={styles.chatMeta}>
                      <strong>{authorName}</strong>
                      <span>{formatDate(note.createdAt)}</span>
                    </div>
                    <p className={styles.chatBody}>{note.message}</p>
                  </article>
                );
              })
            )}
          </div>

          {permissions.canRequestCorrection ? (
            <div className={styles.chatComposer}>
              <label className={styles.fieldBlock}>
                <span className={styles.fieldLabel}>New note</span>
                <textarea
                  value={correctionMessage}
                  onChange={(event) => setCorrectionMessage(event.target.value)}
                  className={styles.textarea}
                  placeholder={
                    props.mode === "staff"
                      ? "Write a note for the client about this filing."
                      : "Write a note for staff about this filing."
                  }
                />
              </label>
              <div className={styles.noteActions}>
                <button
                  type="button"
                  onClick={() => setCorrectionMessage("")}
                  disabled={!correctionMessage || busyAction === "request-correction"}
                  className={styles.secondaryButton}
                >
                  Clear
                </button>
                <button type="button" onClick={() => void sendNote()} disabled={busyAction === "request-correction"} className={styles.primaryButton}>
                  {busyAction === "request-correction" ? "Sending..." : "Send note"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {permissions.canViewAudit ? <div className={styles.section}>
          <SectionTitle eyebrow="Audit" title="Audit" />
          <TimelineTable rows={timelineRows} />
        </div> : null}
      </section>

      {editModalOpen && permissions.canEdit ? (
        <div className={`${styles.modalOverlay} ${form2290Styles.editModalOverlay}`} onClick={() => setEditModalOpen(false)}>
          <div className={`${styles.modalCard} ${form2290Styles.editModalCard}`} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Edit</p>
                <h2 className={styles.sectionTitle}>Update Form 2290 filing</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditModalOpen(false)}>
                Close
              </button>
            </div>

            <div className={form2290Styles.editModalBody}>
              <Form2290FilingForm
                mode="edit"
                filingId={filing.id}
                detailHrefBase={detailHrefBase}
                apiBasePath={props.apiBasePath}
                vehiclesApiPath={`${props.apiBasePath ?? "/api/v1/features/2290"}/vehicles`}
                taxPeriodsApiPath={`${props.apiBasePath ?? "/api/v1/features/2290"}/tax-periods`}
                initialValues={{
                  truckId: filing.truckId,
                  taxPeriodId: filing.taxPeriodId,
                  firstUsedMonth: filing.firstUsedMonth,
                  firstUsedYear: filing.firstUsedYear,
                  notes: filing.notes,
                  taxableGrossWeight: filing.taxableGrossWeightSnapshot,
                  loggingVehicle: filing.loggingVehicle,
                  suspendedVehicle: filing.suspendedVehicle,
                  confirmationAccepted: Boolean(filing.confirmationAcceptedAt),
                }}
                onSaved={() => {
                  setEditModalOpen(false);
                  void load();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {documentModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (busyAction === "document") return;
            setDocumentModalOpen(false);
            setDocumentFile(null);
          }}
        >
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Files</p>
                <h2 className={styles.sectionTitle}>Upload Form 2290 document</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setDocumentModalOpen(false)} disabled={busyAction === "document"}>
                Close
              </button>
            </div>

            <label className={styles.uploadField}>
              <span className={styles.uploadFieldLabel}>Document file</span>
              <input type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3" />
              <span className={styles.uploadFieldHelp}>
                The system will auto-classify and attach it to this filing.
              </span>
            </label>

            <div className={styles.noteActions}>
              <button type="button" onClick={() => setDocumentModalOpen(false)} className={styles.secondaryButton} disabled={busyAction === "document"}>
                Cancel
              </button>
              <button type="button" onClick={() => void attachSupportingDocument()} className={styles.primaryButton} disabled={busyAction === "document" || !documentFile}>
                {busyAction === "document" ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {achModalOpen && props.mode === "staff" && permissions.canStaffWorkflow
        ? createPortal(
            <div
              className={`${styles.modalOverlay} ${form2290Styles.achModalOverlay}`}
              onClick={() => setAchModalOpen(false)}
            >
              <div
                className={`${styles.modalCard} ${form2290Styles.achModalCard}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <div>
                    <p className={styles.eyebrow}>AHC Info</p>
                    <h2 className={styles.sectionTitle}>ACH Manual Payment</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setAchModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <div className={form2290Styles.achModalBody}>
                  <StaffFilingPaymentPanel
                    filingId={filing.id}
                    filingType="form2290"
                    onAuditRecorded={() => load({ showLoading: false })}
                    showManualTracking={false}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {finalizeModalOpen
        ? createPortal(
            <div
              className={styles.modalOverlay}
              onClick={() => {
                if (busyAction === "schedule1") return;
                setFinalizeModalOpen(false);
                setSchedule1File(null);
              }}
            >
              <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <div>
                    <p className={styles.eyebrow}>Finalize</p>
                    <h2 className={styles.sectionTitle}>Upload Schedule 1 &amp; finalize</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => { setFinalizeModalOpen(false); setSchedule1File(null); }}
                    disabled={busyAction === "schedule1"}
                  >
                    Close
                  </button>
                </div>

                <label className={styles.uploadField}>
                  <span className={styles.uploadFieldLabel}>Schedule 1 (IRS stamped)</span>
                  <input
                    ref={schedule1InputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setSchedule1File(e.target.files?.[0] ?? null)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                  />
                  <span className={styles.uploadFieldHelp}>
                    Upload the IRS-stamped Schedule 1. This will mark the filing as finalized.
                  </span>
                </label>

                <div className={styles.noteActions}>
                  <button
                    type="button"
                    onClick={() => { setFinalizeModalOpen(false); setSchedule1File(null); }}
                    className={styles.secondaryButton}
                    disabled={busyAction === "schedule1"}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void uploadSchedule1(schedule1File)}
                    className={styles.primaryButton}
                    style={{ background: "#2563eb", borderColor: "#2563eb" }}
                    disabled={busyAction === "schedule1" || !schedule1File}
                  >
                    {busyAction === "schedule1" ? "Finalizing..." : "Finalize filing"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
