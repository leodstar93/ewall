"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getStatusTone } from "@/lib/ui/status-utils";

function currentQuarter() {
  const month = new Date().getUTCMonth();
  if (month < 3) return "Q1";
  if (month < 6) return "Q2";
  if (month < 9) return "Q3";
  return "Q4";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function readJson(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function IftaV2ClientPage() {
  const searchParams = useSearchParams();
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [quarter, setQuarter] = useState(currentQuarter());
  const [notes, setNotes] = useState("");
  const [connections, setConnections] = useState<any[]>([]);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [filings, setFilings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    searchParams.get("status") === "connected"
      ? "Motive connected successfully. You can open your IFTA v2 request now."
      : null,
  );
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [filingsData, connectData] = await Promise.all([
        readJson("/api/v1/features/ifta-v2/filings"),
        readJson("/api/v1/integrations/eld/connect/motive?returnPath=%2Fifta-v2"),
      ]);

      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
      setConnections(Array.isArray(connectData.connections) ? connectData.connections : []);
      setAuthorizationUrl(connectData.authorizationUrl ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load IFTA v2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openRequest() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const payload = await readJson("/api/v1/features/ifta-v2/filings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          quarter,
          notes,
          syncOnOpen: true,
        }),
      });

      setNotes("");
      setMessage(
        payload.filing?.status === "NEEDS_ATTENTION"
          ? "IFTA v2 request opened, but the initial sync needs attention. Staff can already see the request."
          : "IFTA v2 request sent to staff. Initial sync started automatically.",
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open IFTA v2 request.");
    } finally {
      setBusy(false);
    }
  }

  const latestConnection = connections[0] ?? null;
  const hasActiveConnection = connections.some((item) => item.status === "ACTIVE");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="rounded-[28px] border border-sky-100 bg-gradient-to-r from-white via-sky-50 to-cyan-50 p-8">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.18em] text-sky-700">Client Filing Flow</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-950">IFTA v2</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Open a quarterly filing request from your synced ELD data. Once you submit it, staff reviews
            the synced trips, fuel, and exceptions before approval.
          </p>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-950">1. Connect your Motive account</h2>
          <p className="mt-1 text-sm text-gray-600">
            Your staff filing runs from synced ELD data. Connect the company Motive account before opening the request.
          </p>
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            {latestConnection ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-950">{latestConnection.provider}</span>
                  <Badge tone={getStatusTone(latestConnection.status)}>
                    {formatStatusLabel(latestConnection.status)}
                  </Badge>
                </div>
                <div>Last sync: {formatDate(latestConnection.lastSyncAt)}</div>
                {latestConnection.lastError ? <div className="text-red-700">{latestConnection.lastError}</div> : null}
              </div>
            ) : (
              <div>No Motive connection detected yet.</div>
            )}
          </div>
          {authorizationUrl ? (
            <div className="mt-4">
              <Link
                href={authorizationUrl}
                className="inline-flex rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
              >
                Connect via OAuth
              </Link>
            </div>
          ) : null}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-950">2. Open your quarterly request</h2>
          <p className="mt-1 text-sm text-gray-600">
            Opening the request notifies staff and triggers the initial sync for the selected quarter.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none">
              {[year - 1, year, year + 1].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={quarter} onChange={(event) => setQuarter(event.target.value)} className="h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 outline-none">
              {["Q1", "Q2", "Q3", "Q4"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional note for staff" />
          </div>
          <div className="mt-4">
            <Button onClick={openRequest} disabled={busy || !hasActiveConnection}>
              {busy ? "Opening request..." : "Open IFTA v2 Request"}
            </Button>
            {!hasActiveConnection ? (
              <div className="mt-2 text-xs text-amber-700">
                Connect the company Motive account before opening the filing request.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-950">3. Track your requests</h2>
        <p className="mt-1 text-sm text-gray-600">
          These are your IFTA v2 requests and the status of the staff review workflow.
        </p>
        {loading ? (
          <div className="mt-4 text-sm text-gray-500">Loading requests...</div>
        ) : filings.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            No IFTA v2 requests yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filings.map((filing) => (
              <div key={filing.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-sm font-semibold text-gray-950">
                    {filing.year} {filing.quarter}
                  </div>
                  <Badge tone={getStatusTone(filing.status)}>{formatStatusLabel(filing.status)}</Badge>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Requested: {formatDate(filing.requestedAt)}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Sync started: {formatDate(filing.syncTriggeredAt)}
                </div>
                {filing.notes ? <div className="mt-2 text-sm text-gray-700">Your note: {filing.notes}</div> : null}
                {filing.reviewNotes ? <div className="mt-2 text-sm text-sky-700">Staff note: {filing.reviewNotes}</div> : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
