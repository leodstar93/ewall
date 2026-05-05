"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StaffFilingPaymentPanel from "@/components/ach/StaffFilingPaymentPanel";
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
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] =
    useState<Form2290DocumentType>("PAYMENT_PROOF");
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [schedule1File, setSchedule1File] = useState<File | null>(null);
  const [schedule1Name, setSchedule1Name] = useState("");

  const [correctionMessage, setCorrectionMessage] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [efileConfirmationNumber, setEfileConfirmationNumber] = useState("");

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
      setSignerName(data.filing.authorization?.signerName ?? "");
      setSignerTitle(data.filing.authorization?.signerTitle ?? "");
      setSignatureText(data.filing.authorization?.signatureText ?? "");
      setPaymentReference(data.filing.paymentReference ?? "");
      setEfileConfirmationNumber(data.filing.efileConfirmationNumber ?? "");
      setCorrectionMessage(data.filing.corrections[0]?.message ?? "");
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

  async function uploadBaseDocument(file: File, name: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name.trim());
    formData.append("category", "FORM_2290");

    const response = await fetch(
      props.documentsApiBasePath ?? "/api/v1/features/documents",
      {
        method: "POST",
        body: formData,
      },
    );

    const data = (await response.json().catch(() => ({}))) as UploadResponse;
    if (!response.ok || !data.id) {
      throw new Error(data.error || "Could not upload the document.");
    }

    return data.id;
  }

  async function attachSupportingDocument() {
    if (!documentFile) {
      setError("Please choose a file to upload.");
      return;
    }
    if (!documentName.trim()) {
      setError("Document name is required.");
      return;
    }

    try {
      setBusyAction("document");
      setError(null);
      const documentId = await uploadBaseDocument(documentFile, documentName);
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            type: documentType,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not attach the document.");
      }

      setDocumentFile(null);
      setDocumentName("");
      setDocumentType("PAYMENT_PROOF");
      await load();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not attach the document.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadSchedule1() {
    if (!schedule1File) {
      setError("Please choose a Schedule 1 file to upload.");
      return;
    }
    if (!schedule1Name.trim()) {
      setError("Schedule 1 document name is required.");
      return;
    }

    try {
      setBusyAction("schedule1");
      setError(null);
      const documentId = await uploadBaseDocument(schedule1File, schedule1Name);
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}/upload-schedule1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not upload Schedule 1.");
      }

      setSchedule1File(null);
      setSchedule1Name("");
      await load();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload Schedule 1.",
      );
    } finally {
      setBusyAction(null);
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

  async function signAuthorization() {
    try {
      setBusyAction("authorization");
      setError(null);
      const response = await fetch(
        `${props.apiBasePath ?? "/api/v1/features/2290"}/${props.filingId}/authorization`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signerName, signerTitle, signatureText }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Could not sign authorization.");
      await load();
    } catch (authorizationError) {
      setError(
        authorizationError instanceof Error
          ? authorizationError.message
          : "Could not sign authorization.",
      );
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
    { label: "Paid at", value: formatDateOnly(filing.paidAt) },
    { label: "Payment reference", value: filing.paymentReference || "-" },
  ];

  const filingRows: KeyValueRow[] = [
    { label: "Status", value: statusLabel(filing.status) },
    { label: "Provider", value: filing.efileProviderName || "-" },
    { label: "Provider URL", value: filing.efileProviderUrl || "-" },
    { label: "Confirmation", value: filing.efileConfirmationNumber || "-" },
    { label: "Filed at", value: formatDateOnly(filing.filedAt) },
    { label: "Filed externally", value: formatDateOnly(filing.filedExternallyAt) },
    { label: "Ready to file", value: formatDate(filing.readyToFileAt) },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.container}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.eyebrow}>Form 2290 Filing</p>
              <h1 className={styles.title}>
                Unit {filing.unitNumberSnapshot || filing.truck.unitNumber}
              </h1>
              <p className={styles.subtitle}>
                VIN {filing.vinSnapshot} | Tax period {filing.taxPeriod.name} | Updated{" "}
                {formatDate(filing.updatedAt)}
              </p>
            </div>
            <div className={styles.headerActions}>
              <Link href={backHref} className={styles.secondaryButton}>
                Back
              </Link>
              {permissions.canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className={styles.secondaryButton}
                >
                  Edit filing
                </button>
              ) : null}
              {permissions.canSubmit ? (
                <button
                  type="button"
                  onClick={() => void runAction("submit")}
                  disabled={busyAction === "submit"}
                  className={styles.primaryButton}
                >
                  {busyAction === "submit" ? "Working..." : "Submit for review"}
                </button>
              ) : null}
              {permissions.canMarkSubmitted ? (
                <button
                  type="button"
                  onClick={() => void runAction("submit", { markSubmitted: true })}
                  disabled={busyAction === "submit"}
                  className={styles.secondaryButton}
                >
                  Mark submitted
                </button>
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

        {filing.status === "NEEDS_CORRECTION" && filing.corrections[0] ? (
          <div className={styles.alertInfo}>{filing.corrections[0].message}</div>
        ) : null}

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
          <div className={styles.twoUp}>
            <div className={styles.subsection}>
              <SectionTitle eyebrow="Filing" title="Provider filing details" />
              <KeyValueTable rows={filingRows} />
            </div>
            <div className={styles.subsection}>
              <SectionTitle eyebrow="Authorization" title="Client authorization" />
              <KeyValueTable
                rows={[
                  { label: "Status", value: filing.authorization?.status ?? "UNSIGNED" },
                  { label: "Signer", value: filing.authorization?.signerName ?? "-" },
                  { label: "Title", value: filing.authorization?.signerTitle ?? "-" },
                  { label: "Signed at", value: formatDate(filing.authorization?.signedAt) },
                ]}
              />
            </div>
          </div>
        </div>

        {permissions.canAuthorize ? (
          <div className={styles.section}>
            <SectionTitle eyebrow="Authorization" title="Sign authorization" />
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Signer name</span>
                <input value={signerName} onChange={(event) => setSignerName(event.target.value)} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400" />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Title</span>
                <input value={signerTitle} onChange={(event) => setSignerTitle(event.target.value)} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400" />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Signature</span>
                <input value={signatureText} onChange={(event) => setSignatureText(event.target.value)} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400" />
              </label>
            </div>
            <div className={styles.noteActions}>
              <button type="button" onClick={() => void signAuthorization()} disabled={busyAction === "authorization"} className={styles.primaryButton}>
                {busyAction === "authorization" ? "Signing..." : "Sign authorization"}
              </button>
            </div>
          </div>
        ) : null}

        {props.mode === "staff" ? (
          <div className={styles.section}>
            <SectionTitle eyebrow="ACH" title="Staff payment custody" />
            <StaffFilingPaymentPanel filingType="form2290" filingId={props.filingId} />
          </div>
        ) : null}

        {permissions.canStaffWorkflow ? (
          <div className={styles.section}>
            <SectionTitle eyebrow="Workflow" title="Staff actions" />
            <div className={styles.noteActions}>
              <button type="button" onClick={() => void runAction("claim")} disabled={busyAction === "claim"} className={styles.secondaryButton}>Claim</button>
              <button type="button" onClick={() => void runAction("start-review")} disabled={busyAction === "start-review"} className={styles.secondaryButton}>Start review</button>
              <button type="button" onClick={() => void runAction("mark-ready-to-file")} disabled={busyAction === "mark-ready-to-file"} className={styles.secondaryButton}>Ready to file</button>
              <button type="button" onClick={() => void runAction("mark-payment-received", { amountDue: amountDue || undefined, paymentReference: paymentReference || undefined })} disabled={busyAction === "mark-payment-received"} className={styles.secondaryButton}>Payment received</button>
              <button type="button" onClick={() => void runAction("mark-filed", { efileConfirmationNumber: efileConfirmationNumber || undefined, providerName: filing.efileProviderName || undefined, providerUrl: filing.efileProviderUrl || undefined })} disabled={busyAction === "mark-filed"} className={styles.primaryButton}>Mark filed</button>
              <button type="button" onClick={() => void runAction("mark-compliant")} disabled={busyAction === "mark-compliant"} className={styles.primaryButton}>Compliant</button>
            </div>
          </div>
        ) : null}

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
          <SectionTitle eyebrow="Schedule 1" title="Final Schedule 1" />
          {filing.schedule1Document ? (
            <DocumentsTable
              rows={[
                {
                  id: filing.schedule1Document.id,
                  name: filing.schedule1Document.name,
                  type: "Schedule 1",
                  date: formatDate(filing.schedule1Document.createdAt),
                  viewHref: `${props.documentsApiBasePath ?? "/api/v1/features/documents"}/${filing.schedule1Document.id}/view`,
                  downloadHref: `${props.documentsApiBasePath ?? "/api/v1/features/documents"}/${filing.schedule1Document.id}/download`,
                },
              ]}
            />
          ) : (
            <div className={styles.chatEmpty}>No Schedule 1 attached yet.</div>
          )}

          {permissions.canUploadSchedule1 ? (
            <div className={styles.chatComposer}>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Schedule 1 file</span>
                  <input type="file" onChange={(event) => setSchedule1File(event.target.files?.[0] ?? null)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3" />
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Schedule 1 name</span>
                  <input value={schedule1Name} onChange={(event) => setSchedule1Name(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400" />
                </label>
              </div>
              <div className={styles.noteActions}>
                <button type="button" onClick={() => void uploadSchedule1()} disabled={busyAction === "schedule1"} className={styles.primaryButton}>
                  {busyAction === "schedule1" ? "Uploading..." : "Upload Schedule 1"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.section}>
          <SectionTitle eyebrow="Corrections" title="Correction requests" />
          <div className={styles.chatThread}>
            {filing.corrections.length === 0 ? (
              <div className={styles.chatEmpty}>No corrections requested.</div>
            ) : (
              filing.corrections.map((correction) => (
                <article key={correction.id} className={styles.chatMessage}>
                  <div className={styles.chatMeta}>
                    <strong>{correction.resolved ? "Resolved" : "Open"}</strong>
                    <span>{formatDate(correction.createdAt)}</span>
                  </div>
                  <p className={styles.chatBody}>{correction.message}</p>
                </article>
              ))
            )}
          </div>

          {permissions.canRequestCorrection ? (
            <div className={styles.chatComposer}>
              <label className={styles.fieldBlock}>
                <span className={styles.fieldLabel}>Correction message</span>
                <textarea value={correctionMessage} onChange={(event) => setCorrectionMessage(event.target.value)} className={styles.textarea} />
              </label>
              <div className={styles.noteActions}>
                <button type="button" onClick={() => void runAction("request-correction", { message: correctionMessage })} disabled={busyAction === "request-correction"} className={styles.secondaryButton}>
                  {busyAction === "request-correction" ? "Working..." : "Request correction"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.section}>
          <SectionTitle eyebrow="Activity" title="Activity timeline" />
          <TimelineTable rows={timelineRows} />
        </div>
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
            </label>
            <label className={styles.uploadField}>
              <span className={styles.uploadFieldLabel}>Document name</span>
              <input value={documentName} onChange={(event) => setDocumentName(event.target.value)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400" />
            </label>
            <label className={styles.uploadField}>
              <span className={styles.uploadFieldLabel}>Document type</span>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value as Form2290DocumentType)} className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400">
                <option value="PAYMENT_PROOF">Payment proof</option>
                <option value="SUPPORTING_DOC">Supporting doc</option>
                <option value="AUTHORIZATION">Authorization</option>
                <option value="PROVIDER_CONFIRMATION">Provider confirmation</option>
              </select>
            </label>

            <div className={styles.noteActions}>
              <button type="button" onClick={() => setDocumentModalOpen(false)} className={styles.secondaryButton} disabled={busyAction === "document"}>
                Cancel
              </button>
              <button type="button" onClick={() => void attachSupportingDocument()} className={styles.primaryButton} disabled={busyAction === "document" || !documentFile || !documentName.trim()}>
                {busyAction === "document" ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
