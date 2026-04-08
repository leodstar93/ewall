import type { AdSlide, CompanyInfo, Item, Truck } from "@/lib/types";

export const companyInfo: CompanyInfo = {
  name: "Truckers Unidos Ops",
  tagline: "Compliance and fleet operations",
  plan: "Enterprise",
  industry: "Transportation",
  founded: "2019",
  employees: "48",
  country: "United States",
  email: "ops@truckersunidos.com",
};

export const adSlides: AdSlide[] = [
  {
    eyebrow: "Campaign",
    title: "IFTA reviews on track",
    description: "Keep the quarter moving with faster review queues and cleaner filing visibility.",
    cta: "Open filings",
    gradient: "linear-gradient(135deg, #002868 0%, #1a3f8f 100%)",
  },
  {
    eyebrow: "Renewals",
    title: "DMV season is active",
    description: "Highlight expiring registrations and route the team to the highest-risk renewals.",
    cta: "Review DMV",
    gradient: "linear-gradient(135deg, #b22234 0%, #d94a5a 100%)",
  },
  {
    eyebrow: "Documents",
    title: "Archive stays searchable",
    description: "Centralize receipts, filings, and support files without leaving the dashboard shell.",
    cta: "Browse docs",
    gradient: "linear-gradient(135deg, #002868 0%, #b22234 100%)",
  },
];

export const trucksData: Truck[] = [
  {
    id: "TRK-101",
    model: "Freightliner Cascadia",
    driver: "Jose Rivera",
    location: "Dallas, TX",
    load: "Auto Parts",
    status: "Activo",
  },
  {
    id: "TRK-214",
    model: "Volvo VNL 760",
    driver: "Ana Morales",
    location: "Phoenix, AZ",
    load: "Produce",
    status: "En transito",
  },
  {
    id: "TRK-309",
    model: "Kenworth T680",
    driver: "Luis Martinez",
    location: "San Bernardino, CA",
    load: "Maintenance hold",
    status: "Mantenimiento",
  },
  {
    id: "TRK-411",
    model: "Peterbilt 579",
    driver: "Marcos Diaz",
    location: "Laredo, TX",
    load: "Dry goods",
    status: "Activo",
  },
  {
    id: "TRK-550",
    model: "International LT",
    driver: "Sofia Perez",
    location: "Miami, FL",
    load: "Unassigned",
    status: "Inactivo",
  },
];

export const tableData: Item[] = [
  {
    id: 1001,
    name: "Quarterly IFTA filing",
    category: "IFTA",
    status: "Pendiente",
    date: "2026-04-08",
    amount: 1240,
  },
  {
    id: 1002,
    name: "Texas registration renewal",
    category: "DMV",
    status: "Activo",
    date: "2026-04-07",
    amount: 680,
  },
  {
    id: 1003,
    name: "UCR annual submission",
    category: "UCR",
    status: "Completado",
    date: "2026-04-05",
    amount: 525,
  },
  {
    id: 1004,
    name: "Fleet insurance review",
    category: "Compliance",
    status: "Inactivo",
    date: "2026-03-30",
    amount: 310,
  },
  {
    id: 1005,
    name: "California permit packet",
    category: "Documents",
    status: "Pendiente",
    date: "2026-04-02",
    amount: 210,
  },
  {
    id: 1006,
    name: "Fuel exception audit",
    category: "IFTA",
    status: "Activo",
    date: "2026-04-06",
    amount: 890,
  },
];
