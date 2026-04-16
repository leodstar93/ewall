"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";
import {
  currentQuarterInput,
  filingStatusLabel,
  filingPeriodLabel,
  filingTone,
  formatDateTime,
  formatGallons,
  formatMoney,
  formatNumber,
  iftaVisibleStatusLabel,
  iftaVisibleStatusOrder,
  type IftaVisibleStatus,
  providerLabel,
  visibleStatusForIftaFiling,
  type EldProviderCode,
  type FilingListItem,
} from "@/features/ifta-v2/shared";

type IftaTableRow = FilingListItem & {
  searchableText: string;
  sortPeriod: number;
  sortUpdatedAt: number;
  sortNetTax: number;
};

const panelStyle: CSSProperties = {
  border: "1px solid var(--brl)",
  borderRadius: "var(--radius-lg)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--b) 7%, white), color-mix(in srgb, var(--r) 10%, white))",
  padding: 20,
};

const fieldStyle: CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--b)",
};

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function buildRows(items: FilingListItem[]): IftaTableRow[] {
  return items.map((item) => ({
    ...item,
    searchableText: [
      filingPeriodLabel(item),
      item.status,
      item.integrationAccount?.provider ?? "",
      item.year,
      `Q${item.quarter}`,
    ]
      .join(" ")
      .toLowerCase(),
    sortPeriod: -(item.year * 10 + item.quarter),
    sortUpdatedAt: -new Date(item.updatedAt || item.lastCalculatedAt || 0).getTime(),
    sortNetTax: toNumber(item.totalNetTax),
  }));
}

function parseDownloadFilename(header: string | null, fallback: string) {
  if (!header) return fallback;

  const filenameMatch = /filename="([^"]+)"/i.exec(header);
  return filenameMatch?.[1] || fallback;
}

export default function IftaV2DashboardClient() {
  const router = useRouter();
  const currentQuarter = currentQuarterInput();

  const [filings, setFilings] = useState<FilingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [createYear, setCreateYear] = useState(String(currentQuarter.year));
  const [createQuarter, setCreateQuarter] = useState(String(currentQuarter.quarter));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | IftaVisibleStatus>("");
  const [providerFilter, setProviderFilter] = useState<"" | EldProviderCode>("");
  const deferredSearch = useDeferredValue(search);

  async function loadFilings() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/v1/features/ifta-v2/filings", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        filings?: FilingListItem[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load your IFTA filings.");
      }

      setFilings(Array.isArray(payload.filings) ? payload.filings : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your IFTA filings.",
      );
      setFilings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFilings();
  }, []);

  async function createFiling() {
    try {
      setCreating(true);
      setError("");

      const response = await fetch("/api/v1/features/ifta-v2/filings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: Number(createYear),
          quarter: Number(createQuarter),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        filing?: FilingListItem;
        error?: string;
      };

      if (!response.ok || !payload.filing) {
        throw new Error(payload.error || "Could not create this IFTA filing.");
      }

      router.push(`/v2/dashboard/ifta-v2/${payload.filing.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create this IFTA filing.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function downloadApprovedReport(filing: FilingListItem) {
    try {
      setDownloadingId(filing.id);
      setError("");

      const response = await fetch(
        `/api/v1/features/ifta-v2/filings/${filing.id}/download?format=pdf`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not download this IFTA report.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = parseDownloadFilename(
        response.headers.get("Content-Disposition"),
        `ifta-approved-${filing.year}-q${filing.quarter}.pdf`,
      );
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "Could not download this report.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  const availableStatuses = iftaVisibleStatusOrder.filter((status) =>
    filings.some((item) => visibleStatusForIftaFiling(item.status) === status),
  );
  const availableProviders = Array.from(
    new Set(
      filings
        .map((item) => item.integrationAccount?.provider)
        .filter((value): value is EldProviderCode => Boolean(value)),
    ),
  ).sort();

  const filteredRows = buildRows(filings).filter((item) => {
    const query = deferredSearch.trim().toLowerCase();

    if (query && !item.searchableText.includes(query)) {
      return false;
    }

    if (statusFilter && visibleStatusForIftaFiling(item.status) !== statusFilter) {
      return false;
    }

    if (providerFilter && item.integrationAccount?.provider !== providerFilter) {
      return false;
    }

    return true;
  });

  const columns: ColumnDef<IftaTableRow>[] = [
    {
      key: "sortPeriod",
      label: "Period",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={providerLabel(item.integrationAccount?.provider)}
        >
          {filingPeriodLabel(item)}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_, item) => (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
          title={`Distance lines: ${item._count?.distanceLines ?? 0}`}
        >
          <Badge tone={filingTone(item.status)} variant="light">
            {filingStatusLabel(item.status)}
          </Badge>
          <Badge tone="light" variant="light">
            {item._count?.exceptions ?? 0} exception(s)
          </Badge>
        </div>
      ),
    },
    {
      key: "totalDistance",
      label: "Totals",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            `${formatGallons(item.totalFuelGallons)} gal`,
            `MPG ${formatNumber(item.fleetMpg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ].join(" · ")}
        >
          {formatNumber(item.totalDistance)} mi
        </div>
      ),
    },
    {
      key: "sortNetTax",
      label: "Net tax",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            `Due ${formatMoney(item.totalTaxDue)}`,
            `Credit ${formatMoney(item.totalTaxCredit)}`,
          ].join(" · ")}
        >
          {formatMoney(item.totalNetTax)}
        </div>
      ),
    },
    {
      key: "sortUpdatedAt",
      label: "Updated",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          style={{ fontSize: 13 }}
          title={`Last sync ${formatDateTime(item.lastSyncedAt)}`}
        >
          {formatDateTime(item.updatedAt || item.lastCalculatedAt)}
        </div>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, item) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {item.status === "APPROVED" ? (
            <button
              type="button"
              onClick={() => void downloadApprovedReport(item)}
              disabled={downloadingId === item.id}
              style={{
                border: "1px solid var(--br)",
                background: "#fff",
                color: "var(--b)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {downloadingId === item.id ? "Downloading..." : "Download"}
            </button>
          ) : null}

          <Link
            href={`/v2/dashboard/ifta-v2/${item.id}`}
            style={{
              border: "1px solid var(--b)",
              background: "var(--b)",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Open
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      <section style={panelStyle}>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--r)",
                fontWeight: 700,
              }}
            >
              Trucker workspace
            </span>
            <h1 style={{ margin: 0, fontSize: 24, color: "var(--b)" }}>IFTA v2</h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
              Create quarterly filings, review imported mileage and gallons, then open the filing
              when you are ready to continue.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={tableStyles.subtitle} style={{ fontSize: 11 }}>
                Year
              </span>
              <input
                value={createYear}
                onChange={(event) => setCreateYear(event.target.value)}
                inputMode="numeric"
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={tableStyles.subtitle} style={{ fontSize: 11 }}>
                Quarter
              </span>
              <select
                value={createQuarter}
                onChange={(event) => setCreateQuarter(event.target.value)}
                style={fieldStyle}
              >
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => void createFiling()}
                disabled={creating}
                style={{
                  border: "1px solid var(--b)",
                  background: "var(--b)",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {creating ? "Opening..." : "New filing"}
              </button>
              <Link
                href="/settings?tab=integrations"
                style={{
                  border: "1px solid var(--br)",
                  background: "#fff",
                  color: "var(--b)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Integrations
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            padding: "10px 14px",
            fontSize: 13,
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className={tableStyles.card} style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: 64,
                  borderRadius: 12,
                  border: "1px solid var(--brl)",
                  background: "var(--off)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <Table
          data={filteredRows}
          columns={columns}
          title="My IFTA filings"
          actions={[
            {
              label: "Refresh",
              onClick: () => void loadFilings(),
            },
          ]}
          toolbar={
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Quarter, status, provider..."
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Status
                </span>
                <select
                value={statusFilter}
                onChange={(event) =>
                    setStatusFilter(event.target.value as "" | IftaVisibleStatus)
                }
                  style={fieldStyle}
                >
                <option value="">All statuses</option>
                {availableStatuses.map((item) => (
                  <option key={item} value={item}>
                    {iftaVisibleStatusLabel(item)}
                  </option>
                ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Provider
                </span>
                <select
                  value={providerFilter}
                  onChange={(event) => setProviderFilter(event.target.value as "" | EldProviderCode)}
                  style={fieldStyle}
                >
                  <option value="">All providers</option>
                  {availableProviders.map((item) => (
                    <option key={item} value={item}>
                      {providerLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        />
      )}
    </div>
  );
}
