import { z } from "zod";

export const saferLookupSchema = z.object({
  dotNumber: z
    .string()
    .trim()
    .min(1, "USDOT number is required.")
    .regex(/^\d+$/, "USDOT must contain digits only")
    .transform((value) => value.replace(/^0+/, "") || "0"),
});

export const saferCompanySchema = z.object({
  legalName: z.string().nullable().optional(),
  dbaName: z.string().nullable().optional(),
  usdotNumber: z.string().nullable().optional(),
  mcNumber: z.string().nullable().optional(),
  usdOTStatus: z.string().nullable().optional(),
  operatingStatus: z.string().nullable().optional(),
  entityType: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  addressRaw: z.string().nullable().optional(),
  mailingAddressRaw: z.string().nullable().optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  drivers: z.number().nullable().optional(),
  powerUnits: z.number().nullable().optional(),
  mcs150Mileage: z.number().nullable().optional(),
  mileageYear: z.number().nullable().optional(),
  operationClassifications: z.array(z.string()).optional(),
  cargoCarried: z.array(z.string()).optional(),
});

export const saferLookupResultSchema = z.object({
  found: z.boolean(),
  source: z.literal("SAFER"),
  searchedDotNumber: z.string(),
  fetchedAt: z.string().datetime(),
  warnings: z.array(z.string()),
  company: saferCompanySchema.optional(),
  rawSnapshot: z.record(z.string(), z.unknown()).optional(),
});

export const saferApplySchema = z.object({
  dotNumber: saferLookupSchema.shape.dotNumber,
  lookupResult: saferLookupResultSchema,
});

export type SaferApplyInput = z.infer<typeof saferApplySchema>;
