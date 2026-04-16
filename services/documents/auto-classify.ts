type DocumentUploaderRole = "admin" | "staff" | "client" | "user";

type AutoClassifyDocumentInput = {
  originalFileName: string;
  mimeType?: string | null;
  providedCategory?: string | null;
  providedName?: string | null;
  companyName?: string | null;
  uploaderRole?: DocumentUploaderRole;
  createdAt?: Date;
};

type AutoClassifyDocumentResult = {
  category: string;
  displayName: string;
  storedFileName: string;
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  return normalized.length ? normalized : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function readableSlug(value: string) {
  return slugify(value).replace(/-/g, " ");
}

function getSafeExtension(fileName: string) {
  const match = /(\.[A-Za-z0-9]+)$/.exec(fileName.trim());
  return match?.[1]?.toLowerCase() || "";
}

function inferCategoryFromMime(mimeType?: string | null) {
  if (!mimeType) return "general-document";
  if (mimeType === "application/pdf") return "pdf-document";
  if (mimeType.startsWith("image/")) return "image-document";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv")) {
    return "spreadsheet-document";
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return "text-document";
  }
  if (mimeType.startsWith("video/")) return "video-document";
  return "general-document";
}

export function autoClassifyDocument(input: AutoClassifyDocumentInput): AutoClassifyDocumentResult {
  const uploaderRole = input.uploaderRole || "user";
  const category = slugify(
    normalizeOptionalText(input.providedCategory) || inferCategoryFromMime(input.mimeType),
  );
  const companySlug = normalizeOptionalText(input.companyName)
    ? readableSlug(normalizeOptionalText(input.companyName) || "")
    : "";
  const dateStamp = (input.createdAt ?? new Date()).toISOString().slice(0, 10).replace(/-/g, " ");
  const providedNameSlug = normalizeOptionalText(input.providedName)
    ? readableSlug(normalizeOptionalText(input.providedName) || "")
    : "";
  const readableCategory = category.replace(/-/g, " ");
  const baseName = [readableCategory, companySlug, uploaderRole, dateStamp].filter(Boolean).join(" ");
  const displayName = providedNameSlug ? `${baseName} ${providedNameSlug}` : baseName;
  const extension = getSafeExtension(input.originalFileName);

  return {
    category,
    displayName,
    storedFileName: extension ? `${displayName}${extension}` : displayName,
  };
}
