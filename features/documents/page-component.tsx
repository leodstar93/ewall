"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ClientPaginationControls from "@/components/shared/ClientPaginationControls";
import { DEFAULT_PAGE_SIZE_OPTIONS, paginateItems } from "@/lib/pagination";

interface Document {
  id: string;
  name: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

type SortKey = "newest" | "oldest" | "name-asc" | "size-desc" | "size-asc";

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = Math.round((bytes / Math.pow(k, i)) * 100) / 100;
  return `${value} ${sizes[i]}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DocumentsPageProps = {
  apiBasePath?: string;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
};

export default function DocumentsPage({
  apiBasePath = "/api/v1/features/documents",
  title = "Documents",
  subtitle = "Upload and manage your documents securely.",
  embedded = false,
}: DocumentsPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Docs state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // UI state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof DEFAULT_PAGE_SIZE_OPTIONS)[number]>(10);

  // Modal state
  const [showDelete, setShowDelete] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (t: Omit<Toast, "id">) => {
    const id = uid();
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  };
  const removeToast = (id: string) =>
    setToasts((prev) => prev.filter((x) => x.id !== id));

  // Redirect if not authenticated (in effect, not during render)
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const response = await fetch(apiBasePath, {
        cache: "no-store",
      });

      if (!response.ok) {
        pushToast({
          type: "error",
          title: "Failed to load documents",
          message: "Please refresh the page.",
        });
        return;
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      pushToast({
        type: "error",
        title: "Network error",
        message: "Could not fetch documents.",
      });
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (session?.user) fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBasePath, session?.user?.id]);

  const filteredSortedDocs = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = q
      ? documents.filter((d) => {
          const n = d.name?.toLowerCase() ?? "";
          const desc = d.description?.toLowerCase() ?? "";
          const fn = d.fileName?.toLowerCase() ?? "";
          const ft = d.fileType?.toLowerCase() ?? "";
          return (
            n.includes(q) ||
            desc.includes(q) ||
            fn.includes(q) ||
            ft.includes(q)
          );
        })
      : documents;

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "newest")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      if (sort === "oldest")
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "size-desc") return b.fileSize - a.fileSize;
      if (sort === "size-asc") return a.fileSize - b.fileSize;
      return 0;
    });

    return sorted;
  }, [documents, query, sort]);

  useEffect(() => {
    setPage(1);
  }, [documents.length, pageSize, query, sort]);

  const paginatedDocs = useMemo(
    () => paginateItems(filteredSortedDocs, page, pageSize),
    [filteredSortedDocs, page, pageSize],
  );

  const totals = useMemo(() => {
    const total = documents.length;
    const bytes = documents.reduce((acc, d) => acc + (d.fileSize || 0), 0);
    return { total, bytes };
  }, [documents]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const clearForm = () => {
    setFile(null);
    setName("");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      pushToast({
        type: "error",
        title: "Missing file",
        message: "Please select a file.",
      });
      return;
    }

    if (!name.trim()) {
      pushToast({
        type: "error",
        title: "Missing name",
        message: "Please enter a document name.",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name.trim());
      formData.append("description", description);

      const response = await fetch(apiBasePath, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to upload document");
      }

      const newDoc = await response.json();
      setDocuments((prev) => [newDoc, ...prev]);
      clearForm();

      pushToast({
        type: "success",
        title: "Uploaded",
        message: "Document uploaded successfully.",
      });
    } catch (error) {
      pushToast({
        type: "error",
        title: "Upload failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to upload. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openDelete = (doc: Document) => {
    setDeletingDoc(doc);
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `${apiBasePath}/${deletingDoc.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== deletingDoc.id));
      pushToast({
        type: "success",
        title: "Deleted",
        message: `${deletingDoc.name} removed.`,
      });

      setShowDelete(false);
      setDeletingDoc(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      pushToast({
        type: "error",
        title: "Delete failed",
        message: "Could not delete document.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className={embedded ? "space-y-6" : "flex-1 overflow-auto bg-zinc-50"}>
        <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl px-6 py-10"}>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="h-5 w-56 animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
            <div className="mt-4 h-10 w-full animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  return (
    <div className={embedded ? "space-y-8" : "flex-1 overflow-auto bg-zinc-50"}>
      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-60 flex w-[92vw] max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl border bg-white p-4 shadow-lg ${
              t.type === "success"
                ? "border-emerald-100"
                : t.type === "error"
                  ? "border-red-100"
                  : "border-zinc-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{t.title}</p>
                {t.message && (
                  <p className="mt-1 text-sm text-zinc-600">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className={embedded ? "rounded-[28px] border bg-white p-6 shadow-sm" : "border-b bg-white"}>
        <div className={embedded ? "" : "mx-auto max-w-6xl px-6 py-10"}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-sm">
                  <span className="text-sm font-semibold">D</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    {title}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-600">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={fetchDocuments}
              className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
              disabled={loadingDocs}
            >
              {loadingDocs ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Summary */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Total documents
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {totals.total}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Storage used
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">
                {formatFileSize(totals.bytes)}
              </p>
            </div>
            <div className="rounded-2xl border bg-zinc-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Access
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                Signed in as {session.user.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={embedded ? "space-y-8" : "mx-auto max-w-6xl space-y-8 px-6 py-10"}>
        {/* Upload */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Upload new document
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Add a name and optional description to help you find it later.
              </p>
            </div>
            {file ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                Selected: {file.name}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                No file selected
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  Document name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Insurance form, ID scan..."
                  className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-800">
                  File <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 rounded-2xl border-2 border-dashed border-zinc-300 p-5 hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full"
                  />
                  {file && (
                    <div className="mt-3 rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{file.name}</span>
                        <span className="text-zinc-500">•</span>
                        <span>{formatFileSize(file.size)}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="font-mono text-xs">
                          {file.type || "file"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-800">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes…"
                rows={3}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={clearForm}
                disabled={isUploading}
                className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </section>

        {/* List */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Your documents
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Search and sort to find files quickly.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, file, type..."
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 pr-10 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name-asc">Name (A → Z)</option>
                <option value="size-desc">Size (largest)</option>
                <option value="size-asc">Size (smallest)</option>
              </select>
            </div>
          </div>

          <div className="mt-6">
            {loadingDocs ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : filteredSortedDocs.length === 0 ? (
              <div className="rounded-2xl border bg-zinc-50 p-10 text-center">
                <div className="text-2xl">📄</div>
                <p className="mt-2 text-sm font-semibold text-zinc-900">
                  {query ? "No results" : "No documents yet"}
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  {query
                    ? "Try a different search."
                    : "Upload your first document using the form above."}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-50 border-b">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          File
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Size
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Uploaded
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {paginatedDocs.items.map((doc) => (
                        <tr key={doc.id} className="hover:bg-zinc-50">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-zinc-900">
                              {doc.name}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              {doc.description || "—"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm text-zinc-700">
                                {doc.fileName}
                              </span>
                              <span className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium text-zinc-700">
                                {doc.fileType || "file"}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-zinc-700">
                            {formatFileSize(doc.fileSize)}
                          </td>

                          <td className="px-6 py-4 text-sm text-zinc-700">
                            {formatDate(doc.createdAt)}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  window.open(
                                    `${apiBasePath}/${doc.id}/view`,
                                    "_blank",
                                  )
                                }
                                className="rounded-xl border bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                              >
                                View
                              </button>

                              <a
                                href={`${apiBasePath}/${doc.id}/download`}
                                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                              >
                                Download
                              </a>

                              <button
                                onClick={() => openDelete(doc)}
                                className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ClientPaginationControls
                  page={paginatedDocs.currentPage}
                  totalPages={paginatedDocs.totalPages}
                  pageSize={paginatedDocs.pageSize}
                  totalItems={paginatedDocs.totalItems}
                  itemLabel="documents"
                  onPageChange={setPage}
                  onPageSizeChange={(nextPageSize) =>
                    setPageSize(
                      DEFAULT_PAGE_SIZE_OPTIONS.includes(
                        nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number],
                      )
                        ? (nextPageSize as (typeof DEFAULT_PAGE_SIZE_OPTIONS)[number])
                        : 10,
                    )
                  }
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Delete modal */}
      {showDelete && deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-900">
                  Delete document
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  if (isDeleting) return;
                  setShowDelete(false);
                  setDeletingDoc(null);
                }}
                className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-50"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
              <p className="text-sm text-zinc-700">
                You’re about to delete{" "}
                <span className="font-semibold text-zinc-900">
                  {deletingDoc.name}
                </span>
                .
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                File: <span className="font-mono">{deletingDoc.fileName}</span>
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  if (isDeleting) return;
                  setShowDelete(false);
                  setDeletingDoc(null);
                }}
                className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
