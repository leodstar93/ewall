"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import StaffFilingPaymentPanel from "@/components/ach/StaffFilingPaymentPanel";
import UcrFilingForm from "@/features/ucr/filing-form";
import {
  UcrFiling,
  UcrTimelineItem,
  customerActionLabel,
  customerPaymentStatusClasses,
  customerPaymentStatusLabel,
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
  permissions: {
    isOwner: boolean;
    canManageAll: boolean;
    canEdit: boolean;
    canSubmit: boolean;
    canCheckout: boolean;
    canViewReceipt: boolean;
  };
};

type UcrDetailPageProps = {
  filingId: string;
  mode: "driver" | "staff";
  apiBasePath?: string;
  backHref?: string;
  detailHrefBase?: string;
};

export default function UcrDetailPage(props: UcrDetailPageProps) {
  const [payload, setPayload] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [staffReason, setStaffReason] = useState("");
  const [officialReceiptNumber, setOfficialReceiptNumber] = useState("");
  const [officialConfirmation, setOfficialConfirmation] = useState("");
  const [officialPaidAt, setOfficialPaidAt] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const checkoutIdempotencyKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  );

  const apiBasePath =
    props.apiBasePath ?? (props.mode === "staff" ? "/api/v1/admin/ucr" : "/api/v1/features/ucr");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBasePath}/${props.filingId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as DetailPayload & {
        error?: string;
      };
      if (!response.ok || !data.filing) {
        throw new Error(data.error || "Could not load the UCR filing.");
      }

      setPayload(data);
      setOfficialReceiptNumber(data.filing.officialReceiptNumber ?? "");
      setOfficialConfirmation(data.filing.officialConfirmation ?? "");
      setOfficialPaidAt(
        data.filing.officialPaidAt
          ? new Date(data.filing.officialPaidAt).toISOString().slice(0, 16)
          : "",
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load the UCR filing.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, props.filingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCheckout() {
    try {
      setBusy(true);
      setError(null);
      const response = await fetch(`/api/v1/features/ucr/${props.filingId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutIdempotencyKeyRef.current,
        },
        body: JSON.stringify({ idempotencyKey: checkoutIdempotencyKeyRef.current }),
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
        checkoutIdempotencyKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;
        await load();
        return;
      }

      throw new Error("Could not start checkout.");
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function requestAdminAction(path: string, body?: unknown, isMultipart = false) {
    const response = await fetch(`${apiBasePath}/${props.filingId}/${path}`, {
      method: "POST",
      headers:
        body && !isMultipart ? { "Content-Type": "application/json" } : undefined,
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; details?: string[] };
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
        actionError instanceof Error
          ? actionError.message
          : "The UCR action failed.",
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

      await requestAdminAction("complete", {
        officialReceiptNumber,
        officialConfirmation,
        officialPaidAt: officialPaidAt ? new Date(officialPaidAt).toISOString() : undefined,
      });

      setReceiptFile(null);
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The UCR action failed.",
      );
    } finally {
      setBusy(false);
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

  const { filing, permissions, timeline } = payload;
  const companyProfile = filing.user?.companyProfile;
  const companyLegalName =
    companyProfile?.legalName || companyProfile?.companyName || filing.legalName;
  const companyDba = companyProfile?.dbaName || filing.dbaName;
  const companyDot = companyProfile?.dotNumber || filing.dotNumber || filing.usdotNumber;
  const companyMc = companyProfile?.mcNumber || filing.mcNumber;
  const companyEin = companyProfile?.ein || filing.fein;
  const companyState = companyProfile?.state || filing.baseState;
  const assignedStaffLabel =
    filing.assignedStaff?.name?.trim() ||
    filing.assignedStaff?.email ||
    "Unassigned";
  const backHref =
    props.backHref ?? (props.mode === "staff" ? "/admin/features/ucr" : "/ucr");

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#dbeafe)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              UCR Concierge Filing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {companyLegalName}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Filing year {filing.year} • Updated {formatDate(filing.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filingStatusClasses(
                filing.status,
              )}`}
            >
              {filingStatusLabel(filing.status)}
            </span>
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Back
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Customer payment
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${customerPaymentStatusClasses(
                filing.customerPaymentStatus,
              )}`}
            >
              {customerPaymentStatusLabel(filing.customerPaymentStatus)}
            </span>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Official payment
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${officialPaymentStatusClasses(
                filing.officialPaymentStatus,
              )}`}
            >
              {officialPaymentStatusLabel(filing.officialPaymentStatus)}
            </span>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Customer action
            </p>
            <p className="mt-3 text-sm font-medium text-zinc-900">{customerActionLabel(filing)}</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {props.mode === "driver" && permissions.canEdit ? (
        <UcrFilingForm
          mode="edit"
          filingId={filing.id}
          apiBasePath="/api/v1/features/ucr"
          currentStatus={filing.status}
          detailHrefBase={props.detailHrefBase}
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
            void load();
          }}
        />
      ) : null}

      <section className={props.mode === "staff" ? "space-y-6" : "grid gap-6 lg:grid-cols-3"}>
        <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-zinc-950">Filing details</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">DOT</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{companyDot || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">DBA</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{companyDba || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Base state</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{companyState || "-"}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Vehicle count</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">{filing.vehicleCount ?? filing.fleetSize}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">UCR amount</p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{formatCurrency(filing.ucrAmount)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Service fee</p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{formatCurrency(filing.serviceFee)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Processing fee</p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{formatCurrency(filing.processingFee)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Total charged</p>
              <p className="mt-2 text-xl font-semibold text-zinc-950">{formatCurrency(filing.totalCharged)}</p>
            </div>
          </div>

          {props.mode === "driver" ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {permissions.canCheckout ? (
                <button
                  type="button"
                  onClick={() => void runCheckout()}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {busy ? "Redirecting..." : "Pay now"}
                </button>
              ) : null}
              {permissions.canViewReceipt ? (
                <a
                  href={`/api/v1/features/ucr/${filing.id}/receipt`}
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                >
                  Download official receipt
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {props.mode === "driver" ? (
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Timeline</h3>
            <div className="mt-5 space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-zinc-600">No workflow events yet.</p>
              ) : (
                timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {item.kind === "transition" ? item.toStatus?.replace(/_/g, " ") : item.eventType}
                    </p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">
                      {item.message || item.reason || item.fromStatus || "Status updated"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">{formatDate(item.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>

      {props.mode === "staff" ? (
        <section className="space-y-6">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Customer company info</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Legal name</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">{companyLegalName || "-"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">DBA</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">{companyDba || "-"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">DOT</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">{companyDot || "-"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">MC</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">{companyMc || "-"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">EIN / FEIN</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">{companyEin || "-"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Base state</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">{companyState || "-"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Staff actions</h3>
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Assigned staff</p>
              <p className="mt-2 text-sm font-medium text-zinc-900">
                {assignedStaffLabel}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void postAdminAction("claim")}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
              >
                Assign to me
              </button>
              <button
                type="button"
                onClick={() => void postAdminAction("needs-attention", { reason: staffReason })}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-2xl border border-amber-200 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60"
              >
                Needs attention
              </button>
              <button
                type="button"
                onClick={() => void postAdminAction("cancel", { reason: staffReason })}
                disabled={busy}
                className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>

            <label className="mt-5 block space-y-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Internal reason / note</span>
              <textarea
                value={staffReason}
                onChange={(event) => setStaffReason(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
              />
            </label>
          </div>

          <StaffFilingPaymentPanel filingType="ucr" filingId={props.filingId} />

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Official receipt</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Upload the official receipt and finish the filing in one staff step.
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Receipt file</span>
                <input
                  type="file"
                  onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                  className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3"
                />
              </label>
              <div className="flex items-end">
                <p className="text-sm text-zinc-500">
                  If you attach a file here, it will upload automatically when you complete the filing.
                </p>
              </div>
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Receipt number</span>
                <input
                  value={officialReceiptNumber}
                  onChange={(event) => setOfficialReceiptNumber(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Confirmation</span>
                <input
                  value={officialConfirmation}
                  onChange={(event) => setOfficialConfirmation(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">Official paid at</span>
                <input
                  type="datetime-local"
                  value={officialPaidAt}
                  onChange={(event) => setOfficialPaidAt(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
                />
              </label>
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={() => void completeByStaff()}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  Complete by staff
                </button>
              </div>
            </div>

            {filing.officialReceiptUrl ? (
              <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-medium text-zinc-900">{filing.officialReceiptName}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Uploaded receipt is on file. Customers can download it after completion.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-zinc-950">Timeline</h3>
            <div className="mt-5 space-y-3">
              {timeline.length === 0 ? (
                <p className="text-sm text-zinc-600">No workflow events yet.</p>
              ) : (
                timeline.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {item.kind === "transition" ? item.toStatus?.replace(/_/g, " ") : item.eventType}
                    </p>
                    <p className="mt-2 text-sm font-medium text-zinc-900">
                      {item.message || item.reason || item.fromStatus || "Status updated"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">{formatDate(item.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
