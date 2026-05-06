"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import tableStyles from "@/app/(v2)/(protected)/dashboard/components/ui/DataTable.module.css";
import styles from "@/app/(v2)/(protected)/dashboard/ucr/[id]/ucr-detail.module.css";
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

type UploadResponse = {
  id?: string;
  error?: string;
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

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
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const schedule1InputRef = useRef<HTMLInputElement | null>(null);

  const [correctionMessage, setCorrectionMessage] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [paidAt, setPaidAt] = useState("");

  const detailHrefBase =
    props.detailHrefBase ??
    (props.mode === "staff" ? "/admin/features/2290" : "/2290");
  const backHref =
    props.backHref ??
    (props.mode === "staff" ? "/admin/features/2290" : "/2290");

  const load = useCallback(async () => {
    try {
      setLoading(true);
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
      setAmountDue(data.filing.amountDue ?? "");
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
      setLoading(false);
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
      const message = "Please choose a file to upload.";
      setError(message);
      toast.error(message);
      return;
    }

    try {
      setBusyAction("document");
      setError(null);
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
      const message = getErrorMessage(uploadError, "Could not attach the document.");
      setError(message);
      toast.error(message);
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
      setError(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      formData.append("category", "FORM_2290");

      const uploadResponse = await fetch(
        props.documentsApiBasePath ?? "/api/v1/features/documents",
        {
          method: "POST",
          body: formData,
        },
      );
      const uploadData = (await uploadResponse.json().catch(() => ({}))) as UploadResponse;
      if (!uploadResponse.ok || !uploadData.id) {
        throw new Error(uploadData.error || "Could not upload Schedule 1.");
      }
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}/upload-schedule1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: uploadData.id }),
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
    } catch (uploadError) {
      const message = getErrorMessage(uploadError, "Could not upload Schedule 1.");
      setError(message);
      toast.error(message);
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
      | "mark-paid"
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
      setError(null);
      const base =
        props.mode === "staff" &&
        endpoint !== "submit" &&
        endpoint !== "mark-paid"
          ? "/api/v1/admin/2290"
          : (props.apiBasePath ?? "/api/v1/features/2290");
      const response = await fetch(`${base}/${props.filingId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string[];
      };
      if (!response.ok) {
        throw new Error(
          [data.error, ...(Array.isArray(data.details) ? data.details : [])]
            .filter(Boolean)
            .join(" ") || "The action failed.",
        );
      }

      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The action failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function sendNote() {
    const message = correctionMessage.trim();
    if (!message) {
      const validationMessage = "Write a note before sending.";
      setError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    try {
      setBusyAction("request-correction");
      setError(null);
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
      const message = getErrorMessage(noteError, "Could not send the note.");
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

    return filing.activityLogs.map((entry) => ({
      id: entry.id,
      event: entry.action.replaceAll("_", " "),
      detail:
        entry.metaJson && typeof entry.metaJson === "object"
          ? JSON.stringify(entry.metaJson)
          : "Form 2290 filing activity",
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
    { label: "Amount due", value: formatCurrency(filing.amountDue) },
    { label: "Service fee", value: formatCurrency(filing.serviceFeeAmount) },
    { label: "Payment status", value: paymentStatusLabel(filing.paymentStatus) },
    { label: "Payment handling", value: filing.paymentHandling.replaceAll("_", " ") },
    { label: "Default payment method", value: filing.defaultPaymentMethodId ? "Selected" : "Not selected" },
    { label: "Paid at", value: formatDateOnly(filing.paidAt) },
    { label: "Payment reference", value: filing.paymentReference || "-" },
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
              {props.mode === "driver" && permissions.canMarkPaid ? (
                <button
                  type="button"
                  onClick={() => void runAction("mark-paid", { amountDue: amountDue || undefined })}
                  disabled={busyAction === "mark-paid"}
                  className={styles.primaryButton}
                >
                  {busyAction === "mark-paid" ? "Working..." : "Pay filing"}
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
                    onClick={() => schedule1InputRef.current?.click()}
                    disabled={busyAction === "schedule1" || filing.status !== "IN_PROCESS"}
                    className={styles.primaryButton}
                  >
                    {busyAction === "schedule1" ? "Finalizing..." : "Finalize filing"}
                  </button>
                  <input
                    ref={schedule1InputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => void uploadSchedule1(event.target.files?.[0])}
                  />
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

        {error ? <div className={styles.alertError}>{error}</div> : null}

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
          <SectionTitle eyebrow="Activity" title="Activity timeline" />
          <TimelineTable rows={timelineRows} />
        </div> : null}
      </section>

      {editModalOpen && permissions.canEdit ? (
        <div className={styles.modalOverlay} onClick={() => setEditModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Edit</p>
                <h2 className={styles.sectionTitle}>Update Form 2290 filing</h2>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={() => setEditModalOpen(false)}>
                Close
              </button>
            </div>

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
                paymentHandling: filing.paymentHandling,
                taxableGrossWeight: filing.taxableGrossWeightSnapshot,
                loggingVehicle: filing.loggingVehicle,
                suspendedVehicle: filing.suspendedVehicle,
                confirmationAccepted: Boolean(filing.confirmationAcceptedAt),
                irsTaxEstimate: filing.irsTaxEstimate,
              }}
              onSaved={() => {
                setEditModalOpen(false);
                void load();
              }}
            />
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
    </div>
  );
}
