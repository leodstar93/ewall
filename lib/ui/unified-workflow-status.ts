import type { BadgeTone } from "@/lib/ui/status-utils";

export type UnifiedWorkflowStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_PROCESS"
  | "PENDING_PAYMENT"
  | "APPROVED"
  | "FINALIZED";

export const unifiedWorkflowStatusOrder: UnifiedWorkflowStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_PROCESS",
  "PENDING_PAYMENT",
  "APPROVED",
  "FINALIZED",
];

export function unifiedWorkflowStatusLabel(status: UnifiedWorkflowStatus) {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SUBMITTED":
      return "Submitted";
    case "IN_PROCESS":
      return "In process";
    case "PENDING_PAYMENT":
      return "Pending payment";
    case "APPROVED":
      return "Approved";
    case "FINALIZED":
      return "Finalized";
    default:
      return status;
  }
}

export function unifiedWorkflowStatusTone(status: UnifiedWorkflowStatus): BadgeTone {
  switch (status) {
    case "DRAFT":
      return "light";
    case "SUBMITTED":
      return "primary";
    case "IN_PROCESS":
      return "info";
    case "PENDING_PAYMENT":
      return "warning";
    case "APPROVED":
      return "success";
    case "FINALIZED":
      return "dark";
    default:
      return "light";
  }
}
