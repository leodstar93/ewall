"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import tableStyles from "../../../../dashboard/components/ui/DataTable.module.css";
import styles from "./ucr-detail.module.css";
import UcrFilingForm from "@/features/ucr/filing-form";
import {
  type UcrDocument,
  type UcrFiling,
  type UcrTimelineItem,
  customerPaymentStatusClasses,
  customerPaymentStatusLabel,
  documentTypeLabel,
  filingStatusClasses,
  filingStatusLabel,
  formatCurrency,
  formatDate,
  officialPaymentStatusClasses,
  officialPaymentStatusLabel,
} from "@/features/ucr/shared";

type DetailPayload = {
  filing: UcrFiling;
  timeline: UcrTimelineItem[];
  conversation: ConversationMessage[];
  permissions: {
    isOwner: boolean;
    canManageAll: boolean;
    canEdit: boolean;
    canSubmit: boolean;
    canCheckout: boolean;
    canViewReceipt: boolean;
  };
};

type Props = {
  filingId: string;
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
  href: string;
};

type TimelineRow = {
  id: string;
  event: string;
  detail: string;
  date: string;
};

type ConversationMessage = {
  id: string;
  authorRole: "CLIENT" | "STAFF";
  authorName: string;
  body: string;
  createdAt: string;
  legacy?: boolean;
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
                No documents available.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className={tableStyles.nameCell}>{row.name}</td>
                <td className={tableStyles.muteCell}>{row.type}</td>
                <td className={tableStyles.muteCell}>{row.date}</td>
                <td>
                  <a href={row.href} className={styles.tableLink}>
                    Download
                  </a>
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
    <div className={tableStyles.tableWrap}>
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
                No audit events yet.
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

export default function UcrAdminDetailClient({ filingId }: Props) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [needsAttentionModalOpen, setNeedsAttentionModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [staffReason, setStaffReason] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/admin/ucr/${filingId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as DetailPayload & {
        error?: string;
      };

      if (!response.ok || !data.filing) {
        throw new Error(data.error || "Could not load the UCR filing.");
      }

      setPayload(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Could not load the UCR filing.",
      );
    } finally {
      setLoading(false);
    }
  }, [filingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestAdminAction(path: string, body?: unknown, isMultipart = false) {
    const response = await fetch(`/api/v1/admin/ucr/${filingId}/${path}`, {
      method: "POST",
      headers: body && !isMultipart ? { "Content-Type": "application/json" } : undefined,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string[];
    };

    if (!response.ok) {
      throw new Error(
        [data.error, ...(Array.isArray(data.details) ? data.details : [])]
          .filter(Boolean)
          .join(" ") || "The UCR action failed.",
      );
    }
  }

  async function postAdminAction(path: string, body?: unknown, isMultipart = false) {
    try {
      setBusy(true);
      setError(null);
      await requestAdminAction(path, body, isMultipart);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The UCR action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function completeByStaff() {
    try {
      setBusy(true);
      setError(null);

      if (receiptFile) {
        const formData = new FormData();
        formData.append("file", receiptFile);
        await requestAdminAction("receipt", formData, true);
      }

      await requestAdminAction("complete");

      setReceiptFile(null);
      setCompleteModalOpen(false);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The UCR action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function markNeedsAttention() {
    try {
      setBusy(true);
      setError(null);
      await requestAdminAction("needs-attention", { reason: staffReason });
      setNeedsAttentionModalOpen(false);
      setStaffReason("");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The UCR action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendChatMessage() {
    try {
      setChatBusy(true);
      setError(null);

      const response = await fetch(`/api/v1/admin/ucr/${filingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatMessage: chatDraft,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not send the message.");
      }

      setChatDraft("");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not send the message.");
    } finally {
      setChatBusy(false);
    }
  }

  const filing = payload?.filing ?? null;
  const permissions = payload?.permissions ?? null;
  const timeline = payload?.timeline ?? [];
  const conversation = payload?.conversation ?? [];

  const companyProfile = filing?.user?.companyProfile;
  const companyLegalName =
    companyProfile?.legalName || companyProfile?.companyName || filing?.legalName || "UCR filing";
  const companyDba = companyProfile?.dbaName || filing?.dbaName || "-";
  const companyDot = companyProfile?.dotNumber || filing?.dotNumber || filing?.usdotNumber || "-";
  const companyMc = companyProfile?.mcNumber || filing?.mcNumber || "-";
  const companyEin = companyProfile?.ein || filing?.fein || "-";
  const companyState = companyProfile?.state || filing?.baseState || "-";
  const assignedStaffLabel =
    filing?.assignedStaff?.name?.trim() || filing?.assignedStaff?.email || "Unassigned";

  const detailRows = useMemo<KeyValueRow[]>(() => {
    if (!filing) return [];

    return [
      { label: "Filing year", value: String(filing.year) },
      { label: "Legal name", value: companyLegalName },
      { label: "DBA", value: companyDba },
      { label: "DOT", value: companyDot },
      { label: "MC", value: companyMc },
      { label: "EIN / FEIN", value: companyEin },
      { label: "Base state", value: companyState },
      { label: "Vehicle count", value: String(filing.vehicleCount ?? filing.fleetSize ?? "-") },
      { label: "Interstate", value: filing.interstateOperation ? "Yes" : "No" },
      { label: "Assigned staff", value: assignedStaffLabel },
      { label: "Updated", value: formatDate(filing.updatedAt) },
    ];
  }, [
    assignedStaffLabel,
    companyDba,
    companyDot,
    companyEin,
    companyLegalName,
    companyMc,
    companyState,
    filing,
  ]);

  const amountRows = useMemo<KeyValueRow[]>(() => {
    if (!filing) return [];

    return [
      { label: "UCR amount", value: formatCurrency(filing.ucrAmount) },
      { label: "Service fee", value: formatCurrency(filing.serviceFee) },
      { label: "Processing fee", value: formatCurrency(filing.processingFee) },
      { label: "Total charged", value: formatCurrency(filing.totalCharged) },
    ];
  }, [filing]);

  const documentRows = useMemo<DocumentRow[]>(() => {
    if (!filing) return [];

    return (filing.documents || []).map((document: UcrDocument) => ({
      id: document.id,
      name: document.name,
      type: documentTypeLabel(document.type),
      date: formatDate(document.createdAt),
      href: `/api/v1/features/ucr/documents/${document.id}/download`,
    }));
  }, [filing]);

  const timelineRows = useMemo<TimelineRow[]>(() => {
    return timeline.map((item) => ({
      id: item.id,
      event:
        item.kind === "transition"
          ? item.toStatus?.replace(/_/g, " ") || "Transition"
          : item.eventType || "Event",
      detail: item.message || item.reason || item.fromStatus || "Status updated",
      date: formatDate(item.createdAt),
    }));
  }, [timeline]);

  if (loading) {
    return <div className={styles.loadingCard}>Loading UCR filing...</div>;
  }

  if (error && !payload) {
    return <div className={styles.alertError}>{error}</div>;
  }

  if (!filing || !permissions) {
    return null;
  }

  return (
    <div className={styles.page}>
      <section className={styles.container}>
        <div className={styles.headerBlock}>
          <div className={styles.headerTop}>
            <div>
              <p className={styles.eyebrow}>UCR Filing</p>
              <h1 className={styles.title}>{companyLegalName}</h1>
              <p className={styles.subtitle}>
                Filing year {filing.year} | Updated {formatDate(filing.updatedAt)}
              </p>
            </div>
            <div className={styles.headerActions}>
              <Link href="/v2/admin/features/ucr" className={styles.secondaryButton}>
                Back
              </Link>
              {permissions.canEdit ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setEditing((current) => !current)}
                >
                  {editing ? "Hide edit" : "Edit filing"}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void postAdminAction("claim")}
                disabled={busy}
              >
                Assign to me
              </button>
              <button
                type="button"
                className={styles.warningButton}
                onClick={() => setNeedsAttentionModalOpen(true)}
                disabled={busy}
              >
                Need attention
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setCompleteModalOpen(true)}
                disabled={busy}
              >
                Complete by staff
              </button>
              {permissions.canViewReceipt ? (
                <a href={`/api/v1/admin/ucr/${filing.id}/receipt`} className={styles.secondaryButton}>
                  Download receipt
                </a>
              ) : null}
            </div>
          </div>

          <div className={styles.statusRow}>
            <StatusChip
              label={filingStatusLabel(filing.status)}
              className={filingStatusClasses(filing.status)}
            />
            <StatusChip
              label={`Customer: ${customerPaymentStatusLabel(filing.customerPaymentStatus)}`}
              className={customerPaymentStatusClasses(filing.customerPaymentStatus)}
            />
            <StatusChip
              label={`Official: ${officialPaymentStatusLabel(filing.officialPaymentStatus)}`}
              className={officialPaymentStatusClasses(filing.officialPaymentStatus)}
            />
          </div>
        </div>

        {error ? <div className={styles.alertError}>{error}</div> : null}

        {permissions.canEdit && editing ? (
          <div className={styles.section}>
            <SectionTitle eyebrow="Edit" title="Update filing" />
            <UcrFilingForm
              mode="edit"
              filingId={filing.id}
              apiBasePath="/api/v1/admin/ucr"
              currentStatus={filing.status}
              detailHrefBase="/v2/admin/features/ucr"
              initialValues={{
                year: filing.year,
                legalName: filing.legalName,
                dbaName: filing.dbaName,
                dotNumber: filing.dotNumber,
                mcNumber: filing.mcNumber,
                fein: filing.fein,
                baseState: filing.baseState,
                interstateOperation: filing.interstateOperation,
                vehicleCount: filing.vehicleCount,
                clientNotes: filing.clientNotes,
              }}
              onSaved={() => {
                setEditing(false);
                void load();
              }}
            />
          </div>
        ) : null}

        <div className={styles.section}>
          <div className={styles.twoUp}>
            <div className={styles.subsection}>
              <SectionTitle eyebrow="Company" title="Company details" />
              <KeyValueTable rows={detailRows} />
            </div>
            <div className={styles.subsection}>
              <SectionTitle eyebrow="Charges" title="Charges" />
              <KeyValueTable rows={amountRows} />
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <SectionTitle eyebrow="Files" title="Documents" />
          <DocumentsTable rows={documentRows} />
        </div>

        <div className={styles.section}>
          <SectionTitle eyebrow="Conversation" title="Client and staff chat" />
          <div className={styles.chatThread}>
            {conversation.length === 0 ? (
              <div className={styles.chatEmpty}>
                No messages yet. Use this thread to coordinate directly with the client.
              </div>
            ) : (
              conversation.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.chatMessage} ${
                    message.authorRole === "STAFF" ? styles.chatMessageStaff : styles.chatMessageClient
                  }`}
                >
                  <div className={styles.chatMeta}>
                    <strong>{message.authorName}</strong>
                    <span>{formatDate(message.createdAt)}</span>
                  </div>
                  <p className={styles.chatBody}>{message.body}</p>
                </article>
              ))
            )}
          </div>
          <div className={styles.chatComposer}>
            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Reply</span>
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                rows={5}
                className={styles.textarea}
                placeholder="Send a message that the client will see in their filing."
              />
            </label>
            <div className={styles.noteActions}>
              <button
                type="button"
                onClick={() => setChatDraft("")}
                disabled={chatBusy || !chatDraft.trim()}
                className={styles.secondaryButton}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void sendChatMessage()}
                disabled={chatBusy || !chatDraft.trim()}
                className={styles.primaryButton}
              >
                {chatBusy ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <SectionTitle eyebrow="Audit" title="Audit" />
          <TimelineTable rows={timelineRows} />
        </div>
      </section>

      {needsAttentionModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (busy) return;
            setNeedsAttentionModalOpen(false);
          }}
        >
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Staff action</p>
                <h2 className={styles.sectionTitle}>Need attention</h2>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setNeedsAttentionModalOpen(false)}
                disabled={busy}
              >
                Close
              </button>
            </div>

            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Note</span>
              <textarea
                value={staffReason}
                onChange={(event) => setStaffReason(event.target.value)}
                rows={5}
                className={styles.textarea}
                placeholder="Explain what needs attention so the filing can be followed up clearly."
              />
            </label>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setNeedsAttentionModalOpen(false)}
                disabled={busy}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void markNeedsAttention()}
                disabled={busy}
                className={styles.warningButton}
              >
                {busy ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {completeModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            if (busy) return;
            setCompleteModalOpen(false);
          }}
        >
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.eyebrow}>Staff action</p>
                <h2 className={styles.sectionTitle}>Complete by staff</h2>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setCompleteModalOpen(false)}
                disabled={busy}
              >
                Close
              </button>
            </div>

            <label className={styles.fieldBlock}>
              <span className={styles.fieldLabel}>Receipt file</span>
              <input
                type="file"
                onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                className={styles.input}
              />
            </label>

            {filing.officialReceiptUrl ? (
              <div className={styles.modalNote}>
                <strong>{filing.officialReceiptName || "Receipt on file"}</strong>
                <span>A new file uploaded here will replace the current official receipt.</span>
              </div>
            ) : (
              <p className={styles.modalHelp}>Upload the official receipt to complete the filing.</p>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setCompleteModalOpen(false)}
                disabled={busy}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void completeByStaff()}
                disabled={busy || !receiptFile}
                className={styles.primaryButton}
              >
                {busy ? "Completing..." : "Confirm completion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
