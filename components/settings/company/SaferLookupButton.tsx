"use client";

import { useState } from "react";
import { InlineAlert } from "@/components/settings/settings-ui";
import type { SaferCompanyNormalized } from "@/services/fmcsa/saferTypes";

export default function SaferLookupButton({
  dotNumber,
  onLookupResult,
}: {
  dotNumber: string;
  onLookupResult: (result: SaferCompanyNormalized | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const handleLookup = async () => {
    const trimmedDot = dotNumber.trim();
    if (!trimmedDot) {
      setNotice({ tone: "error", message: "Enter a USDOT number before importing from SAFER." });
      onLookupResult(null);
      return;
    }

    try {
      setLoading(true);
      setNotice(null);
      onLookupResult(null);

      const response = await fetch("/api/v1/integrations/safer/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dotNumber: trimmedDot }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<SaferCompanyNormalized> & {
        error?: string;
      };

      if (response.status === 404) {
        setNotice({
          tone: "info",
          message:
            payload.warnings?.[0] ??
            "No pudimos encontrar esta compania en SAFER. Puedes completar manualmente.",
        });
        onLookupResult(payload as SaferCompanyNormalized);
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error || "We couldn't retrieve company data from SAFER right now.");
      }

      setNotice({
        tone: payload.warnings?.length ? "info" : "success",
        message: payload.warnings?.length
          ? "SAFER returned a partial snapshot. Review the preview before applying it."
          : "SAFER snapshot ready to review.",
      });
      onLookupResult(payload as SaferCompanyNormalized);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't retrieve company data from SAFER right now.",
      });
      onLookupResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading}
          className="rounded-2xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Looking up SAFER..." : "Import from SAFER"}
        </button>
        <p className="text-sm text-zinc-500">
          Lookup happens server-side and never blocks manual editing if SAFER is unavailable.
        </p>
      </div>

      {notice ? <InlineAlert tone={notice.tone} message={notice.message} /> : null}
    </div>
  );
}
