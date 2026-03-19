export type TruckRecord = {
  id: string;
  userId: string;
  unitNumber: string;
  nickname: string | null;
  plateNumber: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  grossWeight: number | null;
  is2290Eligible: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    trips: number;
    fuelPurchases: number;
    iftaReports: number;
    form2290Filings: number;
  };
};

export function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
