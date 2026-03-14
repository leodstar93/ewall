"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import UcrFilingForm from "@/features/ucr/filing-form";
import {
  UcrDocument,
  UcrFiling,
  documentTypeLabel,
  entityTypeLabel,
  filingTimeline,
  formatCurrency,
  formatDate,
  statusClasses,
  statusLabel,
  ucrDocumentTypeOptions,
} from "@/features/ucr/shared";

type DetailPayload = {
  filing: UcrFiling;
  permissions: {
    isOwner: boolean;
    canManageAll: boolean;
    canEdit: boolean;
    canSubmit: boolean;
    canResubmit: boolean;
    canUploadDocuments: boolean;
    canReview: boolean;
    canRequestCorrection: boolean;
    canApprove: boolean;
  };
};

type UcrDetailPageProps = {
  filingId: string;
  mode: "driver" | "staff";
};

export default function UcrDetailPage(props: UcrDetailPageProps) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentType, setDocumentType] = useState<UcrDocument["type"]>("PAYMENT_RECEIPT");
  const [staffNotes, setStaffNotes] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/features/ucr/${props.filingId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as DetailPayload & {
        error?: string;
      };
      if (!response.ok || !data.filing) {
        throw new Error(data.error || "Could not load the UCR filing.");
      }

      setPayload(data);
      setStaffNotes(data.filing.staffNotes ?? "");
      setCorrectionNote(data.filing.correctionNote ?? "");
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load the UCR filing.",
      );
    } finally {
      setLoading(false);
    }
  }, [props.filingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadDocument() {
    if (!documentFile) {
      setError("Please choose a document to upload.");
      return;
    }
    if (!documentName.trim()) {
      setError("Document name is required.");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", documentFile);
      formData.append("name", documentName.trim());
      formData.append("description", documentDescription);
      formData.append("type", documentType);

      const response = await fetch(`/api/v1/features/ucr/${props.filingId}/documents`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not upload the document.");
      }

      setDocumentFile(null);
      setDocumentName("");
      setDocumentDescription("");
      setDocumentType("PAYMENT_RECEIPT");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not upload the document.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function runStaffAction(action: "review" | "request-correction" | "approve") {
    try {
      setStaffBusy(true);
      setError(null);

      const body =
        action === "request-correction"
          ? { correctionNote, staffNotes }
          : { staffNotes };

      const response = await fetch(`/api/v1/features/ucr/${props.filingId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string[];
      };
      if (!response.ok) {
        throw new Error(
          [data.error, ...(Array.isArray(data.details) ? data.details : [])]
            .filter(Boolean)
            .join(" ") || "The staff action failed.",
        );
      }

      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The staff action failed.",
      );
    } finally {
      setStaffBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading UCR filing...</div>;
  }

  if (error && !payload) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!payload) return null;

  const { filing, permissions } = payload;
  const backHref = props.mode === "staff" ? "/admin/features/ucr" : "/ucr";

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#fef9c3)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              UCR Filing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {filing.legalName}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Filing year {filing.filingYear} · Updated {formatDate(filing.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(
                filing.status,
              )}`}
            >
              {statusLabel(filing.status)}
            </span>
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Back to queue
            </Link>
          </div>
        </div>

        {filing.status === "CORRECTION_REQUESTED" && filing.correctionNote && (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <span className="font-semibold">Correction requested:</span> {filing.correctionNote}
          </div>
        )}

        {filing.status === "PENDING_PROOF" && (
          <div className="mt-6 rounded-[24px] border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900">
            Payment proof is still required before the filing can be marked compliant.
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {props.mode === "driver" && permissions.canEdit && (
        <UcrFilingForm
          mode="edit"
          filingId={filing.id}
          currentStatus={filing.status}
          initialValues={filing}
          onSaved={() => {
            void load();
          }}
        />
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-zinc-950">Company snapshot</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Entity type
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {entityTypeLabel(filing.entityType)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Base state
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{filing.baseState || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                USDOT
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{filing.usdotNumber || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                MC
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{filing.mcNumber || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                FEIN
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{filing.fein || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Interstate
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {filing.interstateOperation ? "Yes" : "No"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Fleet size
              </p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{filing.fleetSize}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Bracket
              </p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">
                {filing.bracketLabel || "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Fee
              </p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">
                {formatCurrency(filing.feeAmount)}
              </p>
            </div>
          </div>

          {(filing.clientNotes || filing.staffNotes) && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Client notes
                </p>
                <p className="mt-2 text-sm text-zinc-700">{filing.clientNotes || "-"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Staff notes
                </p>
                <p className="mt-2 text-sm text-zinc-700">{filing.staffNotes || "-"}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Timeline</h3>
          <div className="mt-5 space-y-3">
            {filingTimeline(filing).length === 0 ? (
              <p className="text-sm text-zinc-600">No workflow events yet.</p>
            ) : (
              filingTimeline(filing).map((item) => (
                <div key={item.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {formatDate(item.value)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {props.mode === "staff" && (
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Review controls</h3>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Staff notes</span>
              <textarea
                value={staffNotes}
                onChange={(event) => setStaffNotes(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Correction note</span>
              <textarea
                value={correctionNote}
                onChange={(event) => setCorrectionNote(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {(filing.status === "SUBMITTED" || filing.status === "RESUBMITTED") && (
              <button
                type="button"
                onClick={() => void runStaffAction("review")}
                disabled={staffBusy}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              >
                {staffBusy ? "Working..." : "Start review"}
              </button>
            )}
            {filing.status === "UNDER_REVIEW" && (
              <button
                type="button"
                onClick={() => void runStaffAction("request-correction")}
                disabled={staffBusy}
                className="inline-flex items-center justify-center rounded-2xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
              >
                {staffBusy ? "Working..." : "Request correction"}
              </button>
            )}
            {(filing.status === "UNDER_REVIEW" ||
              filing.status === "PENDING_PROOF") && (
              <button
                type="button"
                onClick={() => void runStaffAction("approve")}
                disabled={staffBusy}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {staffBusy ? "Working..." : "Approve / mark compliant"}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Documents</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Payment receipts and registration proof are used to complete the approval step.
            </p>
          </div>
        </div>

        {permissions.canUploadDocuments && (
          <div className="mt-5 grid gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Document file</span>
              <input
                type="file"
                onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Document name</span>
              <input
                value={documentName}
                onChange={(event) => setDocumentName(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Type</span>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as UcrDocument["type"])}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              >
                {ucrDocumentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Description</span>
              <input
                value={documentDescription}
                onChange={(event) => setDocumentDescription(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => void uploadDocument()}
                disabled={uploading}
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload document"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {filing.documents.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-600">
              No UCR documents uploaded yet.
            </div>
          ) : (
            filing.documents.map((document) => (
              <article
                key={document.id}
                className="flex flex-col gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{document.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {documentTypeLabel(document.type)} · {formatDate(document.createdAt)}
                  </p>
                  {document.description && (
                    <p className="mt-2 text-sm text-zinc-600">{document.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/v1/features/ucr/documents/${document.id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    View
                  </a>
                  <a
                    href={`/api/v1/features/ucr/documents/${document.id}/download`}
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    Download
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
