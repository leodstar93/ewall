"use client";

import { DEFAULT_PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export default function ClientPaginationControls(props: {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: readonly number[];
}) {
  const pageSizeOptions = props.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = Math.max(1, props.totalPages);
  const startItem =
    props.totalItems === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const endItem = Math.min(props.totalItems, props.page * props.pageSize);

  const pagesAroundCurrent = Array.from(
    { length: Math.min(3, totalPages) },
    (_, index) => index + Math.max(props.page - 1, 1),
  ).filter((pageNumber) => pageNumber <= totalPages);

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-theme-sm text-gray-500">
        Showing <span className="font-semibold text-gray-800">{startItem}</span>
        {" - "}
        <span className="font-semibold text-gray-800">{endItem}</span> of{" "}
        <span className="font-semibold text-gray-800">{props.totalItems}</span>{" "}
        {props.itemLabel ?? "items"}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-theme-sm text-gray-500">
          <span>Rows</span>
          <select
            value={props.pageSize}
            onChange={(event) =>
              props.onPageSizeChange(Number(event.target.value))
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-700 outline-none shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
            disabled={props.page === 1}
            className="flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            {props.page > 3 ? <span className="px-1 text-sm text-gray-400">...</span> : null}
            {pagesAroundCurrent.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => props.onPageChange(pageNumber)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition ${
                  props.page === pageNumber
                    ? "bg-brand-500 text-white"
                    : "text-gray-700 hover:bg-brand-50 hover:text-brand-500"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            {props.page < totalPages - 2 ? (
              <span className="px-1 text-sm text-gray-400">...</span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() =>
              props.onPageChange(Math.min(totalPages, props.page + 1))
            }
            disabled={props.page === totalPages}
            className="flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
