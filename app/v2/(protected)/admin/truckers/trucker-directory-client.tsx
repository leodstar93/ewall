"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type TruckerDirectoryFilter =
  | "all"
  | "missing-personal"
  | "missing-company"
  | "needs-review"
  | "ready";

type TruckerDirectorySort = "recent" | "name" | "company";

type TruckerDirectoryItem = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  companyName: string;
  dotNumber: string;
  mcNumber: string;
  phone: string;
  state: string;
  trucksCount: number;
  filingCount: number;
  missingPersonal: boolean;
  missingCompany: boolean;
  needsReview: boolean;
  ready: boolean;
  roles: string[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TruckerDirectoryClient() {
  const [items, setItems] = useState<TruckerDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TruckerDirectoryFilter>("all");
  const [sort, setSort] = useState<TruckerDirectorySort>("recent");

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
        if (filter !== "all") params.set("filter", filter);
        if (sort !== "recent") params.set("sort", sort);

        const response = await fetch(`/api/v1/admin/truckers?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          items?: TruckerDirectoryItem[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load trucker clients.");
        }

        if (!active) return;
        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load trucker clients.",
        );
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => {
      if (active) setError("Failed to load trucker clients.");
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [deferredSearch, filter, sort]);

  // ─── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<TruckerDirectoryItem>[]>(
    () => [
      {
        key: "name",
        label: "Client",
        render: (_, item) => {
          const letter = (item.name[0] || item.email[0] || "T").toUpperCase();
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "var(--b)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {letter}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className={tableStyles.nameCell}>{item.name || "No name"}</div>
                <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
                  {item.email || "No email on file"}
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {item.phone || "No phone"}{item.state ? ` · ${item.state}` : ""}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "companyName",
        label: "Company",
        render: (_, item) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className={tableStyles.nameCell}>
              {item.companyName || "No company name"}
            </div>
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              USDOT: {item.dotNumber || "Not set"}
            </div>
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              MC: {item.mcNumber || "Not set"}
            </div>
          </div>
        ),
      },
      /*{
        key: "_profile",
        label: "Profile",
        sortable: false,
        render: (_, item) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {item.needsReview && <Badge tone="warning" variant="light">Needs review</Badge>}
              {item.missingPersonal && <Badge tone="default" variant="light">Missing personal</Badge>}
              {item.missingCompany && <Badge tone="default" variant="light">Missing company</Badge>}
              {item.ready && <Badge tone="success" variant="light">Ready</Badge>}
            </div>
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              {item.trucksCount} truck(s) · {item.filingCount} filing(s)
            </div>
          </div>
        ),
      },*/
      {
        key: "updatedAt",
        label: "Updated",
        render: (_, item) => (
          <div>
            <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>
              {formatDate(item.updatedAt)}
            </div>
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              Joined {formatDate(item.createdAt)}
            </div>
          </div>
        ),
      },
      {
        key: "_actions",
        label: "Actions",
        sortable: false,
        render: (_, item) => (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link
              href={`/v2/admin/truckers/${item.id}`}
              aria-label="Open profile"
              title="Open profile"
              className={iconButtonClasses({ variant: "default" })}
            >
              <ActionIcon name="view" />
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Filters */}
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.title}>Trucker clients</div>
            <div className={tableStyles.subtitle}>
              Search by name, email, phone, company, USDOT, or MC number.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "0 20px 20px",
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0,1.8fr) minmax(180px,0.8fr) minmax(180px,0.8fr)",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className={tableStyles.subtitle} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
              Search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, USDOT, MC, company..."
              style={{
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: "100%",
                color: "var(--b)",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className={tableStyles.subtitle} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
              Filter
            </span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TruckerDirectoryFilter)}
              style={{
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: "100%",
                background: "#fff",
                color: "var(--b)",
              }}
            >
              <option value="all">All profiles</option>
              <option value="missing-personal">Missing personal info</option>
              <option value="missing-company">Missing company info</option>
              <option value="needs-review">Needs review</option>
              <option value="ready">Ready profiles</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className={tableStyles.subtitle} style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
              Sort
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as TruckerDirectorySort)}
              style={{
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: "100%",
                background: "#fff",
                color: "var(--b)",
              }}
            >
              <option value="recent">Recently updated</option>
              <option value="name">Client name</option>
              <option value="company">Company name</option>
            </select>
          </label>
        </div>

        {error && (
          <div style={{ padding: "0 20px 16px" }}>
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
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className={tableStyles.card} style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
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
          data={items}
          columns={columns}
          title="Client directory"
        />
      )}
    </div>
  );
}
