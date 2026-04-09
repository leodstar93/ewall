export type ItemStatus = "Activo" | "Pendiente" | "Completado" | "Inactivo";

export interface Item {
  id: number;
  name: string;
  category: string;
  status: ItemStatus;
  date: string;
  amount: number;
}

export type TruckStatus =
  | "Activo"
  | "En transito"
  | "Mantenimiento"
  | "Inactivo";

export interface Truck {
  id: string;
  model: string;
  driver: string;
  location: string;
  load: string;
  status: TruckStatus;
}

export interface AdSlide {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href?: string;
  gradient: string;
}

export interface CompanyInfo {
  name: string;
  tagline: string;
  plan: string;
  industry: string;
  founded: string;
  employees: string;
  country: string;
  email: string;
}

export type SortDirection = 1 | -1;
export type SortColumn = keyof Item;
