import { Quarter } from "@prisma/client";

export function getQuarterDateRange(year: number, quarter: Quarter) {
  const startMonthByQuarter: Record<Quarter, number> = {
    Q1: 0,
    Q2: 3,
    Q3: 6,
    Q4: 9,
  };

  const start = new Date(Date.UTC(year, startMonthByQuarter[quarter], 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, startMonthByQuarter[quarter] + 3, 0, 23, 59, 59, 999));

  return { start, end };
}

export function parseQuarter(value: unknown) {
  if (value === "Q1" || value === "Q2" || value === "Q3" || value === "Q4") {
    return value;
  }

  return null;
}

export function parseYear(value: unknown) {
  const year = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(year)) return null;
  if (year < 2000 || year > new Date().getUTCFullYear() + 1) return null;
  return year;
}
