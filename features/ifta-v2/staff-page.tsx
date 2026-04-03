"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScroller, TableWrapper } from "@/components/ui/table";
import { getStatusTone } from "@/lib/ui/status-utils";

type TabKey = "overview" | "trips" | "fuel" | "exceptions" | "sync";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "trips", label: "Trips" },
  { key: "fuel", label: "Fuel" },
  { key: "exceptions", label: "Exceptions" },
  { key: "sync", label: "Sync" },
];

function nowQuarter() {
  const month = new Date().getUTCMonth();
  if (month < 3) return "Q1";
  if (month < 6) return "Q2";
  if (month < 9) return "Q3";
  return "Q4";
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtNum(value: number | string | null | undefined, digits = 2) {
  return Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/[_-]+/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

async function readJson(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export default function IftaV2StaffPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>("overview");
  const [carrierId, setCarrierId] = useState(searchParams.get("carrierId") ?? "");
  const [draftCarrierId, setDraftCarrierId] = useState(searchParams.get("carrierId") ?? "");
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [quarter, setQuarter] = useState(nowQuarter());
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [connections, setConnections] = useState<any[]>([]);
  const [filings, setFilings] = useState<any[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelPurchases, setFuelPurchases] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [latestSnapshotId, setLatestSnapshotId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(searchParams.get("status") === "connected" ? "Motive connected successfully." : null);
  const [error, setError] = useState<string | null>(searchParams.get("error"));

  const query = useMemo(() => {
    const params = new URLSearchParams({ year: String(year), quarter });
    if (carrierId.trim()) params.set("carrierId", carrierId.trim());
    return params.toString();
  }, [carrierId, quarter, year]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const carrierQuery = carrierId.trim() ? `?carrierId=${encodeURIComponent(carrierId.trim())}` : "";
      const connectUrl = `/api/v1/integrations/eld/connect/motive${carrierQuery ? `${carrierQuery}&` : "?"}returnPath=${encodeURIComponent("/dashboard/ifta-v2")}`;
      const [filingsData, connectData, tripsData, fuelData, exceptionsData] = await Promise.all([
        readJson(`/api/v1/features/ifta-v2/filings${carrierQuery}`),
        readJson(connectUrl),
        readJson(`/api/v1/features/ifta-v2/trips?${query}`),
        readJson(`/api/v1/features/ifta-v2/fuel?${query}`),
        readJson(`/api/v1/features/ifta-v2/exceptions?${query}`),
      ]);
      const nextFilings: any[] = Array.isArray(filingsData.filings) ? filingsData.filings : [];
      setFilings(nextFilings);
      setReviewDrafts(Object.fromEntries(nextFilings.map((filing) => [filing.id, String(filing.reviewNotes ?? "")])));
      setConnections(Array.isArray(connectData.connections) ? connectData.connections : []);
      setAuthorizationUrl(connectData.authorizationUrl ?? null);
      setTrips(Array.isArray(tripsData.trips) ? tripsData.trips : []);
      setFuelPurchases(Array.isArray(fuelData.fuelPurchases) ? fuelData.fuelPurchases : []);
      setExceptions(Array.isArray(exceptionsData.exceptions) ? exceptionsData.exceptions : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load IFTA v2.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const overview = useMemo(() => {
    const miles = trips.reduce((sum, item) => sum + Number(item.distance || 0), 0);
    const fuel = fuelPurchases.reduce((sum, item) => sum + Number(item.fuelVolume || 0), 0);
    return {
      filings: filings.length,
      pendingFilings: filings.filter((item) => item.status !== "APPROVED").length,
      trips: trips.length,
      fuelRows: fuelPurchases.length,
      exceptions: exceptions.filter((item) => item.status === "OPEN").length,
      connections: connections.length,
      miles,
      fuel,
    };
  }, [connections, exceptions, filings, fuelPurchases, trips]);

  async function postAction(key: string, url: string, body: Record<string, unknown>, success: string) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const payload = await readJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (typeof payload.snapshot?.id === "string") setLatestSnapshotId(payload.snapshot.id);
      setMessage(success);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function saveReviewNote(filingId: string) {
    setBusy(`note:${filingId}`);
    setError(null);
    setMessage(null);
    try {
      await readJson("/api/v1/features/ifta-v2/filings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: filingId, reviewNotes: reviewDrafts[filingId] ?? "" }) });
      setMessage("Staff note saved.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save staff note.");
    } finally {
      setBusy(null);
    }
  }

  async function resolveException(id: string) {
    setBusy(`resolve:${id}`);
    setError(null);
    setMessage(null);
    try {
      await readJson("/api/v1/features/ifta-v2/exceptions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setMessage("Exception resolved.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resolve exception.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-900 p-8 text-white">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.2em] text-sky-200">Staff Workspace</div>
            <h1 className="mt-3 text-3xl font-semibold">IFTA v2 Operations</h1>
            <p className="mt-3 text-sm leading-6 text-slate-200">Synced ELD trips, fuel reconciliation, exceptions, and filing snapshots. Legacy IFTA remains untouched.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Input value={draftCarrierId} onChange={(event) => setDraftCarrierId(event.target.value)} placeholder="Carrier ID (optional)" className="border-white/10 bg-white/10 text-white placeholder:text-slate-300" />
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-11 rounded-lg border border-white/10 bg-white/10 px-4 text-sm text-white outline-none">
              {[year - 1, year, year + 1].map((item) => <option key={item} value={item} className="text-gray-900">{item}</option>)}
            </select>
            <select value={quarter} onChange={(event) => setQuarter(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-white/10 px-4 text-sm text-white outline-none">
              {["Q1", "Q2", "Q3", "Q4"].map((item) => <option key={item} value={item} className="text-gray-900">{item}</option>)}
            </select>
            <Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setCarrierId(draftCarrierId.trim())}>Apply Scope</Button>
          </div>
        </div>
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === item.key ? "bg-slate-950 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <Card className="p-8 text-sm text-gray-600">Loading synced IFTA v2 workspace...</Card> : null}

      {!loading && tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            {[["Filings", String(overview.filings)], ["Pending", String(overview.pendingFilings)], ["Trips", String(overview.trips)], ["Miles", fmtNum(overview.miles)], ["Fuel", fmtNum(overview.fuel)], ["Open Exceptions", String(overview.exceptions)]].map(([label, value]) => (
              <Card key={label} className="p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</div>
                <div className="mt-3 text-3xl font-semibold text-gray-950">{value}</div>
              </Card>
            ))}
          </div>
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-950">Selected quarter tools</h2>
              <p className="mt-1 text-sm text-gray-600">Run staff actions for the selected carrier scope and quarter, or use the queue below to work filing by filing.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => postAction("sync", "/api/v1/integrations/eld/sync", { carrierId: carrierId || undefined, year, quarter, scopes: ["vehicles", "drivers", "trips", "fuel"] }, "Sync completed.")}>{busy === "sync" ? "Syncing..." : "Manual Sync"}</Button>
              <Button variant="outline" onClick={() => postAction("calculate", "/api/v1/features/ifta-v2/filing/calculate", { carrierId: carrierId || undefined, year, quarter, syncFirst: false }, "Quarter preview recalculated.")}>{busy === "calculate" ? "Calculating..." : "Calculate"}</Button>
              <Button onClick={() => postAction("create", "/api/v1/features/ifta-v2/filing/create", { carrierId: carrierId || undefined, year, quarter }, "IFTA v2 snapshot created.")}>{busy === "create" ? "Creating..." : "Create Snapshot"}</Button>
              <Button variant="outline" disabled={!latestSnapshotId} onClick={() => postAction("approve", "/api/v1/features/ifta-v2/filing/approve", { snapshotId: latestSnapshotId }, "IFTA v2 snapshot approved.")}>{busy === "approve" ? "Approving..." : "Approve"}</Button>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">Client request queue</h2>
                <p className="mt-1 text-sm text-gray-600">Truckers open the filing first. Staff then syncs, reviews exceptions, creates the snapshot, and approves it.</p>
              </div>
              <div className="text-sm text-gray-500">Connections: {overview.connections} | Fuel rows: {overview.fuelRows}</div>
            </div>
            {filings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">No client filing requests match the current carrier scope.</div>
            ) : (
              <div className="mt-5 space-y-4">
                {filings.map((filing) => (
                  <div key={filing.id} className="rounded-3xl border border-gray-200 p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-gray-950">{filing.year} {filing.quarter}</div>
                          <Badge tone={getStatusTone(filing.status)}>{formatStatusLabel(filing.status)}</Badge>
                          {filing.latestSnapshotId ? <Badge tone="info">Snapshot {filing.latestSnapshotId.slice(0, 8)}</Badge> : null}
                        </div>
                        <div className="text-sm text-gray-600">Requested by {filing.requestedBy?.name || filing.requestedBy?.email || "Unknown user"} on {fmtDate(filing.requestedAt)}</div>
                        <div className="text-sm text-gray-600">Sync triggered: {fmtDate(filing.syncTriggeredAt)} | Calculated: {fmtDate(filing.calculatedAt)} | Approved: {fmtDate(filing.approvedAt)}</div>
                        {filing.notes ? <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-gray-700">Client note: {filing.notes}</div> : null}
                        {filing.reviewNotes ? <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800">Staff note: {filing.reviewNotes}</div> : null}
                      </div>
                      <div className="flex flex-wrap gap-2 xl:max-w-[360px] xl:justify-end">
                        <Button size="sm" variant="outline" onClick={() => postAction(`sync:${filing.id}`, "/api/v1/integrations/eld/sync", { carrierId: filing.carrierId, year: filing.year, quarter: filing.quarter, scopes: ["vehicles", "drivers", "trips", "fuel"] }, `Sync completed for ${filing.year} ${filing.quarter}.`)}>{busy === `sync:${filing.id}` ? "Syncing..." : "Sync"}</Button>
                        <Button size="sm" variant="outline" onClick={() => postAction(`calculate:${filing.id}`, "/api/v1/features/ifta-v2/filing/calculate", { filingId: filing.id, syncFirst: false }, `Calculation completed for ${filing.year} ${filing.quarter}.`)}>{busy === `calculate:${filing.id}` ? "Calculating..." : "Calculate"}</Button>
                        <Button size="sm" onClick={() => postAction(`create:${filing.id}`, "/api/v1/features/ifta-v2/filing/create", { filingId: filing.id, syncFirst: false }, `Snapshot created for ${filing.year} ${filing.quarter}.`)}>{busy === `create:${filing.id}` ? "Creating..." : "Create Snapshot"}</Button>
                        <Button size="sm" variant="outline" disabled={!filing.latestSnapshotId} onClick={() => postAction(`approve:${filing.id}`, "/api/v1/features/ifta-v2/filing/approve", { filingId: filing.id, snapshotId: filing.latestSnapshotId }, `Filing approved for ${filing.year} ${filing.quarter}.`)}>{busy === `approve:${filing.id}` ? "Approving..." : "Approve"}</Button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                      <Input value={reviewDrafts[filing.id] ?? ""} onChange={(event) => setReviewDrafts((current) => ({ ...current, [filing.id]: event.target.value }))} placeholder="Staff note visible to the client" />
                      <Button variant="outline" onClick={() => saveReviewNote(filing.id)} disabled={busy === `note:${filing.id}`}>{busy === `note:${filing.id}` ? "Saving..." : "Save Note"}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {!loading && (tab === "trips" || tab === "fuel" || tab === "exceptions") ? (
        <TableWrapper>
          <TableScroller>
            <Table>
              <TableHeader>
                <TableRow>
                  {(tab === "trips"
                    ? ["Date", "Vehicle", "Driver", "Jurisdiction", "Miles", "Odometer", "Source", "Status"]
                    : tab === "fuel"
                      ? ["Date", "Vehicle", "Driver", "Jurisdiction", "Fuel", "Vendor", "Source", "Status"]
                      : ["Type", "Severity", "Trip/Fuel", "Details", "Action"]
                  ).map((label) => <TableHead key={label}>{label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tab === "trips" ? trips.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{fmtDate(row.tripDate)}</TableCell>
                    <TableCell>{row.vehicle?.vehicleNumber || row.vehicle?.vin || "Unknown vehicle"}</TableCell>
                    <TableCell>{row.driver?.name || row.driver?.email || "Unassigned"}</TableCell>
                    <TableCell>{row.jurisdiction}</TableCell>
                    <TableCell>{fmtNum(row.distance)} {row.distanceUnit}</TableCell>
                    <TableCell>{row.startOdometer != null && row.endOdometer != null ? `${fmtNum(row.startOdometer)} -> ${fmtNum(row.endOdometer)}` : "Missing"}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell><Badge tone={getStatusTone(row.status)}>{formatStatusLabel(row.status)}</Badge></TableCell>
                  </TableRow>
                )) : null}
                {tab === "fuel" ? fuelPurchases.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{fmtDate(row.purchasedAt)}</TableCell>
                    <TableCell>{row.vehicle?.vehicleNumber || row.vehicle?.vin || "Unknown vehicle"}</TableCell>
                    <TableCell>{row.driver?.name || row.driver?.email || "Unassigned"}</TableCell>
                    <TableCell>{row.jurisdiction}</TableCell>
                    <TableCell>{fmtNum(row.fuelVolume)} {row.fuelUnit}</TableCell>
                    <TableCell>{row.vendor || "Missing vendor"}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell><Badge tone={getStatusTone(row.status)}>{formatStatusLabel(row.status)}</Badge></TableCell>
                  </TableRow>
                )) : null}
                {tab === "exceptions" ? exceptions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.type}</TableCell>
                    <TableCell><Badge tone={getStatusTone(row.severity)}>{row.severity}</Badge></TableCell>
                    <TableCell>{row.trip ? `${row.trip.externalTripId} (${row.trip.jurisdiction})` : row.fuel ? `${row.fuel.externalFuelId || row.fuel.id} (${row.fuel.jurisdiction})` : "Carrier-level"}</TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal break-words">{String(row.details.reason || "Operational exception")}</TableCell>
                    <TableCell>{row.status === "RESOLVED" ? <Badge tone="success">Resolved</Badge> : <Button size="sm" variant="outline" onClick={() => resolveException(row.id)} disabled={busy === `resolve:${row.id}`}>{busy === `resolve:${row.id}` ? "Resolving..." : "Resolve"}</Button>}</TableCell>
                  </TableRow>
                )) : null}
                {(tab === "trips" && trips.length === 0) || (tab === "fuel" && fuelPurchases.length === 0) || (tab === "exceptions" && exceptions.length === 0) ? <TableRow><TableCell colSpan={tab === "exceptions" ? 5 : 8}>No records found for the selected scope.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </TableScroller>
        </TableWrapper>
      ) : null}

      {!loading && tab === "sync" ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-950">Connection status</h2>
            <div className="mt-4 space-y-3">
              {connections.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-gray-950">{item.provider}</span>
                    <Badge tone={getStatusTone(item.status)}>{formatStatusLabel(item.status)}</Badge>
                    <span>{item.id}</span>
                  </div>
                  <div className="mt-2">Last sync: {fmtDate(item.lastSyncAt)}</div>
                  {item.lastError ? <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-red-700">{item.lastError}</div> : null}
                </div>
              ))}
              {connections.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">No Motive connection is configured for this carrier scope.</div> : null}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-950">Connect Motive</h2>
            <p className="mt-1 text-sm text-gray-600">Use OAuth when available or store tokens manually for rollout and testing.</p>
            {authorizationUrl ? (
              <div className="mt-4">
                <Link href={authorizationUrl} className="inline-flex rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
                  Connect via OAuth
                </Link>
              </div>
            ) : null}
            <div className="mt-5 space-y-3">
              <Input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} placeholder="Access token" />
              <Input value={refreshToken} onChange={(event) => setRefreshToken(event.target.value)} placeholder="Refresh token (optional)" />
              <Button disabled={!accessToken || busy === "tokens"} onClick={() => postAction("tokens", "/api/v1/integrations/eld/connect/motive", { carrierId: carrierId || undefined, accessToken, refreshToken }, "Motive connection saved.")}>{busy === "tokens" ? "Saving..." : "Save Connection"}</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
