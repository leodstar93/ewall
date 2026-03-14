export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
) {
  const safePageSize = Math.max(1, Math.trunc(pageSize || 1));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.trunc(page || 1)), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(totalItems, startIndex + safePageSize);

  return {
    items: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage,
    pageSize: safePageSize,
    startIndex,
    endIndex,
  };
}
