"use client";

import { useMemo, useState } from "react";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { IconButton } from "@/components/ui/icon-button";
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
import { IftaTaxRateTableRow } from "@/features/ifta/types/tax-rate";
import {
  formatTaxRateLabel,
  sourceLabel,
} from "@/features/ifta/utils/tax-rate-mappers";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

function formatDate(value: string | null) {
  if (!value) return "Not imported";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IftaTaxRatesTable(props: {
  rows: IftaTaxRateTableRow[];
  onEdit: (row: IftaTaxRateTableRow) => void;
  busy?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  const paginatedRows = useMemo(
    () => paginateItems(props.rows, page, pageSize),
    [props.rows, page, pageSize],
  );

  return (
    <TableWrapper className="rounded-[28px]">
      <TableScroller>
        <Table className="min-w-[1120px]">
          <TableHeader>
            <tr>
              <TableHead>Code</TableHead>
              <TableHead>Jurisdiction</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Fuel Type</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Quarter</TableHead>
              <TableHead>Tax Rate</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Imported At</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </TableHeader>

          <TableBody>
            {paginatedRows.items.map((row) => (
              <TableRow
                key={`${row.jurisdictionId}-${row.fuelType}-${row.year}-${row.quarter}`}
              >
                <TableCell className="font-medium text-gray-800">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.countryCode ?? "-"}</TableCell>
                <TableCell>
                  {row.fuelType === "DI" ? "Diesel" : "Gasoline"}
                </TableCell>
                <TableCell>{row.year}</TableCell>
                <TableCell>{row.quarter}</TableCell>
                <TableCell className="font-medium text-gray-800">
                  {formatTaxRateLabel(row)}
                </TableCell>
                <TableCell>{sourceLabel(row.source)}</TableCell>
                <TableCell>{formatDate(row.importedAt)}</TableCell>
                <TableCell>
                  <IconButton
                    disabled={props.busy}
                    onClick={() => props.onEdit(row)}
                    label="Edit tax rate"
                    icon="edit"
                  />
                </TableCell>
              </TableRow>
            ))}

            {props.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  No tax rates found for the selected filters.
                </td>
              </tr>
            ) : null}
          </TableBody>
        </Table>
      </TableScroller>

      <ClientPaginationControls
        page={paginatedRows.currentPage}
        totalPages={paginatedRows.totalPages}
        pageSize={paginatedRows.pageSize}
        totalItems={paginatedRows.totalItems}
        itemLabel="tax rates"
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
  );
}
