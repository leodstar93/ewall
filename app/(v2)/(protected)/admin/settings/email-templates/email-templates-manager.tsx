"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import Table, { type ColumnDef } from "@/app/(v2)/(protected)/admin/components/ui/Table";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

type EmailTemplate = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  subject: string;
  bodyText: string;
  variables: string[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  customized: boolean;
};

type TemplateRow = EmailTemplate & {
  statusLabel: string;
  searchText: string;
};

type FormState = {
  subject: string;
  bodyText: string;
  isActive: boolean;
};

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function toForm(template: EmailTemplate): FormState {
  return {
    subject: template.subject,
    bodyText: template.bodyText,
    isActive: template.isActive,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Default";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailTemplatesManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ subject: "", bodyText: "", isActive: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function loadTemplates() {
    try {
      setLoading(true);
      setError("");
      const payload = await fetchJson<{ templates: EmailTemplate[] }>(
        "/api/v1/admin/settings/email-templates",
      );
      setTemplates(payload.templates);
      setSelectedKey((current) => current ?? payload.templates[0]?.key ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load email templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey) ?? templates[0] ?? null,
    [selectedKey, templates],
  );

  useEffect(() => {
    if (selectedTemplate) {
      setForm(toForm(selectedTemplate));
    }
  }, [selectedTemplate]);

  const rows = useMemo<TemplateRow[]>(
    () =>
      templates.map((template) => ({
        ...template,
        statusLabel: template.customized ? "Customized" : "Default",
        searchText: [
          template.name,
          template.description,
          template.key,
          template.subject,
          template.variables.join(" "),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [templates],
  );

  const previewText = useMemo(
    () =>
      form.bodyText.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, variable: string) =>
        `[${variable}]`,
      ),
    [form.bodyText],
  );

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) return;

    try {
      setSaving(true);
      const payload = await fetchJson<{ template: EmailTemplate }>(
        `/api/v1/admin/settings/email-templates/${selectedTemplate.key}`,
        {
          method: "PUT",
          body: JSON.stringify(form),
        },
      );
      setTemplates((current) =>
        current.map((template) =>
          template.key === payload.template.key ? payload.template : template,
        ),
      );
      toast.success("Email template saved.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  async function resetTemplate() {
    if (!selectedTemplate) return;
    if (!window.confirm(`Reset "${selectedTemplate.name}" to the system default?`)) return;

    try {
      setSaving(true);
      const payload = await fetchJson<{ template: EmailTemplate }>(
        `/api/v1/admin/settings/email-templates/${selectedTemplate.key}`,
        { method: "DELETE" },
      );
      setTemplates((current) =>
        current.map((template) =>
          template.key === payload.template.key ? payload.template : template,
        ),
      );
      toast.success("Email template reset.");
    } catch (resetError) {
      toast.error(resetError instanceof Error ? resetError.message : "Could not reset template.");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnDef<TemplateRow>[] = [
    {
      key: "name",
      label: "Template",
      render: (_, template) => (
        <button
          type="button"
          onClick={() => setSelectedKey(template.key)}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span className={tableStyles.nameCell}>{template.name}</span>
          <span className={tableStyles.muteCell}>{template.description}</span>
        </button>
      ),
    },
    {
      key: "statusLabel",
      label: "Status",
      render: (_, template) => (
        <span
          style={{
            display: "inline-flex",
            borderRadius: 999,
            padding: "3px 9px",
            fontSize: 11,
            fontWeight: 700,
            background: template.customized ? "#e6f4ea" : "#f3f4f6",
            color: template.customized ? "#166534" : "#52525b",
          }}
        >
          {template.customized ? "Customized" : "Default"}
        </span>
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (_, template) => formatDate(template.updatedAt),
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 0.9fr) minmax(420px, 1.1fr)", gap: 16 }}>
      <div className={tableStyles.card}>
        <Table
          data={rows}
          columns={columns}
          title="Email templates"
          searchQuery={query}
          searchKeys={["searchText"]}
          toolbar={
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates..."
              style={{
                width: "100%",
                maxWidth: 320,
                border: "1px solid var(--br)",
                borderRadius: 6,
                padding: "8px 10px",
                fontSize: 13,
              }}
            />
          }
        />
      </div>

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.subtitle}>
              {selectedTemplate ? selectedTemplate.key : "Email template"}
            </div>
            <div className={tableStyles.title}>
              {selectedTemplate ? selectedTemplate.name : "Select a template"}
            </div>
          </div>
          {selectedTemplate ? (
            <button
              type="button"
              className={tableStyles.btn}
              onClick={() => void resetTemplate()}
              disabled={saving || !selectedTemplate.customized}
            >
              Reset default
            </button>
          ) : null}
        </div>

        <div style={{ padding: 16 }}>
          {loading ? <p className={tableStyles.subtitle}>Loading templates...</p> : null}
          {error ? <p style={{ color: "#b22234", fontSize: 13 }}>{error}</p> : null}

          {selectedTemplate ? (
            <form onSubmit={saveTemplate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={tableStyles.subtitle}>Subject</span>
                <input
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 6,
                    padding: "9px 10px",
                    fontSize: 13,
                  }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={tableStyles.subtitle}>Body</span>
                <textarea
                  value={form.bodyText}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bodyText: event.target.value }))
                  }
                  rows={16}
                  style={{
                    border: "1px solid var(--br)",
                    borderRadius: 6,
                    padding: "10px",
                    fontSize: 13,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    resize: "vertical",
                  }}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                Use this customized template when sending emails
              </label>

              <div>
                <div className={tableStyles.subtitle} style={{ marginBottom: 6 }}>
                  Available variables
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedTemplate.variables.map((variable) => (
                    <code
                      key={variable}
                      style={{
                        border: "1px solid var(--br)",
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontSize: 12,
                        background: "var(--off)",
                      }}
                    >
                      {"{{"}
                      {variable}
                      {"}}"}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <div className={tableStyles.subtitle} style={{ marginBottom: 6 }}>
                  Preview with placeholders
                </div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    border: "1px solid var(--brl)",
                    borderRadius: 8,
                    background: "var(--off)",
                    padding: 12,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "#444",
                  }}
                >
                  {previewText}
                </pre>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="submit"
                  className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save template"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
