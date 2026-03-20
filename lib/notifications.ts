export const NOTIFICATION_CATEGORIES = [
  "SYSTEM",
  "DMV",
  "IFTA",
  "UCR",
  "FORM2290",
  "DOCUMENTS",
  "ACCOUNT",
] as const;

export const NOTIFICATION_LEVELS = [
  "INFO",
  "SUCCESS",
  "WARNING",
  "ERROR",
] as const;

export type NotificationCategoryValue =
  (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationLevelValue = (typeof NOTIFICATION_LEVELS)[number];

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  category: NotificationCategoryValue;
  level: NotificationLevelValue;
  href: string | null;
  actionLabel: string | null;
  readAt: string | null;
  createdAt: string;
};

export function notificationCategoryLabel(category: NotificationCategoryValue) {
  switch (category) {
    case "DMV":
      return "DMV";
    case "IFTA":
      return "IFTA";
    case "UCR":
      return "UCR";
    case "FORM2290":
      return "2290";
    case "DOCUMENTS":
      return "Documents";
    case "ACCOUNT":
      return "Account";
    default:
      return "System";
  }
}

export function formatNotificationRelativeTime(
  value: Date | string,
  now = new Date(),
) {
  const target = value instanceof Date ? value : new Date(value);
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return formatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffMonths / 12);
  return formatter.format(diffYears, "year");
}
