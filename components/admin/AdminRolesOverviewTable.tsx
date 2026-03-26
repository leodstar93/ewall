"use client";

import { useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

type RoleOverview = {
  id: string;
  name: string;
  description: string | null;
  _count: {
    users: number;
    permissions: number;
  };
};

export default function AdminRolesOverviewTable(props: {
  roles: RoleOverview[];
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const paginatedRoles = useMemo(
    () => paginateItems(props.roles, page, pageSize),
    [props.roles, page, pageSize],
  );

  if (props.roles.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border bg-zinc-50 p-6 text-sm text-zinc-600">
        No roles found.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Role
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Description
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Users
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Permissions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {paginatedRoles.items.map((role) => (
              <tr key={role.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-zinc-900">
                    {role.name}
                  </span>
                  {role.name === "ADMIN" && (
                    <span className="ml-2 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white">
                      System
                    </span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm text-zinc-600">
                  {role.description || "—"}
                </td>

                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                    {role._count.users}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                    {role._count.permissions}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClientPaginationControls
        page={paginatedRoles.currentPage}
        totalPages={paginatedRoles.totalPages}
        pageSize={paginatedRoles.pageSize}
        totalItems={paginatedRoles.totalItems}
        itemLabel="roles"
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
    </div>
  );
}
