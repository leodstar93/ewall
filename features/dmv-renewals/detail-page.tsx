"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import StaffFilingPaymentPanel from "@/components/ach/StaffFilingPaymentPanel";
import {
  dmvRenewalStatusClasses,
  dmvRenewalStatusLabel,
  DmvRenewalCaseStatus,
  formatDateTime,
  uploadDmvRenewalFile,
} from "@/features/dmv-renewals/shared";

type RenewalDetail = {
  id: string;
  caseNumber: string;
  status: DmvRenewalCaseStatus;
  state: string | null;
  note: string | null;
  clientApprovalNote: string | null;
  internalNote: string | null;
  submittedAt: string | null;
  inReviewAt: string | null;
  sentToClientAt: string | null;
  clientApprovedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    companyProfile: {
      legalName: string | null;
      dbaName: string | null;
      dotNumber: string | null;
      mcNumber: string | null;
      ein: string | null;
      businessPhone: string | null;
      address: string | null;
      state: string | null;
      trucksCount: number | null;
      driversCount: number | null;
    } | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  truck: {
    id: string;
    unitNumber: string;
    vin: string | null;
    plateNumber: string | null;
    nickname: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
  };
  documents: Array<{
    id: string;
    kind: string;
    fileName: string;
    fileUrl: string;
    visibleToClient: boolean;
    note: string | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
  messages: Array<{
    id: string;
    audience: "INTERNAL" | "CLIENT_VISIBLE";
    message: string;
    createdAt: string;
    author: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: DmvRenewalCaseStatus | null;
    toStatus: DmvRenewalCaseStatus;
    note: string | null;
    createdAt: string;
    changedBy: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
};

type DetailPageProps = {
  renewalId: string;
  mode: "client" | "staff";
};

function actorLabel(actor: { name: string | null; email: string | null }) {
  return actor.name?.trim() || actor.email || "Unknown";
}

function documentLabel(kind: string) {
  return kind.toLowerCase().replaceAll("_", " ");
}

function companyDisplayName(company: RenewalDetail["user"]["companyProfile"]) {
  return company?.legalName || company?.dbaName || "No company info yet";
}

export default function DmvRenewalDetailPage({
  renewalId,
  mode,
}: DetailPageProps) {
  const [renewal, setRenewal] = useState<RenewalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [staffNote, setStaffNote] = useState("");
  const [staffFile, setStaffFile] = useState<File | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/features/dmv-renewals/${renewalId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        renewal?: RenewalDetail;
        error?: string;
      };
      if (!response.ok || !data.renewal) {
        throw new Error(data.error || "Could not load DMV renewal.");
      }
      setRenewal(data.renewal);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DMV renewal.");
    } finally {
      setLoading(false);
    }
  }, [renewalId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    path: string,
    body?: Record<string, unknown>,
  ) {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "DMV renewal action failed.");
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "DMV renewal action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitClientResponse() {
    if (!responseFile) {
      setError("Upload a response document first.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      const uploaded = await uploadDmvRenewalFile(
        responseFile,
        `DMV client response - ${responseFile.name}`,
      );
      const response = await fetch(
        `/api/v1/features/dmv-renewals/${renewalId}/client-response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: uploaded,
            note: responseNote,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not upload the client response.");
      }
      setResponseFile(null);
      setResponseNote("");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Could not upload the client response.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendToClient() {
    if (!staffFile) {
      setError("Upload the return document first.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      const uploaded = await uploadDmvRenewalFile(
        staffFile,
        `DMV return document - ${staffFile.name}`,
      );
      const response = await fetch(
        `/api/v1/features/dmv-renewals/${renewalId}/send-to-client`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: uploaded,
            note: staffNote,
            visibleToClient: true,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not send the renewal to the client.");
      }
      setStaffFile(null);
      setStaffNote("");
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Could not send the renewal to the client.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading DMV renewal...</div>;
  }

  if (error && !renewal) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  if (!renewal) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Renewal not found.</div>;
  }

  const backHref =
    mode === "staff" ? "/admin/features/dmv/renewals" : "/dmv/renewals";

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-zinc-950">{renewal.caseNumber}</h2>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${dmvRenewalStatusClasses(renewal.status)}`}>
                {dmvRenewalStatusLabel(renewal.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              Unit {renewal.truck.unitNumber} {renewal.truck.plateNumber ? `- ${renewal.truck.plateNumber}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Submitted {formatDateTime(renewal.submittedAt || renewal.createdAt)}
            </p>
          </div>

          <Link
            href={backHref}
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Client</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{actorLabel(renewal.user)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Assigned To</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">
              {renewal.assignedTo ? actorLabel(renewal.assignedTo) : "Unassigned"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Updated</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatDateTime(renewal.updatedAt)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Documents</h3>
            <div className="mt-4 space-y-3">
              {renewal.documents.map((document) => (
                <div key={document.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{document.fileName}</p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {documentLabel(document.kind)} by {actorLabel(document.uploadedBy)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{formatDateTime(document.createdAt)}</p>
                      {document.note ? <p className="mt-2 text-sm text-zinc-600">{document.note}</p> : null}
                    </div>
                    <a
                      href={document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                    >
                      View
                    </a>
                  </div>
                </div>
              ))}
              {renewal.documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                  No documents yet.
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Messages</h3>
            <div className="mt-4 space-y-3">
              {renewal.messages.map((message) => (
                <div key={message.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-900">{message.message}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {actorLabel(message.author)} · {formatDateTime(message.createdAt)}
                  </p>
                </div>
              ))}
              {renewal.messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                  No messages yet.
                </div>
              ) : null}
            </div>
          </article>

          <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Status History</h3>
            <div className="mt-4 space-y-3">
              {renewal.statusHistory.map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-medium text-zinc-900">
                    {(item.fromStatus ? dmvRenewalStatusLabel(item.fromStatus) : "Created")} → {dmvRenewalStatusLabel(item.toStatus)}
                  </p>
                  {item.note ? <p className="mt-2 text-sm text-zinc-600">{item.note}</p> : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {actorLabel(item.changedBy)} · {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="space-y-4">
          {mode === "staff" ? (
            <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">Company Info</h3>
              <p className="mt-3 text-sm font-medium text-zinc-900">
                {companyDisplayName(renewal.user.companyProfile)}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-zinc-700">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">USDOT</p>
                  <p className="mt-1">{renewal.user.companyProfile?.dotNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">MC</p>
                  <p className="mt-1">{renewal.user.companyProfile?.mcNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">EIN</p>
                  <p className="mt-1">{renewal.user.companyProfile?.ein || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Phone</p>
                  <p className="mt-1">{renewal.user.companyProfile?.businessPhone || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Fleet</p>
                  <p className="mt-1">
                    {renewal.user.companyProfile?.trucksCount ?? 0} trucks / {renewal.user.companyProfile?.driversCount ?? 0} drivers
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">State</p>
                  <p className="mt-1">{renewal.user.companyProfile?.state || "-"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Address</p>
                  <p className="mt-1">
                    {[renewal.user.companyProfile?.address, renewal.user.companyProfile?.state]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </p>
                </div>
              </div>
            </article>
          ) : null}

          {mode === "staff" ? (
            <StaffFilingPaymentPanel filingType="dmv-renewal" filingId={renewalId} />
          ) : null}

          <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Vehicle</h3>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <p><span className="font-medium text-zinc-900">Unit:</span> {renewal.truck.unitNumber}</p>
              <p><span className="font-medium text-zinc-900">VIN:</span> {renewal.truck.vin || "-"}</p>
              <p><span className="font-medium text-zinc-900">Plate:</span> {renewal.truck.plateNumber || "-"}</p>
              <p><span className="font-medium text-zinc-900">Vehicle:</span> {[renewal.truck.year, renewal.truck.make, renewal.truck.model].filter(Boolean).join(" ") || "-"}</p>
            </div>
            {renewal.note ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Initial note:</span> {renewal.note}
              </div>
            ) : null}
          </article>

          {mode === "client" && renewal.status === "NEEDS_CLIENT_ACTION" ? (
            <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">Client Response</h3>
              <div className="mt-4 space-y-3">
                <input type="file" onChange={(event) => setResponseFile(event.target.files?.[0] ?? null)} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
                <textarea value={responseNote} onChange={(event) => setResponseNote(event.target.value)} rows={4} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400" />
                <button onClick={() => void submitClientResponse()} disabled={busy} className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
                  {busy ? "Uploading..." : "Upload Response"}
                </button>
              </div>
            </article>
          ) : null}

          {mode === "client" && renewal.status === "PENDING_CLIENT_APPROVAL" ? (
            <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">Final Approval</h3>
              <div className="mt-4 space-y-3">
                <textarea value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} rows={4} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400" />
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => void runAction(`/api/v1/features/dmv-renewals/${renewalId}/approve`, { note: correctionNote })} disabled={busy} className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
                    {busy ? "Working..." : "Approve"}
                  </button>
                  <button onClick={() => void runAction(`/api/v1/features/dmv-renewals/${renewalId}/request-correction`, { note: correctionNote })} disabled={busy} className="inline-flex items-center justify-center rounded-2xl border border-amber-200 px-5 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60">
                    Request Correction
                  </button>
                </div>
              </div>
            </article>
          ) : null}

          {mode === "staff" ? (
            <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-950">Staff Actions</h3>
              <div className="mt-4 space-y-4">
                {(renewal.status === "SUBMITTED" || renewal.status === "CHANGES_REQUESTED") ? (
                  <>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Se le asignara este caso a usted si comienza el proceso.
                    </div>
                    <button onClick={() => void runAction(`/api/v1/features/dmv-renewals/${renewalId}/start-review`)} disabled={busy} className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
                      Start Review
                    </button>
                  </>
                ) : null}

                {renewal.status === "IN_REVIEW" ? (
                  <>
                    <textarea value={staffNote} onChange={(event) => setStaffNote(event.target.value)} rows={4} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400" />
                    <div className="flex flex-wrap gap-3">
                      <button onClick={() => void runAction(`/api/v1/features/dmv-renewals/${renewalId}/request-client-action`, { note: staffNote })} disabled={busy} className="inline-flex items-center justify-center rounded-2xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60">
                        Request Client Action
                      </button>
                    </div>
                    <input type="file" onChange={(event) => setStaffFile(event.target.files?.[0] ?? null)} className="w-full rounded-2xl border border-zinc-200 px-4 py-3" />
                    <button onClick={() => void sendToClient()} disabled={busy} className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60">
                      Send To Client
                    </button>
                  </>
                ) : null}

                {renewal.status !== "COMPLETED" && renewal.status !== "CANCELLED" ? (
                  <button onClick={() => void runAction(`/api/v1/features/dmv-renewals/${renewalId}/cancel`, { note: staffNote })} disabled={busy} className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                    Cancel
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
