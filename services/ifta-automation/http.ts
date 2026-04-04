import { ELDProvider } from "@prisma/client";
import { IftaAutomationError } from "@/services/ifta-automation/shared";

export function handleIftaAutomationError(error: unknown, fallback: string) {
  if (error instanceof IftaAutomationError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export function parseProvider(value: unknown) {
  if (typeof value !== "string") {
    throw new IftaAutomationError("Provider is required.", 400, "INVALID_PROVIDER");
  }

  const normalized = value.trim().toUpperCase();
  if (!Object.values(ELDProvider).includes(normalized as ELDProvider)) {
    throw new IftaAutomationError("Unsupported provider.", 400, "INVALID_PROVIDER");
  }

  return normalized as ELDProvider;
}

export function parseSyncMode(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") {
    return "FULL" as const;
  }

  if (value === "FULL" || value === "INCREMENTAL") {
    return value;
  }

  throw new IftaAutomationError("Sync mode must be FULL or INCREMENTAL.", 400, "INVALID_SYNC_MODE");
}

export function parseOptionalIsoDate(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new IftaAutomationError("Date must be an ISO string.", 400, "INVALID_DATE");
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new IftaAutomationError("Date must be a valid ISO string.", 400, "INVALID_DATE");
  }

  return parsed;
}

export function parseDownloadFormat(value: unknown) {
  if (value === "pdf" || value === "excel") return value;
  throw new IftaAutomationError("Format must be pdf or excel.", 400, "INVALID_DOWNLOAD_FORMAT");
}

export function parseOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}
