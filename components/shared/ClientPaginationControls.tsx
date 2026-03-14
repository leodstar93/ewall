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
  const startItem =
    props.totalItems === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const endItem = Math.min(props.totalItems, props.page * props.pageSize);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-zinc-600">
        Showing <span className="font-semibold text-zinc-900">{startItem}</span>
        {" - "}
        <span className="font-semibold text-zinc-900">{endItem}</span> of{" "}
        <span className="font-semibold text-zinc-900">{props.totalItems}</span>{" "}
        {props.itemLabel ?? "items"}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <span>Rows</span>
          <select
            value={props.pageSize}
            onChange={(event) =>
              props.onPageSizeChange(Number(event.target.value))
            }
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">
            Page <span className="font-semibold text-zinc-900">{props.page}</span>{" "}
            of <span className="font-semibold text-zinc-900">{props.totalPages}</span>
          </span>
          <button
            type="button"
            onClick={() => props.onPageChange(1)}
            disabled={props.page === 1}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            First
          </button>
          <button
            type="button"
            onClick={() => props.onPageChange(Math.max(1, props.page - 1))}
            disabled={props.page === 1}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() =>
              props.onPageChange(Math.min(props.totalPages, props.page + 1))
            }
            disabled={props.page === props.totalPages}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => props.onPageChange(props.totalPages)}
            disabled={props.page === props.totalPages}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
