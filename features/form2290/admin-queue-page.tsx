"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Table, { type ColumnDef } from "@/app/(v2)/(protected)/admin/components/ui/Table";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { getStatusTone } from "@/lib/ui/status-utils";
import {
  Form2290Filing,
  formatDate,
  paymentStatusLabel,
  statusLabel,
} from "@/features/form2290/shared";

type FilingsPayload = {
  filings?: Form2290Filing[];
  error?: string;
};

type ClaimPayload = {
  filing?: Form2290Filing;
  error?: string;
};

type Form2290AdminQueuePageProps = {
  apiPath?: string;
  detailHrefBase?: string;
  showCreateButton?: boolean;
};

export default function Form2290AdminQueuePage(props: Form2290AdminQueuePageProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const currentUserEmail = session?.user?.email?.trim() || null;
  const currentUserLabel = session?.user?.name?.trim() || session?.user?.email?.trim() || "You";

  const apiPath = props.apiPath ?? "/api/v1/features/2290";
  const detailHrefBase = props.detailHrefBase ?? "/admin/features/2290";
  const newHref = "/dashboard/2290/new";
  const showCreateButton = props.showCreateButton ?? true;

  const [filings, setFilings] = useState<Form2290Filing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyFilingId, setBusyFilingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (statusFilter !== "all") query.set("status", statusFilter);

      const filingsResponse = await fetch(`${apiPath}?${query.toString()}`, {
        cache: "no-store",
      });

      const filingsData = (await filingsResponse.json().catch(() => ({}))) as FilingsPayload;

      if (!filingsResponse.ok) {
        throw new Error(filingsData.error || "Could not load Form 2290 queue.");
      }

      setFilings(Array.isArray(filingsData.filings) ? filingsData.filings : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the review queue.");
    } finally {
      setLoading(false);
    }
  }, [apiPath, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claimFiling(filingId: string) {
    try {
      setBusyFilingId(filingId);
      setError(null);
      const response = await fetch(`/api/v1/admin/2290/${filingId}/claim`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as ClaimPayload;
      if (!response.ok || !data.filing) {
        throw new Error(data.error || "Could not assign Form 2290 filing.");
      }

      setFilings((current) =>
        current.map((filing) => (filing.id === filingId ? data.filing ?? filing : filing)),
      );
      await load();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "Could not assign Form 2290 filing.");
    } finally {
      setBusyFilingId(null);
    }
  }

  if (loading) {
    return (
      <div className={tableStyles.card} style={{ padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              style={{
                height: 64,
                borderRadius: 12,
                border: "1px solid var(--brl)",
                background: "var(--off)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const fieldStyle: CSSProperties = {
    border: "1px solid var(--br)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    color: "var(--b)",
  };

  const columns: ColumnDef<Form2290Filing>[] = [
    {
      key: "organizationId",
      label: "Company",
      render: (_value, filing) => (
        <div>
          <p style={{ fontWeight: 600, color: "var(--b)" }}>
            {filing.organization?.legalName ||
              filing.organization?.companyName ||
              filing.organization?.dbaName ||
              filing.organization?.name ||
              "Unknown company"}
          </p>
          <p style={{ marginTop: 2, color: "#777" }}>
            DOT {filing.organization?.dotNumber || "-"}
          </p>
        </div>
      ),
    },
    {
      key: "unitNumberSnapshot",
      label: "Unit",
      render: (_value, filing) => (
        <div>
          <p style={{ fontWeight: 600, color: "var(--b)" }}>
            {filing.unitNumberSnapshot || filing.truck.unitNumber}
          </p>
          <p style={{ marginTop: 2, color: "#777" }}>{filing.vinSnapshot}</p>
        </div>
      ),
    },
    { key: "taxPeriodId", label: "Period", render: (_value, filing) => filing.taxPeriod.name },
    {
      key: "status",
      label: "Status",
      render: (_value, filing) => <Badge tone={getStatusTone(statusLabel(filing.status))}>{statusLabel(filing.status)}</Badge>,
    },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (_value, filing) => <Badge tone={getStatusTone(paymentStatusLabel(filing.paymentStatus))}>{paymentStatusLabel(filing.paymentStatus)}</Badge>,
    },
    { key: "updatedAt", label: "Updated", render: (_value, filing) => formatDate(filing.updatedAt) },
    {
      key: "claimedByUserId",
      label: "Assigned",
      render: (_value, filing) => {
        const isMe =
          (Boolean(currentUserId) && filing.claimedByUserId === currentUserId) ||
          (Boolean(currentUserEmail) && filing.claimedBy?.email === currentUserEmail);
        const name = filing.claimedBy?.name || filing.claimedBy?.email;
        return (
          <Badge tone={!filing.claimedByUserId ? "light" : isMe ? "success" : "info"} variant="light">
            {!filing.claimedByUserId ? "Unassigned" : isMe ? `Assigned to ${currentUserLabel}` : `${name ?? "Staff"}`}
          </Badge>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      sortable: false,
      render: (_value, filing) => {
        const isAssignedToMe =
          (Boolean(currentUserId) && filing.claimedByUserId === currentUserId) ||
          (Boolean(currentUserEmail) && filing.claimedBy?.email === currentUserEmail);
        return (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => void claimFiling(filing.id)}
              disabled={busyFilingId === filing.id || isAssignedToMe}
              aria-label={isAssignedToMe ? "Assigned to you" : "Assign to me"}
              title={isAssignedToMe ? "Assigned to you" : "Assign to me"}
              className={iconButtonClasses({
                variant: "default",
                className: busyFilingId === filing.id || isAssignedToMe ? "opacity-60" : undefined,
              })}
            >
              {busyFilingId === filing.id ? (
                <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
              ) : (
                <ActionIcon name="roles" />
              )}
            </button>
            <Link
              href={`${detailHrefBase}/${filing.id}`}
              aria-label="Review filing"
              title="Review filing"
              className={iconButtonClasses({ variant: "dark" })}
            >
              <ActionIcon name="view" />
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <Table
        data={filings}
        columns={columns}
        title="Form 2290 queue"
        searchQuery={search}
        searchKeys={["vinSnapshot", "unitNumberSnapshot"]}
        actions={[
          { label: "Refresh", onClick: () => void load() },
          ...(showCreateButton
            ? [{ label: "New filing", onClick: () => router.push(newHref), variant: "primary" as const }]
            : []),
        ]}
        toolbar={
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={tableStyles.subtitle} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
                Search
              </span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Customer, unit, VIN..." style={fieldStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={tableStyles.subtitle} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
                Status
              </span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={fieldStyle}>
                <option value="all">All statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_PROCESS">In process</option>
                <option value="FINALIZED">Finalized</option>
              </select>
            </label>
          </div>
        }
      />
    </div>
  );
}
