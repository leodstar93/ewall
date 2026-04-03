export type BadgeTone =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "light"
  | "dark";

export function getStatusTone(status: string): BadgeTone {
  const normalized = status.trim().toLowerCase().replace(/[_-]+/g, " ");

  if (
    normalized.includes("active") ||
    normalized.includes("approved") ||
    normalized.includes("paid") ||
    normalized.includes("compliant") ||
    normalized.includes("filed")
  ) {
    return "success";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("review") ||
    normalized.includes("draft") ||
    normalized.includes("requested") ||
    normalized.includes("ready")
  ) {
    return normalized.includes("review") || normalized.includes("ready") ? "info" : "warning";
  }

  if (
    normalized.includes("error") ||
    normalized.includes("reject") ||
    normalized.includes("expired") ||
    normalized.includes("cancel") ||
    normalized.includes("overdue") ||
    normalized.includes("correction") ||
    normalized.includes("attention")
  ) {
    return "error";
  }

  return "light";
}
