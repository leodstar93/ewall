"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import Table, { type ColumnDef } from "../components/ui/Table";
import tableStyles from "../components/ui/DataTable.module.css";
import type {
  AdminDocumentDirectoryData,
  AdminDocumentDirectoryItem,
} from "@/lib/services/admin-documents.service";

type DocumentTableRow = AdminDocumentDirectoryItem & {
  sortOrder: number;
  searchableText: string;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getInitials(item: AdminDocumentDirectoryItem) {
  const label = item.userName || item.userEmail || "U";
  return (label[0] || "U").toUpperCase();
}

function fileTone(fileType: string): "info" | "success" | "warning" | "light" {
  const normalized = fileType.toLowerCase();

  if (normalized.includes("pdf")) return "warning";
  if (normalized.startsWith("image/")) return "success";
  if (normalized.includes("sheet") || normalized.includes("excel") || normalized.includes("csv")) {
    return "info";
  }

  return "light";
}

export default function DocumentsAdminClient({
  data,
}: {
  data: AdminDocumentDirectoryData;
}) {
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [category, setCategory] = useState("all");

  const deferredSearch = useDeferredValue(search);

  const rows = useMemo<DocumentTableRow[]>(
    () =>
      data.items.map((item) => ({
        ...item,
        sortOrder: -new Date(item.createdAt).getTime(),
        searchableText: [
          item.name,
          item.description ?? "",
          item.fileName,
          item.fileType,
          item.category ?? "",
          item.userName,
          item.userEmail,
          item.userCompanyName,
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [data.items],
  );

  const filteredRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return rows.filter((item) => {
      if (query && !item.searchableText.includes(query)) {
        return false;
      }

      if (fileType !== "all" && item.fileType !== fileType) {
        return false;
      }

      if (category !== "all" && (item.category || "") !== category) {
        return false;
      }

      return true;
    });
  }, [category, deferredSearch, fileType, rows]);

  const summary = useMemo(() => {
    const userIds = new Set(filteredRows.map((item) => item.userId));
    const totalBytes = filteredRows.reduce((sum, item) => sum + item.fileSize, 0);

    return {
      documents: filteredRows.length,
      users: userIds.size,
      storage: formatFileSize(totalBytes),
    };
  }, [filteredRows]);

  const columns = useMemo<ColumnDef<DocumentTableRow>[]>(
    () => [
      {
        key: "sortOrder",
        label: "Document",
        render: (_, item) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className={tableStyles.nameCell}>{item.name}</div>
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              {item.description || item.fileName}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Badge tone={fileTone(item.fileType)} variant="light">
                {item.fileType || "file"}
              </Badge>
              {item.category ? (
                <Badge tone="light" variant="light">
                  {item.category}
                </Badge>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        key: "userName",
        label: "Account",
        render: (_, item) => (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "var(--b)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {getInitials(item)}
            </div>

            <div style={{ minWidth: 0 }}>
              <Link
                href={`/v2/admin/users/${item.userId}`}
                className={tableStyles.nameCell}
                style={{ textDecoration: "none" }}
              >
                {item.userName}
              </Link>
              <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
                {item.userEmail || "No email on file"}
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                {item.userCompanyName || "No company on file"}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "fileName",
        label: "File",
        render: (_, item) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div className={tableStyles.nameCell}>{item.fileName}</div>
            <div className={tableStyles.muteCell} style={{ fontSize: 12 }}>
              {formatFileSize(item.fileSize)}
            </div>
          </div>
        ),
      },
      {
        key: "createdAt",
        label: "Uploaded",
        render: (_, item) => (
          <div>
            <div className={tableStyles.nameCell} style={{ fontSize: 13 }}>
              {formatDateTime(item.createdAt)}
            </div>
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
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Documents
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {summary.documents}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Files visible with the current filters.
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Accounts
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {summary.users}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Unique users with uploads in this result set.
          </p>
        </div>

        <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Storage used
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
            {summary.storage}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Combined file size across filtered documents.
          </p>
        </div>
      </div>

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.title}>Documents workspace</div>
            <div className={tableStyles.subtitle}>
              Review uploaded files by account, file type, and category.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "0 20px 20px",
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(0,1.6fr) minmax(180px,0.8fr) minmax(180px,0.8fr)",
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
              placeholder="Document, file, email, company..."
              style={{
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: "100%",
                color: "var(--b)",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              className={tableStyles.subtitle}
              style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
            >
              File type
            </span>
            <select
              value={fileType}
              onChange={(event) => setFileType(event.target.value)}
              style={{
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: "100%",
                background: "#fff",
                color: "var(--b)",
              }}
            >
              <option value="all">All file types</option>
              {data.availableFileTypes.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              className={tableStyles.subtitle}
              style={{ textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}
            >
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              style={{
                border: "1px solid var(--br)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                outline: "none",
                width: "100%",
                background: "#fff",
                color: "var(--b)",
              }}
            >
              <option value="all">All categories</option>
              {data.availableCategories.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <Table
        data={filteredRows}
        columns={columns}
        title="Uploaded documents"
      />
    </div>
  );
}
