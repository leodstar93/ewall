import { prisma } from "@/lib/prisma";
import type { AdSlide } from "@/lib/types";
import { SettingsValidationError } from "./settings-errors";

export const NEWS_UPDATE_AUDIENCES = ["ALL", "ADMIN", "TRUCKER", "PUBLIC"] as const;
export const NEWS_UPDATE_TEMPLATES = ["MIXED", "FULL_IMAGE"] as const;

export type NewsUpdateAudience = (typeof NEWS_UPDATE_AUDIENCES)[number];
export type NewsUpdateTemplate = (typeof NEWS_UPDATE_TEMPLATES)[number];

export type NewsUpdateRecord = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string | null;
  imageUrl: string | null;
  template: NewsUpdateTemplate;
  gradient: string;
  audience: NewsUpdateAudience;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_GRADIENT = "linear-gradient(135deg, #002868 0%, #b22234 100%)";

function isAudience(value: unknown): value is NewsUpdateAudience {
  return typeof value === "string" && NEWS_UPDATE_AUDIENCES.includes(value as NewsUpdateAudience);
}

function isTemplate(value: unknown): value is NewsUpdateTemplate {
  return typeof value === "string" && NEWS_UPDATE_TEMPLATES.includes(value as NewsUpdateTemplate);
}

function readString(input: Record<string, unknown>, key: string, label: string, max = 240) {
  const value = input[key];
  if (typeof value !== "string") {
    throw new SettingsValidationError(`${label} is required.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new SettingsValidationError(`${label} is required.`);
  }
  if (trimmed.length > max) {
    throw new SettingsValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function readOptionalString(input: Record<string, unknown>, key: string, label: string, max = 500) {
  const value = input[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new SettingsValidationError(`${label} is invalid.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new SettingsValidationError(`${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

function readBoolean(input: Record<string, unknown>, key: string, fallback: boolean) {
  const value = input[key];
  return typeof value === "boolean" ? value : fallback;
}

function readSortOrder(input: Record<string, unknown>) {
  const value = input.sortOrder;
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
    throw new SettingsValidationError("Sort order must be a whole number between 0 and 1000.");
  }
  return parsed;
}

function normalizeAudience(input: Record<string, unknown>) {
  const value = input.audience ?? "ALL";
  if (!isAudience(value)) {
    throw new SettingsValidationError("Audience is invalid.");
  }
  return value;
}

function normalizeTemplate(input: Record<string, unknown>) {
  const value = input.template ?? "MIXED";
  if (!isTemplate(value)) {
    throw new SettingsValidationError("Template is invalid.");
  }
  return value;
}

function readTemplateString(
  input: Record<string, unknown>,
  key: string,
  label: string,
  template: NewsUpdateTemplate,
  max = 240,
  fallback?: string,
) {
  if (template === "FULL_IMAGE") {
    return readOptionalString(input, key, label, max) ?? fallback ?? "";
  }

  return readString(input, key, label, max);
}

function readImageUrl(input: Record<string, unknown>, template: NewsUpdateTemplate) {
  const imageUrl = readOptionalString(input, "imageUrl", "Image URL");
  if (template === "FULL_IMAGE" && !imageUrl) {
    throw new SettingsValidationError("Image is required for full image slides.");
  }
  return imageUrl;
}

function formatNewsUpdate(record: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string | null;
  imageUrl: string | null;
  template: string;
  gradient: string;
  audience: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): NewsUpdateRecord {
  return {
    ...record,
    audience: isAudience(record.audience) ? record.audience : "ALL",
    template: isTemplate(record.template) ? record.template : "MIXED",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toSlide(record: NewsUpdateRecord): AdSlide {
  return {
    id: record.id,
    eyebrow: record.eyebrow,
    title: record.title,
    description: record.description,
    cta: record.cta,
    href: record.href ?? undefined,
    imageUrl: record.imageUrl ?? undefined,
    template: record.template,
    gradient: record.gradient,
  };
}

export async function listNewsUpdates() {
  const updates = await prisma.newsUpdate.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return updates.map(formatNewsUpdate);
}

export async function listActiveNewsUpdateSlides(audience: NewsUpdateAudience = "ALL") {
  const audienceFilter = audience === "ALL" ? ["ALL"] : ["ALL", audience];
  const updates = await prisma.newsUpdate.findMany({
    where: {
      isActive: true,
      audience: { in: audienceFilter },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return updates.map(formatNewsUpdate).map(toSlide);
}

export async function createNewsUpdate(input: Record<string, unknown>) {
  const template = normalizeTemplate(input);
  const imageUrl = readImageUrl(input, template);
  const title = readString(input, "title", "Title", 120);

  const record = await prisma.newsUpdate.create({
    data: {
      eyebrow: readTemplateString(input, "eyebrow", "Eyebrow", template, 80, "Update"),
      title,
      description: readTemplateString(input, "description", "Description", template, 320, title),
      cta: readTemplateString(input, "cta", "CTA", template, 80, "View"),
      href: readOptionalString(input, "href", "Link"),
      imageUrl,
      template,
      gradient: readOptionalString(input, "gradient", "Gradient") ?? DEFAULT_GRADIENT,
      audience: normalizeAudience(input),
      isActive: readBoolean(input, "isActive", true),
      sortOrder: readSortOrder(input),
    },
  });

  return formatNewsUpdate(record);
}

export async function updateNewsUpdate(id: string, input: Record<string, unknown>) {
  const existing = await prisma.newsUpdate.findUnique({ where: { id } });
  if (!existing) {
    throw new SettingsValidationError("News update not found.");
  }

  const template = normalizeTemplate(input);
  const imageUrl = readImageUrl(input, template);
  const title = readString(input, "title", "Title", 120);

  const record = await prisma.newsUpdate.update({
    where: { id },
    data: {
      eyebrow: readTemplateString(input, "eyebrow", "Eyebrow", template, 80, "Update"),
      title,
      description: readTemplateString(input, "description", "Description", template, 320, title),
      cta: readTemplateString(input, "cta", "CTA", template, 80, "View"),
      href: readOptionalString(input, "href", "Link"),
      imageUrl,
      template,
      gradient: readOptionalString(input, "gradient", "Gradient") ?? DEFAULT_GRADIENT,
      audience: normalizeAudience(input),
      isActive: readBoolean(input, "isActive", true),
      sortOrder: readSortOrder(input),
    },
  });

  return formatNewsUpdate(record);
}

export async function deleteNewsUpdate(id: string) {
  const existing = await prisma.newsUpdate.findUnique({ where: { id } });
  if (!existing) {
    throw new SettingsValidationError("News update not found.");
  }

  await prisma.newsUpdate.delete({ where: { id } });
}
