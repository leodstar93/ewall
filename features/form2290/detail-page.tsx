"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  };
};

type UploadResponse = {
  id?: string;
  error?: string;
};

type DetailPageProps = {
  filingId: string;
  mode: "driver" | "staff";
};

export default function Form2290DetailPage(props: DetailPageProps) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState<Form2290DocumentType>("PAYMENT_PROOF");

  const [schedule1File, setSchedule1File] = useState<File | null>(null);
  const [schedule1Name, setSchedule1Name] = useState("");

  const [correctionMessage, setCorrectionMessage] = useState("");
  const [amountDue, setAmountDue] = useState("");
  const [paidAt, setPaidAt] = useState("");

  const detailHrefBase =
    props.mode === "staff" ? "/admin/features/2290" : "/2290";
  const backHref =
    props.mode === "staff" ? "/admin/features/2290" : "/2290";

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/features/2290/${props.filingId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as DetailPayload & { error?: string };
      if (!response.ok || !data.filing) {
        throw new Error(data.error || "Could not load the Form 2290 filing.");
      }

      setPayload(data);
      setAmountDue(data.filing.amountDue ?? "");
      setPaidAt(data.filing.paidAt ? new Date(data.filing.paidAt).toISOString().slice(0, 10) : "");
      setCorrectionMessage(data.filing.corrections[0]?.message ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the filing.");
    } finally {
      setLoading(false);
    }
  }, [props.filingId]);

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

    const response = await fetch("/api/v1/features/documents", {
      method: "POST",
      body: formData,
    });

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
      const response = await fetch(`/api/v1/features/2290/${props.filingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          type: documentType,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not attach the document.");
      }

      setDocumentFile(null);
      setDocumentName("");
      setDocumentType("PAYMENT_PROOF");
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not attach the document.");
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
      const response = await fetch(`/api/v1/features/2290/${props.filingId}/upload-schedule1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not upload Schedule 1.");
      }

      setSchedule1File(null);
      setSchedule1Name("");
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload Schedule 1.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(
    endpoint: "submit" | "request-correction" | "mark-paid",
    body?: Record<string, unknown>,
  ) {
    try {
      setBusyAction(endpoint);
      setError(null);
      const response = await fetch(`/api/v1/features/2290/${props.filingId}/${endpoint}`, {
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
      setError(actionError instanceof Error ? actionError.message : "The action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading Form 2290 filing...</div>;
  }

  if (error && !payload) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!payload || !complianceState) return null;

  const { filing, permissions } = payload;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_45%,_#fef3c7)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Form 2290 Filing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Unit {filing.unitNumberSnapshot || filing.truck.unitNumber}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {filing.vinSnapshot} · Tax period {filing.taxPeriod.name} · Updated {formatDate(filing.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(filing.status)}`}>
              {statusLabel(filing.status)}
            </span>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${paymentStatusClasses(filing.paymentStatus)}`}>
              {paymentStatusLabel(filing.paymentStatus)}
            </span>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${complianceClasses(complianceState)}`}>
              {complianceLabel(complianceState)}
            </span>
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Back to queue
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Vehicle</p>
            <p className="mt-3 text-sm font-semibold text-zinc-950">{filing.truck.make || "-"} {filing.truck.model || ""}</p>
            <p className="mt-1 text-sm text-zinc-600">Weight {filing.grossWeightSnapshot?.toLocaleString("en-US") || "Not set"}</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">First used</p>
            <p className="mt-3 text-sm font-semibold text-zinc-950">
              {filing.firstUsedMonth && filing.firstUsedYear
                ? `${filing.firstUsedMonth}/${filing.firstUsedYear}`
                : "Not set"}
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Amount due</p>
            <p className="mt-3 text-sm font-semibold text-zinc-950">{formatCurrency(filing.amountDue)}</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Filed at</p>
            <p className="mt-3 text-sm font-semibold text-zinc-950">{formatDateOnly(filing.filedAt)}</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Expires</p>
            <p className="mt-3 text-sm font-semibold text-zinc-950">{formatDateOnly(filing.expiresAt)}</p>
          </div>
        </div>

        {filing.notes && (
          <div className="mt-6 rounded-[24px] border border-zinc-200 bg-white/80 p-5 text-sm text-zinc-700">
            {filing.notes}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {permissions.canEdit && (
        <Form2290FilingForm
          mode="edit"
          filingId={filing.id}
          detailHrefBase={detailHrefBase}
          initialValues={{
            truckId: filing.truckId,
            taxPeriodId: filing.taxPeriodId,
            firstUsedMonth: filing.firstUsedMonth,
            firstUsedYear: filing.firstUsedYear,
            notes: filing.notes,
          }}
          onSaved={() => {
            void load();
          }}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950">Workflow actions</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Submit the draft, review corrections, and complete payment plus Schedule 1 to reach compliance.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {permissions.canSubmit && (
                  <button
                    type="button"
                    onClick={() => void runAction("submit")}
                    disabled={busyAction === "submit"}
                    className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {busyAction === "submit" ? "Working..." : filing.status === "NEEDS_CORRECTION" ? "Resubmit for review" : "Submit for review"}
                  </button>
                )}
                {permissions.canMarkSubmitted && (
                  <button
                    type="button"
                    onClick={() => void runAction("submit", { markSubmitted: true })}
                    disabled={busyAction === "submit"}
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                  >
                    Mark submitted
                  </button>
                )}
              </div>
            </div>

            {permissions.canRequestCorrection && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Correction request</span>
                  <textarea
                    value={correctionMessage}
                    onChange={(event) => setCorrectionMessage(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void runAction("request-correction", { message: correctionMessage })}
                    disabled={busyAction === "request-correction"}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-amber-200 px-4 py-3 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-60"
                  >
                    {busyAction === "request-correction" ? "Working..." : "Request correction"}
                  </button>
                </div>
              </div>
            )}

            {permissions.canMarkPaid && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Amount due</span>
                  <input
                    value={amountDue}
                    onChange={(event) => setAmountDue(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Paid at</span>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(event) => setPaidAt(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      void runAction("mark-paid", {
                        amountDue: amountDue || undefined,
                        paidAt: paidAt || undefined,
                      })
                    }
                    disabled={busyAction === "mark-paid"}
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busyAction === "mark-paid" ? "Working..." : "Mark paid"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Documents</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Attach proof documents and the final Schedule 1 using the shared document storage.
            </p>

            {permissions.canUploadDocuments && (
              <div className="mt-5 grid gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Supporting file</span>
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
                  <span className="font-medium text-zinc-900">Document type</span>
                  <select
                    value={documentType}
                    onChange={(event) => setDocumentType(event.target.value as Form2290DocumentType)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                  >
                    <option value="PAYMENT_PROOF">Payment proof</option>
                    <option value="SUPPORTING_DOC">Supporting doc</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void attachSupportingDocument()}
                    disabled={busyAction === "document"}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-white disabled:opacity-60"
                  >
                    {busyAction === "document" ? "Uploading..." : "Upload supporting doc"}
                  </button>
                </div>
              </div>
            )}

            {permissions.canUploadSchedule1 && (
              <div className="mt-4 grid gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Schedule 1 file</span>
                  <input
                    type="file"
                    onChange={(event) => setSchedule1File(event.target.files?.[0] ?? null)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                  />
                </label>
                <label className="space-y-2 text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">Schedule 1 name</span>
                  <input
                    value={schedule1Name}
                    onChange={(event) => setSchedule1Name(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                  />
                </label>
                <div className="lg:col-span-2">
                  <button
                    type="button"
                    onClick={() => void uploadSchedule1()}
                    disabled={busyAction === "schedule1"}
                    className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {busyAction === "schedule1" ? "Uploading..." : "Upload Schedule 1"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {filing.documents.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-600">
                  No Form 2290 documents attached yet.
                </div>
              ) : (
                filing.documents.map((document) => (
                  <article
                    key={document.id}
                    className="flex flex-col gap-4 rounded-[24px] border border-zinc-200 bg-zinc-50/70 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{document.document.name}</p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {documentTypeLabel(document.type)} · {formatDate(document.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/v1/features/documents/${document.document.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-white"
                      >
                        View
                      </a>
                      <a
                        href={`/api/v1/features/documents/${document.document.id}/download`}
                        className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-white"
                      >
                        Download
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Corrections</h3>
            <div className="mt-4 space-y-3">
              {filing.corrections.length === 0 ? (
                <p className="text-sm text-zinc-600">No corrections requested.</p>
              ) : (
                filing.corrections.map((correction) => (
                  <div key={correction.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-medium text-zinc-900">{correction.message}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {correction.resolved ? "Resolved" : "Open"} · {formatDate(correction.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Activity timeline</h3>
            <div className="mt-4 space-y-3">
              {filing.activityLogs.length === 0 ? (
                <p className="text-sm text-zinc-600">No activity recorded yet.</p>
              ) : (
                filing.activityLogs.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-sm font-semibold text-zinc-900">{entry.action.replaceAll("_", " ")}</p>
                    <p className="mt-2 text-xs text-zinc-500">{formatDate(entry.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Schedule 1</h3>
            {filing.schedule1Document ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">{filing.schedule1Document.name}</p>
                <p className="mt-2 text-xs text-zinc-500">{formatDate(filing.schedule1Document.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`/api/v1/features/documents/${filing.schedule1Document.id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-white"
                  >
                    View
                  </a>
                  <a
                    href={`/api/v1/features/documents/${filing.schedule1Document.id}/download`}
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-white"
                  >
                    Download
                  </a>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-600">No Schedule 1 attached yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
