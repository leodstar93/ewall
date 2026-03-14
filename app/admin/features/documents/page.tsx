import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthz } from "@/lib/rbac";

type DocumentRow = {
  id: string;
  name: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

type UserDocumentsGroup = {
  user: DocumentRow["user"];
  documents: DocumentRow[];
  totalBytes: number;
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const precision = unit === 0 ? 0 : 2;
  return `${value.toFixed(precision)} ${units[unit]}`;
}

function formatDate(value: Date) {
  return value.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userLabel(user: DocumentRow["user"]) {
  return user.name?.trim() || user.email?.trim() || `User ${user.id.slice(0, 8)}`;
}

function userSubLabel(user: DocumentRow["user"]) {
  if (user.name && user.email) return user.email;
  if (user.email) return user.email;
  return `ID: ${user.id}`;
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildDocumentsHref(params: {
  search?: string;
  fileType?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.fileType?.trim()) query.set("fileType", params.fileType.trim());
  if (params.page && params.page > 1) query.set("page", String(params.page));
  if (params.pageSize && params.pageSize !== 10) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString();
  return suffix ? `/admin/features/documents?${suffix}` : "/admin/features/documents";
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, roles } = await getAuthz();
  if (!session) redirect("/login");

  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  if (!isAdmin && !isStaff) redirect("/forbidden");

  const backHref = isAdmin ? "/admin" : "/panel";
  const backLabel = isAdmin ? "Back to admin" : "Back to panel";
  const resolvedSearchParams = (await searchParams) ?? {};
  const searchValue = getSingleParam(resolvedSearchParams.search);
  const fileTypeValue = getSingleParam(resolvedSearchParams.fileType);
  const pageValue = getSingleParam(resolvedSearchParams.page);
  const pageSizeValue = getSingleParam(resolvedSearchParams.pageSize);
  const search = searchValue.trim();
  const requestedPageSize = parsePositiveInt(pageSizeValue, 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : 10;

  const where: Prisma.DocumentWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { fileName: { contains: search, mode: "insensitive" } },
      { fileType: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (fileTypeValue) {
    where.fileType = fileTypeValue;
  }

  const [documents, fileTypes] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }) as Promise<DocumentRow[]>,
    prisma.document.findMany({
      select: {
        fileType: true,
      },
      distinct: ["fileType"],
      orderBy: { fileType: "asc" },
    }),
  ]);

  const groupedMap = new Map<string, UserDocumentsGroup>();

  for (const doc of documents) {
    const current = groupedMap.get(doc.user.id);
    if (!current) {
      groupedMap.set(doc.user.id, {
        user: doc.user,
        documents: [doc],
        totalBytes: doc.fileSize || 0,
      });
      continue;
    }

    current.documents.push(doc);
    current.totalBytes += doc.fileSize || 0;
  }

  const grouped = Array.from(groupedMap.values()).sort((a, b) => {
    if (b.documents.length !== a.documents.length) {
      return b.documents.length - a.documents.length;
    }
    return userLabel(a.user).localeCompare(userLabel(b.user));
  });

  const totalGroups = grouped.length;
  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize));
  const requestedPage = parsePositiveInt(pageValue, 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedGroups = grouped.slice(pageStart, pageEnd);

  const totalBytes = documents.reduce((acc, doc) => acc + (doc.fileSize || 0), 0);
  const availableFileTypes = fileTypes
    .map((row) => row.fileType)
    .filter((value): value is string => Boolean(value));

  return (
    <div className="flex-1 overflow-auto bg-zinc-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-sm font-semibold">D</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    User documents
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    Review uploaded files grouped by each user.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
            >
              {backLabel}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total documents
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {documents.length}
              </p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Users with uploads
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{totalGroups}</p>
            </div>

            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Storage used
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {formatFileSize(totalBytes)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr),220px,140px,auto]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Search
              </span>
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="User, email, document, file name..."
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                File type
              </span>
              <select
                name="fileType"
                defaultValue={fileTypeValue}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                <option value="">All file types</option>
                {availableFileTypes.map((fileType) => (
                  <option key={fileType} value={fileType}>
                    {fileType}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Page size
              </span>
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} groups
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-3">
              <input type="hidden" name="page" value="1" />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Apply filters
              </button>
              <Link
                href="/admin/features/documents"
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Clear
              </Link>
            </div>
          </form>
        </section>

        {totalGroups === 0 ? (
          <section className="rounded-2xl border bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">No documents yet</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {search || fileTypeValue
                ? "No documents match the current filters."
                : "Uploaded files will appear here once users start using the documents module."}
            </p>
          </section>
        ) : (
          pagedGroups.map((group) => (
            <section key={group.user.id} className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">
                    {userLabel(group.user)}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">{userSubLabel(group.user)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {group.documents.length} files
                  </span>
                  <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {formatFileSize(group.totalBytes)}
                  </span>
                  {isAdmin && (
                    <Link
                      href={`/admin/users/${group.user.id}`}
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Open user
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Document
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          File
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Size
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Uploaded
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {group.documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-zinc-900">{doc.name}</p>
                            <p className="mt-1 text-sm text-zinc-600">{doc.description || "-"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-zinc-700">{doc.fileName}</span>
                              <span className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                                {doc.fileType || "file"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-700">
                            {formatFileSize(doc.fileSize)}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-700">
                            {formatDate(doc.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <a
                                href={`/api/v1/features/documents/${doc.id}/view`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                              >
                                View
                              </a>
                              <a
                                href={`/api/v1/features/documents/${doc.id}/download`}
                                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                              >
                                Download
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))
        )}

        {totalGroups > 0 && (
          <section className="rounded-2xl border bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600">
                Showing{" "}
                <span className="font-semibold text-zinc-900">{pageStart + 1}</span>
                {" "}-{" "}
                <span className="font-semibold text-zinc-900">
                  {Math.min(pageEnd, totalGroups)}
                </span>
                {" "}of <span className="font-semibold text-zinc-900">{totalGroups}</span> groups
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-zinc-600">
                  Page <span className="font-semibold text-zinc-900">{currentPage}</span> of{" "}
                  <span className="font-semibold text-zinc-900">{totalPages}</span>
                </span>
                <Link
                  href={buildDocumentsHref({
                    search,
                    fileType: fileTypeValue,
                    page: 1,
                    pageSize,
                  })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    currentPage === 1
                      ? "pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-400"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  First
                </Link>
                <Link
                  href={buildDocumentsHref({
                    search,
                    fileType: fileTypeValue,
                    page: Math.max(1, currentPage - 1),
                    pageSize,
                  })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    currentPage === 1
                      ? "pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-400"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  Previous
                </Link>
                <Link
                  href={buildDocumentsHref({
                    search,
                    fileType: fileTypeValue,
                    page: Math.min(totalPages, currentPage + 1),
                    pageSize,
                  })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    currentPage === totalPages
                      ? "pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-400"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  Next
                </Link>
                <Link
                  href={buildDocumentsHref({
                    search,
                    fileType: fileTypeValue,
                    page: totalPages,
                    pageSize,
                  })}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                    currentPage === totalPages
                      ? "pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-400"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  Last
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
