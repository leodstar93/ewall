export type DmvRenewalCaseStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "NEEDS_CLIENT_ACTION"
  | "PENDING_CLIENT_APPROVAL"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED";

export function dmvRenewalStatusLabel(status: DmvRenewalCaseStatus) {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "IN_REVIEW":
      return "In Review";
    case "NEEDS_CLIENT_ACTION":
      return "Needs Client Action";
    case "PENDING_CLIENT_APPROVAL":
      return "Pending Client Approval";
    case "CHANGES_REQUESTED":
      return "Changes Requested";
    case "APPROVED":
      return "Approved";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function dmvRenewalStatusClasses(status: DmvRenewalCaseStatus) {
  switch (status) {
    case "SUBMITTED":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "IN_REVIEW":
      return "bg-blue-50 text-blue-800 ring-blue-200";
    case "NEEDS_CLIENT_ACTION":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "PENDING_CLIENT_APPROVAL":
      return "bg-violet-50 text-violet-800 ring-violet-200";
    case "CHANGES_REQUESTED":
      return "bg-orange-50 text-orange-800 ring-orange-200";
    case "APPROVED":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "CANCELLED":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function uploadDmvRenewalFile(file: File, label: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", label);
  formData.append("description", label);
  formData.append("category", "dmv-renewal");

  const response = await fetch("/api/v1/features/documents", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    fileName?: string;
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
    error?: string;
  };

  if (!response.ok || !data.id || !data.fileUrl) {
    throw new Error(data.error || "Could not upload the document.");
  }

  return {
    documentId: data.id,
    fileName: data.fileName ?? file.name,
    fileUrl: data.fileUrl,
    mimeType: data.fileType ?? file.type,
    fileSize: typeof data.fileSize === "number" ? data.fileSize : file.size,
  };
}

