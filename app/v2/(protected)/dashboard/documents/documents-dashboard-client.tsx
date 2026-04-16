"use client";

import { useDeferredValue, useEffect, useState, type CSSProperties } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";

type DocumentItem = {
  id: string;
  name: string;
  description: string | null;
  category?: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
};

type DocumentTableRow = DocumentItem & {
  sortCreatedAt: number;
  searchableText: string;
};

const fieldStyle: CSSProperties = {
  border: "1px solid var(--br)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  background: "#fff",
  color: "var(--b)",
};

function fileTone(fileType: string): "info" | "success" | "warning" | "light" {
  const normalized = fileType.toLowerCase();

  if (normalized.includes("pdf")) return "warning";
  if (normalized.startsWith("image/")) return "success";
  if (normalized.includes("sheet") || normalized.includes("excel") || normalized.includes("csv")) {
    return "info";
  }

  return "light";
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(value: string) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function buildRows(items: DocumentItem[]): DocumentTableRow[] {
  return items.map((item) => ({
    ...item,
    sortCreatedAt: -new Date(item.createdAt).getTime(),
    searchableText: [
      item.name,
      item.description ?? "",
      item.fileName,
      item.fileType,
      item.category ?? "",
    ]
      .map((value) => normalizeSearchText(value))
      .join(" "),
  }));
}

export default function DocumentsDashboardClient() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/v1/features/documents", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        documents?: DocumentItem[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not load your documents.");
      }

      setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load your documents.",
      );
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function handleDelete(document: DocumentItem) {
    if (!window.confirm(`Delete "${document.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(document.id);
      setError("");

      const response = await fetch(`/api/v1/features/documents/${document.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete this document.");
      }

      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete this document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const categories = Array.from(
    new Set(
      documents.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const filteredRows = buildRows(documents).filter((item) => {
    const tokens = searchTokens(deferredSearch);

    if (tokens.length > 0 && !tokens.every((token) => item.searchableText.includes(token))) {
      return false;
    }

    if (categoryFilter !== "all" && (item.category ?? "") !== categoryFilter) {
      return false;
    }

    return true;
  });

  const columns: ColumnDef<DocumentTableRow>[] = [
    {
      key: "sortCreatedAt",
      label: "Document",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={[
            item.description || item.fileName,
            item.fileType || "file",
            item.category || "",
          ].filter(Boolean).join(" · ")}
        >
          {item.name}
        </div>
      ),
    },
    {
      key: "fileName",
      label: "File",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          title={formatFileSize(item.fileSize)}
        >
          {item.fileName}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Uploaded",
      render: (_, item) => (
        <div
          className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
          style={{ fontSize: 13 }}
          title="Stored securely in your workspace"
        >
          {formatDateTime(item.createdAt)}
        </div>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, item) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <a
            href={`/api/v1/features/documents/${item.id}/view`}
            target="_blank"
            rel="noreferrer"
            aria-label="View document"
            title="View document"
            className={iconButtonClasses({ variant: "default" })}
          >
            <ActionIcon name="view" />
          </a>
          <a
            href={`/api/v1/features/documents/${item.id}/download`}
            aria-label="Download document"
            title="Download document"
            className={iconButtonClasses({ variant: "dark" })}
          >
            <ActionIcon name="download" />
          </a>
          <button
            type="button"
            onClick={() => void handleDelete(item)}
            disabled={deletingId === item.id}
            aria-label="Delete document"
            title="Delete document"
            className={iconButtonClasses({ variant: "danger" })}
          >
            <ActionIcon name="delete" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      {error ? (
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
      ) : null}

      {loading ? (
        <div className={tableStyles.card} style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
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
          data={filteredRows}
          columns={columns}
          title="My documents"
          actions={[
            {
              label: "Refresh",
              onClick: () => void loadDocuments(),
            },
          ]}
          toolbar={
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Search
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Document, file name, type..."
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className={tableStyles.subtitle}
                  style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
                >
                  Category
                </span>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  style={fieldStyle}
                >
                  <option value="all">All categories</option>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        />
      )}
    </div>
  );
}
