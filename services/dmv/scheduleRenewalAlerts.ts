export const DEFAULT_RENEWAL_ALERT_DAYS = [90, 60, 30, 15, 7, 1] as const;

export function scheduleRenewalAlerts(input: {
  dueDate: Date | string;
  alertDays?: number[];
}) {
  const dueDate = input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
  const alertDays = input.alertDays?.length ? input.alertDays : [...DEFAULT_RENEWAL_ALERT_DAYS];

  return alertDays
    .filter((days) => Number.isInteger(days) && days >= 0)
    .map((daysBeforeDue) => ({
      daysBeforeDue,
      sendAt: new Date(dueDate.getTime() - daysBeforeDue * 24 * 60 * 60 * 1000),
    }))
    .sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
}
