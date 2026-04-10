"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import tableStyles from "../../components/ui/DataTable.module.css";
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

function KeyValueTable({
  rows,
}: {
  rows: KeyValueRow[];
}) {
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

function DocumentsTable({
  rows,
}: {
  rows: DocumentRow[];
}) {
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

function TimelineTable({
  rows,
}: {
  rows: TimelineRow[];
}) {
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

export default function UcrDetailClient({ filingId }: Props) {
  const { data: session } = useSession();
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/features/ucr/${filingId}`, {
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

  const runCheckout = async () => {
    try {
      setBusy(true);
      setError(null);

      const response = await fetch(`/api/v1/features/ucr/${filingId}/checkout`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        checkoutUrl?: string;
        paymentStatus?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Could not start checkout.");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.paymentStatus === "SUCCEEDED") {
        await load();
        return;
      }

      throw new Error("Could not start checkout.");
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.",
      );
    } finally {
      setBusy(false);
    }
  };

  const sendChatMessage = async () => {
    try {
      setChatBusy(true);
      setError(null);

      const response = await fetch(`/api/v1/features/ucr/${filingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatMessage: chatDraft }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Could not send your message.");
      }

      setChatDraft("");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not send your message.");
    } finally {
      setChatBusy(false);
    }
  };

  const filing = payload?.filing ?? null;
  const permissions = payload?.permissions ?? null;
  const timeline = payload?.timeline ?? [];
  const conversation = payload?.conversation ?? [];
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const canViewAudit = roles.includes("ADMIN") || roles.includes("STAFF");

  const companyProfile = filing?.user?.companyProfile;
  const companyLegalName =
    companyProfile?.legalName || companyProfile?.companyName || filing?.legalName || "UCR filing";
  const companyDba = companyProfile?.dbaName || filing?.dbaName || "-";
  const companyDot = companyProfile?.dotNumber || filing?.dotNumber || filing?.usdotNumber || "-";
  const companyMc = companyProfile?.mcNumber || filing?.mcNumber || "-";
  const companyEin = companyProfile?.ein || filing?.fein || "-";
  const companyState = companyProfile?.state || filing?.baseState || "-";

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
      { label: "Updated", value: formatDate(filing.updatedAt) },
    ];
  }, [companyDba, companyDot, companyEin, companyLegalName, companyMc, companyState, filing]);

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
              <Link href="/v2/dashboard/ucr" className={styles.secondaryButton}>
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
              {permissions.canCheckout ? (
                <button
                  type="button"
                  onClick={() => void runCheckout()}
                  disabled={busy}
                  className={styles.primaryButton}
                >
                  {busy ? "Redirecting..." : "Pay now"}
                </button>
              ) : null}
              {permissions.canViewReceipt ? (
                <a href={`/api/v1/features/ucr/${filing.id}/receipt`} className={styles.secondaryButton}>
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
              apiBasePath="/api/v1/features/ucr"
              currentStatus={filing.status}
              detailHrefBase="/v2/dashboard/ucr"
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
                No messages yet. Start the conversation with your staff team here.
              </div>
            ) : (
              conversation.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.chatMessage} ${
                    message.authorRole === "CLIENT" ? styles.chatMessageClient : styles.chatMessageStaff
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
              <span className={styles.fieldLabel}>New message</span>
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                className={styles.textarea}
                placeholder="Write a message for staff about this filing."
              />
            </label>
            <div className={styles.noteActions}>
              <button
                type="button"
                onClick={() => setChatDraft("")}
                className={styles.secondaryButton}
                disabled={chatBusy || !chatDraft.trim()}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void sendChatMessage()}
                className={styles.primaryButton}
                disabled={chatBusy || !chatDraft.trim()}
              >
                {chatBusy ? "Sending..." : "Send message"}
              </button>
            </div>
          </div>
        </div>

        {canViewAudit ? (
          <div className={styles.section}>
            <SectionTitle eyebrow="Audit" title="Audit" />
            <TimelineTable rows={timelineRows} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
