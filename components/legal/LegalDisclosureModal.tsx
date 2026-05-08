"use client";

import { useState } from "react";

export type LegalDisclosureSignPayload = {
  signerName: string;
  signerTitle: string;
  signatureText: string;
};

type LegalDisclosureModalProps = {
  module: "2290" | "ifta" | "ucr";
  disclosureText: string;
  onSign: (payload: LegalDisclosureSignPayload) => Promise<void>;
  onCancel: () => void;
};

const MODULE_LABELS: Record<LegalDisclosureModalProps["module"], string> = {
  "2290": "Form 2290",
  ifta: "IFTA",
  ucr: "UCR",
};

export default function LegalDisclosureModal({
  module,
  disclosureText,
  onSign,
  onCancel,
}: LegalDisclosureModalProps) {
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moduleLabel = MODULE_LABELS[module];
  const canSign = signerName.trim().length > 0 && signerTitle.trim().length > 0 && confirmed;

  async function handleSign() {
    if (!canSign) return;
    try {
      setBusy(true);
      setError(null);
      await onSign({
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signatureText: signerName.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your signature. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclosure-modal-title"
    >
      <div className="flex w-full max-w-lg flex-col rounded-[28px] border border-zinc-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {moduleLabel} — Legal Disclosure
            </p>
            <h2 id="disclosure-modal-title" className="mt-1 text-lg font-semibold text-zinc-950">
              Review and sign
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 text-lg leading-none text-zinc-600 hover:bg-zinc-50 disabled:opacity-60"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Disclosure text */}
        <div className="max-h-56 overflow-y-auto px-6 py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Disclosure statement
          </p>
          {disclosureText ? (
            <div className="whitespace-pre-wrap rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm leading-relaxed text-zinc-700">
              {disclosureText}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
              No disclosure text has been configured for this module yet.
            </div>
          )}
        </div>

        {/* Signature inputs */}
        <div className="grid gap-4 px-6 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-900">Full name *</span>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Jane Smith"
                disabled={busy}
                className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-zinc-900 outline-none focus:border-zinc-400 disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-900">Title / Role *</span>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="Owner / Authorized Agent"
                disabled={busy}
                className="rounded-2xl border border-zinc-200 px-4 py-2.5 text-zinc-900 outline-none focus:border-zinc-400 disabled:opacity-60"
              />
            </label>
          </div>

          {/* Signature preview */}
          {signerName.trim() && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs text-zinc-500">Electronic signature</p>
              <p className="mt-1 font-serif text-xl italic text-zinc-900">{signerName.trim()}</p>
            </div>
          )}

          {/* Confirmation checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy}
              className="mt-0.5 flex-shrink-0"
            />
            <span>
              I have read and agree to the disclosure statement above. I confirm that the information
              in this {moduleLabel} filing is accurate and that I am authorized to sign on behalf of
              the company.
            </span>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSign()}
            disabled={!canSign || busy}
            className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy ? "Signing..." : "Sign & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
