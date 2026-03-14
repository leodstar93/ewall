"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UCRFilingStatus,
  UCREntityType,
  formatCurrency,
  ucrEntityTypeOptions,
} from "@/features/ucr/shared";

type UcrFilingFormProps = {
  mode: "create" | "edit";
  filingId?: string;
  currentStatus?: UCRFilingStatus | null;
  initialValues?: {
    filingYear?: number;
    legalName?: string;
    usdotNumber?: string | null;
    mcNumber?: string | null;
    fein?: string | null;
    baseState?: string | null;
    entityType?: UCREntityType;
    interstateOperation?: boolean;
    fleetSize?: number;
    clientNotes?: string | null;
  };
  onSaved?: () => void;
};

type PreviewState = {
  bracketLabel: string;
  feeAmount: string;
};

export default function UcrFilingForm(props: UcrFilingFormProps) {
  const router = useRouter();
  const [filingYear, setFilingYear] = useState(
    props.initialValues?.filingYear ?? new Date().getFullYear(),
  );
  const [legalName, setLegalName] = useState(props.initialValues?.legalName ?? "");
  const [usdotNumber, setUsdotNumber] = useState(props.initialValues?.usdotNumber ?? "");
  const [mcNumber, setMcNumber] = useState(props.initialValues?.mcNumber ?? "");
  const [fein, setFein] = useState(props.initialValues?.fein ?? "");
  const [baseState, setBaseState] = useState(props.initialValues?.baseState ?? "");
  const [entityType, setEntityType] = useState<UCREntityType>(
    props.initialValues?.entityType ?? "MOTOR_CARRIER",
  );
  const [interstateOperation, setInterstateOperation] = useState(
    props.initialValues?.interstateOperation ?? true,
  );
  const [fleetSize, setFleetSize] = useState(props.initialValues?.fleetSize ?? 0);
  const [clientNotes, setClientNotes] = useState(props.initialValues?.clientNotes ?? "");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const year = Number(filingYear);
    const size = Number(fleetSize);
    if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(size) || size < 0) {
      setPreview(null);
      setPreviewError(null);
      return () => controller.abort();
    }

    const timeout = window.setTimeout(async () => {
      try {
        setPreviewError(null);
        const response = await fetch(
          `/api/v1/features/ucr/rate-preview?year=${year}&fleetSize=${size}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = (await response.json().catch(() => ({}))) as {
          bracketLabel?: string;
          feeAmount?: string;
          error?: string;
        };

        if (!response.ok) {
          setPreview(null);
          setPreviewError(data.error || "No active rate bracket matches that fleet size.");
          return;
        }

        setPreview({
          bracketLabel: data.bracketLabel ?? "-",
          feeAmount: data.feeAmount ?? "0.00",
        });
      } catch {
        if (!controller.signal.aborted) {
          setPreview(null);
          setPreviewError("Could not calculate the UCR fee preview.");
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [filingYear, fleetSize]);

  async function persist(submitAfterSave: boolean) {
    try {
      setBusy(true);
      setError(null);
      setMessage(null);

      const payload = {
        filingYear,
        legalName,
        usdotNumber,
        mcNumber,
        fein,
        baseState,
        entityType,
        interstateOperation,
        fleetSize,
        clientNotes,
      };

      const saveResponse = await fetch(
        props.mode === "create"
          ? "/api/v1/features/ucr"
          : `/api/v1/features/ucr/${props.filingId}`,
        {
          method: props.mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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

      const savedId = saveData.filing.id;
      const submitEndpoint =
        props.currentStatus === "CORRECTION_REQUESTED"
          ? `/api/v1/features/ucr/${savedId}/resubmit`
          : `/api/v1/features/ucr/${savedId}/submit`;

      if (submitAfterSave) {
        const submitResponse = await fetch(submitEndpoint, { method: "POST" });
        const submitData = (await submitResponse.json().catch(() => ({}))) as {
          error?: string;
          details?: string[];
        };

        if (!submitResponse.ok) {
          throw new Error(
            [submitData.error, ...(Array.isArray(submitData.details) ? submitData.details : [])]
              .filter(Boolean)
              .join(" ") || "Could not submit the filing.",
          );
        }

        setMessage(
          props.currentStatus === "CORRECTION_REQUESTED"
            ? "Filing resubmitted for review."
            : "Filing submitted for review.",
        );
      } else {
        setMessage(props.mode === "create" ? "Draft created." : "Draft updated.");
      }

      props.onSaved?.();
      router.push(`/ucr/${savedId}`);
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The filing action failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const submitLabel =
    props.currentStatus === "CORRECTION_REQUESTED" ? "Resubmit" : "Submit for review";

  return (
    <div className="space-y-5 rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-950">
            {props.mode === "create" ? "Annual filing details" : "Edit filing"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            UCR fees are always calculated from the active brackets configured in admin settings.
          </p>
        </div>
        {preview && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-semibold">{preview.bracketLabel}</p>
            <p className="mt-1">{formatCurrency(preview.feeAmount)}</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Filing year</span>
          <input
            type="number"
            value={filingYear}
            onChange={(event) => setFilingYear(Number(event.target.value))}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Fleet size</span>
          <input
            type="number"
            min={0}
            value={fleetSize}
            onChange={(event) => setFleetSize(Number(event.target.value))}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
          <span className="font-medium text-zinc-900">Legal company name</span>
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">USDOT number</span>
          <input
            value={usdotNumber}
            onChange={(event) => setUsdotNumber(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">MC number</span>
          <input
            value={mcNumber}
            onChange={(event) => setMcNumber(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">FEIN</span>
          <input
            value={fein}
            onChange={(event) => setFein(event.target.value)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Base state</span>
          <input
            maxLength={2}
            value={baseState}
            onChange={(event) => setBaseState(event.target.value.toUpperCase())}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 uppercase outline-none ring-0 focus:border-zinc-400"
          />
        </label>

        <label className="space-y-2 text-sm text-zinc-700">
          <span className="font-medium text-zinc-900">Entity type</span>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value as UCREntityType)}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          >
            {ucrEntityTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={interstateOperation}
            onChange={(event) => setInterstateOperation(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <span>
            <span className="font-medium text-zinc-900">Interstate operation</span>
            <span className="mt-1 block text-zinc-500">
              Uncheck only if the company is not operating interstate.
            </span>
          </span>
        </label>

        <label className="space-y-2 text-sm text-zinc-700 md:col-span-2">
          <span className="font-medium text-zinc-900">Client notes</span>
          <textarea
            value={clientNotes}
            onChange={(event) => setClientNotes(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-zinc-200 px-4 py-3 outline-none ring-0 focus:border-zinc-400"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void persist(false)}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
        >
          {busy ? "Saving..." : props.mode === "create" ? "Save draft" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => void persist(true)}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "Working..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
