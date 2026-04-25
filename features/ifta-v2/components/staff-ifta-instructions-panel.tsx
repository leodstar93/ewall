"use client";

export type StaffIftaInstructions = {
  filingId: string;
  baseJurisdiction: string | null;
  accessMode: "SAVED_IN_SYSTEM" | "CONTACT_ME";
  paymentInfoMode: "CONTACT_CLIENT";
  procedure: {
    title: string;
    portalUrl?: string;
    filingMethod: string;
    paymentMethod: string;
    requiresPortalLogin: boolean;
    supportsUpload: boolean;
    staffInstructions: {
      steps: string[];
    };
    checklist?: unknown;
  } | null;
  hasSavedPortalCredential: boolean;
};

function statusLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function checklistItems(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function StaffIftaInstructionsPanel({
  instructions,
  loading,
  open,
  onClose,
  revealBusy,
  onReveal,
}: {
  instructions: StaffIftaInstructions | null;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  revealBusy: boolean;
  onReveal: () => void;
}) {
  if (!open) {
    return null;
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="text-sm text-gray-500">Loading IFTA processing instructions...</div>
        </div>
      </div>
    );
  }

  if (!instructions) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="text-sm text-gray-500">
            IFTA processing instructions are not available for this filing.
          </div>
        </div>
      </div>
    );
  }

  const checklist = checklistItems(instructions.procedure?.checklist);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--r)]">
                  IFTA
                </div>
                <h3 className="mt-1 text-2xl font-semibold text-gray-950">
                  How to Proceed
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Detailed jurisdiction instructions for staff processing.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
              <div className="space-y-4">
                {instructions.procedure ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="text-sm font-semibold text-gray-950">
                      {instructions.procedure.title}
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-gray-600">
                      <div>
                        Payment method: {statusLabel(instructions.procedure.paymentMethod)}
                      </div>
                      <div>
                        Portal login required: {instructions.procedure.requiresPortalLogin ? "Yes" : "No"}
                      </div>
                      <div>
                        Upload supported: {instructions.procedure.supportsUpload ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    No jurisdiction procedure configured for this state.
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-semibold text-gray-950">Portal access guidance</div>
                  {instructions.accessMode === "CONTACT_ME" ? (
                    <p className="mt-3 text-sm text-gray-600">
                      Staff must contact the client for portal login credentials before filing.
                    </p>
                  ) : instructions.hasSavedPortalCredential ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="text-sm text-gray-600">
                        Portal credentials are saved securely for this jurisdiction.
                      </p>
                      <button
                        type="button"
                        onClick={onReveal}
                        disabled={revealBusy}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60"
                      >
                        {revealBusy ? "Revealing..." : "Reveal Portal Credentials"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-amber-700">
                      This filing is set to use saved credentials, but no active portal credential is stored.
                    </p>
                  )}
                  <p className="mt-3 text-sm text-gray-600">
                    ACH and card details are never stored. Contact the client when payment information is needed.
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-semibold text-gray-950">How to Proceed</div>
                  {instructions.procedure?.staffInstructions.steps.length ? (
                    <ol className="mt-3 grid gap-3 pl-5 text-sm text-gray-700">
                      {instructions.procedure.staffInstructions.steps.map((step, index) => (
                        <li key={`${instructions.filingId}-step-${index}`}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <ol className="mt-3 grid gap-3 pl-5 text-sm text-gray-700">
                      <li>Open the state portal.</li>
                      <li>Login or contact the client.</li>
                      <li>File the quarterly return.</li>
                      <li>Contact the client for ACH or card payment details.</li>
                      <li>Upload the receipt and mark the filing completed.</li>
                    </ol>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-semibold text-gray-950">Checklist</div>
                <ol className="mt-3 grid gap-3 pl-5 text-sm text-gray-700">
                  {checklist.length > 0 ? (
                    checklist.map((item, index) => (
                      <li key={`${instructions.filingId}-check-${index}`}>{item}</li>
                    ))
                  ) : (
                    <>
                      <li>Open state portal.</li>
                      <li>Login or contact client.</li>
                      <li>File quarterly return.</li>
                      <li>Contact client for ACH or card payment details.</li>
                      <li>Submit payment.</li>
                      <li>Upload receipt.</li>
                      <li>Mark completed.</li>
                    </>
                  )}
                </ol>
              </div>
            </div>
      </div>
    </div>
  );
}
