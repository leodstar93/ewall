"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroller,
  TableWrapper,
} from "@/components/ui/table";
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
      <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
        No roles found.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <TableWrapper>
        <TableScroller>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Permissions</TableHead>
              </tr>
            </TableHeader>

            <TableBody>
              {paginatedRoles.items.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="text-gray-800">
                    <span className="font-medium">{role.name}</span>
                    {role.name === "ADMIN" ? (
                      <Badge className="ml-2" tone="primary">
                        System
                      </Badge>
                    ) : null}
                  </TableCell>

                  <TableCell>{role.description || "-"}</TableCell>

                  <TableCell>
                    <Badge tone="info">{role._count.users}</Badge>
                  </TableCell>

                  <TableCell>
                    <Badge tone="success">{role._count.permissions}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroller>

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
      </TableWrapper>
    </div>
  );
}
