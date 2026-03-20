export type RenewalRisk =
  | "CURRENT"
  | "UPCOMING"
  | "ACTION_NEEDED"
  | "HIGH_RISK"
  | "EXPIRED";

export function calculateRenewalRisk(input: {
  dueDate?: Date | string | null;
  expirationDate?: Date | string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const targetDate = input.dueDate ?? input.expirationDate;

  if (!targetDate) return "CURRENT" as RenewalRisk;

  const dueDate = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "EXPIRED";
  if (diffDays <= 30) return "HIGH_RISK";
  if (diffDays <= 60) return "ACTION_NEEDED";
  if (diffDays <= 90) return "UPCOMING";
  return "CURRENT";
}
