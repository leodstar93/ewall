"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UCRFilingStatus, formatCurrency } from "@/features/ucr/shared";
import LegalDisclosureModal from "@/components/legal/LegalDisclosureModal";

type UcrFilingFormProps = {
  mode: "create" | "edit";
  filingId?: string;
  apiBasePath?: string;
  currentStatus?: UCRFilingStatus | null;
  detailHrefBase?: string;
  disclosureText?: string | null;
  initialValues?: {
    year?: number;
    legalName?: string;
    dbaName?: string | null;
    dotNumber?: string | null;
    mcNumber?: string | null;
    fein?: string | null;
    baseState?: string | null;
    interstateOperation?: boolean;
    vehicleCount?: number | null;
    clientNotes?: string | null;
  };
  onSaved?: () => void;
};

type PreviewState = {
  bracketCode: string;
  ucrAmount: string;
  serviceFee: string;
  processingFee: string;
  total: string;
};

export default function UcrFilingForm(props: UcrFilingFormProps) {
  const router = useRouter();
  const isCreateMode = props.mode === "create";
  const [year, setYear] = useState(
    props.initialValues?.year ?? new Date().getFullYear(),
  );
  const [vehicleCount, setVehicleCount] = useState(props.initialValues?.vehicleCount ?? 1);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disclosureModalOpen, setDisclosureModalOpen] = useState(false);
  const [pendingSubmitId, setPendingSubmitId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(vehicleCount) || vehicleCount <= 0) {
      setPreview(null);
      setPreviewError(null);
      return () => controller.abort();
    }

    const timeout = window.setTimeout(async () => {
      try {
        setPreviewError(null);
        const response = await fetch(
          `${props.apiBasePath ?? "/api/v1/features/ucr"}/rate-preview?year=${year}&vehicleCount=${vehicleCount}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = (await response.json().catch(() => ({}))) as PreviewState & {
          error?: string;
        };

        if (!response.ok) {
          setPreview(null);
          setPreviewError(data.error || "No active rate bracket matches that vehicle count.");
          return;
        }

        setPreview({
          bracketCode: data.bracketCode ?? "-",
          ucrAmount: data.ucrAmount ?? "0.00",
          serviceFee: data.serviceFee ?? "0.00",
          processingFee: data.processingFee ?? "0.00",
          total: data.total ?? "0.00",
        });
      } catch {
        if (!controller.signal.aborted) {
          setPreview(null);
          setPreviewError("Could not calculate the UCR pricing preview.");
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [year, vehicleCount, props.apiBasePath]);

  async function saveDraft(): Promise<string | null> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saveResponse = await fetch(
        props.mode === "create"
          ? (props.apiBasePath ?? "/api/v1/features/ucr")
          : `${props.apiBasePath ?? "/api/v1/features/ucr"}/${props.filingId}`,
        {
          method: props.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, vehicleCount }),
        },
      );
      const saveData = (await saveResponse.json().catch(() => ({}))) as {
        filing?: { id: string };
        error?: string;
        details?: string[];
      };
      if (!saveResponse.ok || !saveData.filing) {
        throw new Error(
          [saveData.error, ...(Array.isArray(saveData.details) ? saveData.details : [])]
            .filter(Boolean)
            .join(" ") || "Could not save the filing.",
        );
      }
      return saveData.filing.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The filing action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function persist(submitAfterSave: boolean) {
    const savedId = await saveDraft();
    if (!savedId) return;

    if (!submitAfterSave) {
      setMessage(props.mode === "create" ? "Draft created." : "Draft updated.");
      props.onSaved?.();
      router.push(`${props.detailHrefBase ?? "/ucr"}/${savedId}`);
      router.refresh();
      return;
    }

    setPendingSubmitId(savedId);
    setDisclosureModalOpen(true);
  }

  async function signAndSubmit(signerData: { signerName: string; signerTitle: string; signatureText: string }) {
    if (!pendingSubmitId) return;
    const base = props.apiBasePath ?? "/api/v1/features/ucr";

    const authResponse = await fetch(`${base}/${pendingSubmitId}/authorization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signerData),
    });
    const authData = (await authResponse.json().catch(() => ({}))) as { error?: string };
    if (!authResponse.ok) {
      throw new Error(authData.error || "Could not save your signature.");
    }

    const submitResponse = await fetch(`${base}/${pendingSubmitId}/submit`, { method: "POST" });
    const submitData = (await submitResponse.json().catch(() => ({}))) as { error?: string; details?: string[] };
    if (!submitResponse.ok) {
      throw new Error(
        [submitData.error, ...(Array.isArray(submitData.details) ? submitData.details : [])]
          .filter(Boolean)
          .join(" ") || "Could not submit the filing.",
      );
    }

    setDisclosureModalOpen(false);
    setPendingSubmitId(null);
    setMessage("Filing is ready for payment.");
    props.onSaved?.();
    router.push(`${props.detailHrefBase ?? "/ucr"}/${pendingSubmitId}`);
    router.refresh();
  }

  const canSubmit =
    props.currentStatus === null ||
    typeof props.currentStatus === "undefined" ||
    props.currentStatus === "DRAFT" ||
    props.currentStatus === "CORRECTION_REQUESTED";

  return (
    <div className="space-y-5 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">
            {isCreateMode ? "New UCR filing" : "Edit filing"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            We use the company information already saved in Company Info for this filing.
          </p>
        </div>
        {preview && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-semibold">Bracket {preview.bracketCode}</p>
            <p className="mt-1">Total {formatCurrency(preview.total)}</p>
          </div>
        )}
      </div>

      {previewError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {previewError}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        Company name, DOT, MC, EIN, and base state are pulled automatically from Company Info.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Year</span>
          <input
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Vehicle count</span>
          <input
            type="number"
            min={1}
            value={vehicleCount}
            onChange={(event) => setVehicleCount(Number(event.target.value))}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>
      </div>

      {preview ? (
        <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">UCR amount</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatCurrency(preview.ucrAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Service fee</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatCurrency(preview.serviceFee)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Processing fee</p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatCurrency(preview.processingFee)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Total</p>
            <p className="mt-2 text-sm font-semibold text-zinc-950">{formatCurrency(preview.total)}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void persist(false)}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy ? "Saving..." : props.mode === "create" ? "Save draft" : "Save changes"}
        </button>
        {canSubmit ? (
          <button
            type="button"
            onClick={() => void persist(true)}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy ? "Working..." : "Submit for payment"}
          </button>
        ) : null}
      </div>

      {disclosureModalOpen ? (
        <LegalDisclosureModal
          module="ucr"
          disclosureText={props.disclosureText ?? ""}
          onSign={(signerData) => signAndSubmit(signerData)}
          onCancel={() => { setDisclosureModalOpen(false); setPendingSubmitId(null); }}
        />
      ) : null}
    </div>
  );
}
