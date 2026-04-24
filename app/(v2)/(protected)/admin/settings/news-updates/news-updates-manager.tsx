"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Table, { type ColumnDef } from "@/app/(v2)/(protected)/admin/components/ui/Table";
import { isLightBackground } from "@/lib/ui/color-utils";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

type Audience = "ALL" | "ADMIN" | "TRUCKER" | "PUBLIC";
type SlideTemplate = "MIXED" | "FULL_IMAGE";

type NewsUpdate = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string | null;
  imageUrl: string | null;
  template: SlideTemplate;
  gradient: string;
  audience: Audience;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type NewsUpdateRow = NewsUpdate & {
  searchText: string;
  statusLabel: string;
};

type FormState = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  imageUrl: string;
  template: SlideTemplate;
  gradient: string;
  audience: Audience;
  isActive: boolean;
  sortOrder: string;
};

const gradientOptions = [
  {
    label: "Blue",
    value: "linear-gradient(135deg, #002868 0%, #1a3f8f 100%)",
  },
  {
    label: "Red",
    value: "linear-gradient(135deg, #b22234 0%, #d94a5a 100%)",
  },
  {
    label: "Patriot",
    value: "linear-gradient(135deg, #002868 0%, #b22234 100%)",
  },
  {
    label: "Slate",
    value: "linear-gradient(135deg, #111827 0%, #475569 100%)",
  },
  {
    label: "White",
    value: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  },
];

const emptyForm: FormState = {
  eyebrow: "",
  title: "",
  description: "",
  cta: "",
  href: "",
  imageUrl: "",
  template: "MIXED",
  gradient: gradientOptions[0].value,
  audience: "ALL",
  isActive: true,
  sortOrder: "0",
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

async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/v1/admin/settings/news-updates/image", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    imageUrl?: string;
    error?: string;
  };

  if (!response.ok || !payload.imageUrl) {
    throw new Error(payload.error || "Could not upload image.");
  }

  return payload.imageUrl;
}

function toForm(update: NewsUpdate): FormState {
  return {
    eyebrow: update.eyebrow,
    title: update.title,
    description: update.description,
    cta: update.cta,
    href: update.href ?? "",
    imageUrl: update.imageUrl ?? "",
    template: update.template,
    gradient: update.gradient,
    audience: update.audience,
    isActive: update.isActive,
    sortOrder: String(update.sortOrder),
  };
}

function statusBadge(active: boolean) {
  return (
    <span
      className={`${tableStyles.badge} ${
        active ? tableStyles.bDone : tableStyles.bInactive
      }`}
    >
      {active ? "Active" : "Hidden"}
    </span>
  );
}

function isSolidHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

export default function NewsUpdatesManager() {
  const [updates, setUpdates] = useState<NewsUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customColor, setCustomColor] = useState("#ffffff");

  const rows = useMemo<NewsUpdateRow[]>(
    () =>
      updates.map((update) => ({
        ...update,
        statusLabel: update.isActive ? "Active" : "Hidden",
        searchText: [
          update.eyebrow,
          update.title,
          update.description,
          update.cta,
          update.href ?? "",
          update.imageUrl ?? "",
          update.template,
          update.audience,
          update.isActive ? "active" : "hidden inactive",
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [updates],
  );

  async function loadUpdates() {
    try {
      setLoading(true);
      const payload = await fetchJson<{ updates: NewsUpdate[] }>(
        "/api/v1/admin/settings/news-updates",
      );
      setUpdates(Array.isArray(payload.updates) ? payload.updates : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load news updates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUpdates();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setCustomColor("#ffffff");
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;

    try {
      setUploadingImage(true);
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, imageUrl }));
      toast.success("Image uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      const payload = await fetchJson<{ update: NewsUpdate }>(
        editingId
          ? `/api/v1/admin/settings/news-updates/${editingId}`
          : "/api/v1/admin/settings/news-updates",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            sortOrder: Number(form.sortOrder || 0),
          }),
        },
      );

      setUpdates((current) => {
        const next = editingId
          ? current.map((update) =>
              update.id === payload.update.id ? payload.update : update,
            )
          : [...current, payload.update];
        return next.sort((left, right) => left.sortOrder - right.sortOrder);
      });
      resetForm();
      toast.success(editingId ? "News update saved." : "News update created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save news update.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUpdate(update: NewsUpdate) {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete news update?",
      text: `This will remove "${update.title}" from News & Updates.`,
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#b22234",
      cancelButtonColor: "#64748b",
    });

    if (!result.isConfirmed) return;

    try {
      await fetchJson<{ ok: boolean }>(
        `/api/v1/admin/settings/news-updates/${update.id}`,
        { method: "DELETE" },
      );
      setUpdates((current) => current.filter((item) => item.id !== update.id));
      if (editingId === update.id) resetForm();
      toast.success("News update deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete news update.");
    }
  }

  const columns: ColumnDef<NewsUpdateRow>[] = [
    {
      key: "sortOrder",
      label: "Order",
      render: (_, update) => update.sortOrder,
    },
    {
      key: "title",
      label: "Slide",
      render: (_, update) => (
        <div className={tableStyles.nameCell}>
          <div className={tableStyles.compactCell} title={update.title}>
            {update.title}
          </div>
          <div
            className={`${tableStyles.muteCell} ${tableStyles.compactCell}`}
            title={update.description}
          >
            {update.eyebrow} | {update.description}
          </div>
        </div>
      ),
    },
    {
      key: "audience",
      label: "Audience",
    },
    {
      key: "template",
      label: "Template",
      render: (_, update) => (update.template === "FULL_IMAGE" ? "Full image" : "Mixed"),
    },
    {
      key: "statusLabel",
      label: "Status",
      render: (_, update) => statusBadge(update.isActive),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (_, update) => new Date(update.updatedAt).toLocaleString("en-US"),
    },
    {
      key: "_actions",
      label: "Actions",
      sortable: false,
      render: (_, update) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={tableStyles.btn}
            onClick={() => {
              setEditingId(update.id);
              setForm(toForm(update));
              setCustomColor(isSolidHexColor(update.gradient) ? update.gradient : "#ffffff");
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className={tableStyles.btn}
            onClick={() => void removeUpdate(update)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];
  const previewIsLight = isLightBackground(form.gradient);
  const isCustomSelected = isSolidHexColor(form.gradient);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.title}>News & Updates Manager</div>
            <div className={tableStyles.subtitle}>
              Manage the slides displayed in the dashboard News & Updates card.
            </div>
          </div>
        </div>

        <form
          onSubmit={saveUpdate}
          style={{ padding: 16, display: "grid", gap: 14 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Template
              <select
                value={form.template}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    template: event.target.value as SlideTemplate,
                  }))
                }
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              >
                <option value="MIXED">Mixed text + image</option>
                <option value="FULL_IMAGE">Full image</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Eyebrow {form.template === "FULL_IMAGE" ? "(optional)" : ""}
              <input
                value={form.eyebrow}
                onChange={(event) =>
                  setForm((current) => ({ ...current, eyebrow: event.target.value }))
                }
                required={form.template === "MIXED"}
                maxLength={80}
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Title
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                maxLength={120}
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              CTA {form.template === "FULL_IMAGE" ? "(optional)" : ""}
              <input
                value={form.cta}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cta: event.target.value }))
                }
                required={form.template === "MIXED"}
                maxLength={80}
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Link
              <input
                value={form.href}
                onChange={(event) =>
                  setForm((current) => ({ ...current, href: event.target.value }))
                }
                placeholder="/dashboard/ucr"
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Image URL {form.template === "FULL_IMAGE" ? "(required)" : ""}
              <input
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
                required={form.template === "FULL_IMAGE"}
                placeholder="/uploads/production/news-updates/..."
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              border: "1px dashed var(--br)",
              borderRadius: 8,
              background: "#fafafa",
            }}
          >
            <input
              id="news-update-image-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={uploadingImage}
              onChange={(event) => {
                void handleImageUpload(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
              style={{ display: "none" }}
            />
            <label
              htmlFor="news-update-image-upload"
              className={tableStyles.btn}
              style={{ cursor: uploadingImage ? "default" : "pointer" }}
            >
              {uploadingImage ? "Uploading image..." : "Upload image"}
            </label>
            <span style={{ fontSize: 12, color: "#666" }}>
              JPG, PNG, WEBP or GIF. Max 5 MB.
            </span>
          </div>

          <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
            Description {form.template === "FULL_IMAGE" ? "(optional)" : ""}
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              required={form.template === "MIXED"}
              maxLength={320}
              rows={3}
              style={{ border: "1px solid var(--br)", borderRadius: 6, padding: 10, resize: "vertical" }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Audience
              <select
                value={form.audience}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    audience: event.target.value as Audience,
                  }))
                }
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              >
                <option value="ALL">All dashboards</option>
                <option value="ADMIN">Admin dashboard</option>
                <option value="TRUCKER">Trucker dashboard</option>
                <option value="PUBLIC">Public v2 demo</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 12, color: "#666" }}>
              Sort order
              <input
                type="number"
                min="0"
                max="1000"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sortOrder: event.target.value }))
                }
                style={{ height: 36, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666", height: 36 }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              Active
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Gradient</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {gradientOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setForm((current) => ({ ...current, gradient: option.value }))
                  }
                  className={tableStyles.btn}
                  style={{
                    borderColor: form.gradient === option.value ? "var(--b)" : undefined,
                    background: form.gradient === option.value ? "var(--bl)" : undefined,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: option.value,
                    }}
                  />
                  {option.label}
                </button>
              ))}
              <label
                className={tableStyles.btn}
                style={{
                  cursor: "pointer",
                  borderColor: isCustomSelected ? "var(--b)" : undefined,
                  background: isCustomSelected ? "var(--bl)" : undefined,
                }}
              >
                <input
                  type="color"
                  value={customColor}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCustomColor(value);
                    setForm((current) => ({ ...current, gradient: value }));
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    padding: 0,
                    border: "1px solid var(--br)",
                    borderRadius: 4,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                />
                Custom color
              </label>
            </div>
          </div>

          <div
            style={{
              minHeight: 120,
              borderRadius: 8,
              padding: form.template === "FULL_IMAGE" ? 0 : 16,
              color: previewIsLight ? "#0f172a" : "#fff",
              background: form.gradient,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
              overflow: "hidden",
            }}
          >
            {form.template === "FULL_IMAGE" ? (
              form.imageUrl.trim() ? (
                <div
                  style={{
                    minHeight: 150,
                    borderRadius: 10,
                    backgroundImage: `url("${form.imageUrl.trim()}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 150,
                    display: "grid",
                    placeItems: "center",
                    color: previewIsLight ? "rgba(15,23,42,0.72)" : "rgba(255,255,255,0.78)",
                    fontSize: 13,
                  }}
                >
                  Upload or paste an image URL for the full image slide.
                </div>
              )
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: form.imageUrl.trim() ? "minmax(0, 1fr) 170px" : "1fr", gap: 16, alignItems: "center" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.75 }}>
                    {form.eyebrow || "Eyebrow"}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {form.title || "Slide title"}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.86 }}>
                    {form.description || "Slide description preview."}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                    {form.cta || "CTA"} -&gt;
                  </div>
                </div>
                {form.imageUrl.trim() ? (
                  <div
                    style={{
                      height: 96,
                      borderRadius: 10,
                      backgroundImage: `url("${form.imageUrl.trim()}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      border: "1px solid rgba(255,255,255,0.28)",
                      boxShadow: "0 16px 36px rgba(0,0,0,0.22)",
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className={tableStyles.btn}
              onClick={resetForm}
              disabled={saving}
            >
              Reset
            </button>
            <button
              type="submit"
              className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
              disabled={saving}
            >
              {saving ? "Saving..." : editingId ? "Save update" : "Create update"}
            </button>
          </div>
        </form>
      </div>

      <Table
        data={rows}
        columns={columns}
        title={loading ? "Loading news updates..." : "Configured slides"}
        searchQuery={query}
        searchKeys={["searchText"]}
        toolbar={
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search slides..."
            style={{ height: 34, border: "1px solid var(--br)", borderRadius: 6, padding: "0 10px", minWidth: 240 }}
          />
        }
      />
    </div>
  );
}
