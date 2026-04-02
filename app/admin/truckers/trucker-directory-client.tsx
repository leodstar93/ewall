"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InlineAlert,
  PanelCard,
  StatusBadge,
  textInputClassName,
} from "@/app/(dashboard)/settings/components/settings-ui";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

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

function StatusChips({ item }: { item: TruckerDirectoryItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      {item.needsReview ? (
        <StatusBadge tone="amber">Needs review</StatusBadge>
      ) : null}
      {item.missingPersonal ? (
        <StatusBadge tone="zinc">Missing personal</StatusBadge>
      ) : null}
      {item.missingCompany ? (
        <StatusBadge tone="zinc">Missing company</StatusBadge>
      ) : null}
      {item.ready ? <StatusBadge tone="green">Ready</StatusBadge> : null}
    </div>
  );
}

export default function TruckerDirectoryClient() {
  const [items, setItems] = useState<TruckerDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TruckerDirectoryFilter>("all");
  const [sort, setSort] = useState<TruckerDirectorySort>("recent");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const deferredSearch = useDeferredValue(search);
  const paginated = useMemo(
    () => paginateItems(items, page, pageSize),
    [items, page, pageSize],
  );

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

  return (
    <div className="space-y-6">
      <PanelCard
        eyebrow="Client support"
        title="Trucker clients"
        description="Search trucker customers, filter incomplete profiles, and jump into a profile when a client calls asking for help."
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl text-sm leading-6 text-zinc-600">
            This workspace is limited to users with the <span className="font-semibold text-zinc-900">TRUCKER</span>{" "}
            role and gives staff/admin a faster way to review profile completeness before updating information on a
            customer&apos;s behalf.
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Back to dashboard
          </Link>
        </div>
      </PanelCard>

      <PanelCard
        title="Find a client"
        description="Search by name, email, phone, company, USDOT, or MC number and then narrow the results with profile filters."
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Search
            </span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name, email, USDOT, MC, company..."
              className={textInputClassName()}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Filter
            </span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as TruckerDirectoryFilter);
                setPage(1);
              }}
              className={textInputClassName()}
            >
              <option value="all">All profiles</option>
              <option value="missing-personal">Missing personal info</option>
              <option value="missing-company">Missing company info</option>
              <option value="needs-review">Needs review</option>
              <option value="ready">Ready profiles</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Sort
            </span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as TruckerDirectorySort);
                setPage(1);
              }}
              className={textInputClassName()}
            >
              <option value="recent">Recently updated</option>
              <option value="name">Client name</option>
              <option value="company">Company name</option>
            </select>
          </label>
        </div>

        {error ? (
          <div className="mt-6">
            <InlineAlert tone="error" message={error} />
          </div>
        ) : null}
      </PanelCard>

      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-white px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Client directory
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {items.length} matching trucker client{items.length === 1 ? "" : "s"} in the current view.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-[24px] border border-zinc-200 bg-zinc-50"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No trucker clients found"
            description="Try a different search term or switch the filter to All profiles to broaden the results."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Profile
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Updated
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {paginated.items.map((item) => {
                  const letter = (item.name[0] || item.email[0] || "T").toUpperCase();

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/70 transition-colors"
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
                            {letter}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 truncate">
                              {item.name || "No name"}
                            </div>
                            <div className="mt-1 text-sm text-zinc-600 truncate">
                              {item.email || "No email on file"}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                              {item.phone || "No phone on file"}
                              {item.state ? ` · ${item.state}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-zinc-900">
                            {item.companyName || "No company name"}
                          </div>
                          <div className="text-sm text-zinc-600">
                            USDOT: {item.dotNumber || "Not set"}
                          </div>
                          <div className="text-sm text-zinc-600">
                            MC: {item.mcNumber || "Not set"}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-3">
                          <StatusChips item={item} />
                          <div className="text-sm text-zinc-600">
                            {item.trucksCount} truck(s) · {item.filingCount} filing(s)
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top text-sm text-zinc-700">
                        <div>{formatDate(item.updatedAt)}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Joined {formatDate(item.createdAt)}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/truckers/${item.id}`}
                            className="inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
                          >
                            Open profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

            <ClientPaginationControls
              page={paginated.currentPage}
              totalPages={paginated.totalPages}
              pageSize={paginated.pageSize}
              totalItems={paginated.totalItems}
              itemLabel="clients"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPage(1);
                setPageSize(
                  DEFAULT_PAGE_SIZE_OPTIONS.includes(
                    nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                  )
                    ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                    : 10,
                );
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
