"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ActionIcon, iconButtonClasses } from "@/components/ui/icon-button";
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
          .map((value) => normalizeSearchText(value ?? ""))
          .join(" "),
      })),
    [data.items],
  );

  const filteredRows = useMemo(() => {
    const tokens = searchTokens(deferredSearch);

    return rows.filter((item) => {
      if (tokens.length > 0 && !tokens.every((token) => item.searchableText.includes(token))) {
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

  const columns = useMemo<ColumnDef<DocumentTableRow>[]>(
    () => [
      {
        key: "sortOrder",
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
                className={`${tableStyles.nameCell} ${tableStyles.compactCell}`}
                style={{ textDecoration: "none" }}
                title={[
                  item.userEmail || "No email on file",
                  item.userCompanyName || "No company on file",
                ].join(" · ")}
              >
                {item.userName}
              </Link>
            </div>
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
    <div className="w-full min-w-0">
      <Table
        data={filteredRows}
        columns={columns}
        title="Uploaded documents"
        toolbar={
          <div
            style={{
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
        }
      />
    </div>
  );
}
