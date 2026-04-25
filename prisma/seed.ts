import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import {
  DmvRegistrationType,
  Prisma,
  SubscriptionInterval,
  TruckVehicleType,
} from "@prisma/client";
import { US_JURISDICTIONS } from "../features/ifta/constants/us-jurisdictions";
import { seedIftaJurisdictionProcedures } from "./seed-ifta-jurisdiction-procedures";

// Cambia estos valores si quieres
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@ewall.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

const ROLES = [
  { name: "ADMIN", description: "Full access" },
  { name: "TRUCKER", description: "Trucker access" },
  { name: "STAFF", description: "Staff access" },
  { name: "USER", description: "Regular user access" },
] as const;

const PERMISSIONS = [
  // Users / RBAC
  { key: "users:read", description: "Read users" },
  { key: "users:write", description: "Create/update users" },
  { key: "roles:read", description: "Read roles" },
  { key: "roles:write", description: "Create/update roles" },
  { key: "permissions:read", description: "Read permissions" },
  { key: "permissions:write", description: "Create/update permissions" },
  { key: "dashboard:access", description: "Access dashboard" },
  { key: "audit:read", description: "Read audit sections and event history" },

  // Ejemplos de módulos (ajusta a tu app)
  { key: "profile:access", description: "Access profile" },
  { key: "profile:write", description: "Update profile" },
  { key: "documents:read", description: "Read documents" },
  { key: "documents:write", description: "Upload/manage documents" },

  // IFTA
  { key: "ifta:read", description: "Read IFTA reports" },
  { key: "ifta:write", description: "Create/update/delete IFTA reports" },
  { key: "ifta:sync", description: "Run IFTA automation synchronization jobs" },
  { key: "ifta:review", description: "Review IFTA automation filings and exceptions" },
  { key: "ifta:approve", description: "Approve IFTA automation snapshots" },
  { key: "ifta:settings", description: "Manage IFTA automation settings and provider metadata" },
  { key: "eld:connect", description: "Create and manage ELD provider connections" },
  { key: "eld:sync", description: "Run ELD provider synchronization jobs" },
  { key: "truck:read", description: "Read trucks" },
  { key: "truck:write", description: "Create/update trucks" },
  { key: "reports:read", description: "Read generated reports" },
  { key: "reports:write", description: "Create/update generated reports" },
  { key: "reports:generate", description: "Generate reports" },
  { key: "reports:download", description: "Download reports" },
  { key: "settings:read", description: "Read account and admin settings" },
  { key: "settings:update", description: "Update account and admin settings" },
  { key: "billing:read", description: "Read billing status and subscription details" },
  { key: "billing:manage", description: "Manage customer billing actions and payment methods" },
  { key: "payment_method:read", description: "Read saved payment method summaries" },
  { key: "payment_method:create", description: "Create saved payment methods" },
  { key: "ach_vault:read_masked", description: "Read masked ACH vault details" },
  { key: "ach_vault:read_full", description: "Read full ACH vault details" },
  { key: "ach_vault:create", description: "Create ACH vault records" },
  { key: "ach_vault:update", description: "Update or revoke ACH vault records" },
  { key: "ach_vault:reveal_once", description: "Reveal full ACH data for a documented reason" },
  { key: "ach_vault:use_for_manual_payment", description: "Use ACH vault records for manual filing payments" },
  { key: "ach_authorization:create", description: "Create ACH authorization records" },
  { key: "ach_authorization:read", description: "Read ACH authorization records" },
  { key: "financial_audit:read", description: "Read sensitive financial access audit logs" },
  { key: "billing.plans:read", description: "Read subscription plans" },
  { key: "billing.plans:manage", description: "Create and manage subscription plans" },
  { key: "billing.modules:read", description: "Read module billing catalog" },
  { key: "billing.modules:manage", description: "Manage module billing catalog" },
  { key: "billing.coupons:read", description: "Read coupons and discounts" },
  { key: "billing.coupons:manage", description: "Manage coupons and discounts" },
  { key: "billing.grants:manage", description: "Grant or revoke module access" },
  { key: "iftaTaxRates:read", description: "Read IFTA tax rates" },
  { key: "iftaTaxRates:write", description: "Create and edit IFTA tax rates" },
  { key: "iftaTaxRates:import", description: "Import IFTA tax rates" },
  { key: "ucr:read", description: "Read UCR filings" },
  { key: "ucr:read_own", description: "Read own UCR filings" },
  { key: "ucr:read_all", description: "Read all UCR filings" },
  { key: "ucr:create", description: "Create UCR filings" },
  { key: "ucr:update", description: "Update editable UCR filings" },
  { key: "ucr:update_own_draft", description: "Update own draft UCR filings" },
  { key: "ucr:checkout", description: "Start UCR checkout" },
  { key: "ucr:submit", description: "Submit UCR filings for review" },
  { key: "ucr:review", description: "Review UCR filings" },
  { key: "ucr:request_correction", description: "Request UCR filing corrections" },
  { key: "ucr:approve", description: "Approve and mark UCR filings compliant" },
  { key: "ucr:assign", description: "Assign UCR filings to staff" },
  { key: "ucr:process", description: "Process concierge UCR filings" },
  { key: "ucr:upload_receipt", description: "Upload official UCR receipts" },
  { key: "ucr:complete", description: "Complete UCR filings" },
  { key: "ucr:cancel", description: "Cancel UCR filings" },
  { key: "ucr:manage_rates", description: "Manage UCR annual rate brackets" },
  { key: "ucr:manage_settings", description: "Manage UCR concierge settings" },
  { key: "ucr:upload_documents", description: "Upload UCR filing documents" },
  { key: "dmv:read", description: "Read DMV registrations and renewals" },
  { key: "dmv:create", description: "Create DMV trucks, registrations, and renewals" },
  { key: "dmv:update", description: "Update DMV cases and requirements" },
  { key: "dmv:review", description: "Review DMV cases and request corrections" },
  { key: "dmv:approve", description: "Approve DMV cases and mark them active or completed" },
  { key: "dmv:manage_settings", description: "Manage DMV requirement templates and fee rules" },
  { key: "dmvRenewal:create", description: "Create DMV renewal requests" },
  { key: "dmvRenewal:read:own", description: "Read own DMV renewals" },
  { key: "dmvRenewal:update:own", description: "Update own DMV renewals" },
  { key: "dmvRenewal:approve:own", description: "Approve own DMV renewals" },
  { key: "dmvRenewal:read", description: "Read DMV renewal queue" },
  { key: "dmvRenewal:update", description: "Update DMV renewals" },
  { key: "dmvRenewal:assign", description: "Assign DMV renewals" },
  { key: "dmvRenewal:request_action", description: "Request client action on DMV renewals" },
  { key: "dmvRenewal:send_to_client", description: "Send DMV renewals back to client" },
  { key: "dmvRenewal:complete", description: "Complete DMV renewals" },
  { key: "dmvRenewal:cancel", description: "Cancel DMV renewals" },
  { key: "compliance2290:view", description: "View Form 2290 filings" },
  { key: "compliance2290:create", description: "Create Form 2290 filings" },
  { key: "compliance2290:update", description: "Update editable Form 2290 filings" },
  { key: "compliance2290:review", description: "Review Form 2290 filings" },
  { key: "compliance2290:approve", description: "Approve or mark Form 2290 filings as submitted" },
  { key: "compliance2290:request_correction", description: "Request Form 2290 corrections" },
  { key: "compliance2290:upload_schedule1", description: "Upload or attach Form 2290 Schedule 1 documents" },
  { key: "compliance2290:manage_settings", description: "Manage Form 2290 tax periods and rules" },

  // Staff

  //admin
  { key: "admin:access", description: "Access admin" },
  { key: "sandbox:access", description: "Access sandbox console" },
  { key: "sandbox:manage", description: "Manage sandbox console" },
  { key: "sandbox:reset", description: "Reset sandbox data" },
  { key: "sandbox:seed", description: "Load sandbox demo scenarios" },
  { key: "sandbox:impersonate", description: "Impersonate demo users in sandbox" },
  { key: "sandbox:logs:read", description: "Read sandbox audit logs" },
] as const;

// Mapa de permisos por rol (ajusta como quieras)
const ROLE_PERMISSIONS: Record<(typeof ROLES)[number]["name"], string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key), // todo
  TRUCKER: [
    "documents:read",
    "settings:read",
    "settings:update",
    "billing:read",
    "billing:manage",
    "payment_method:read",
    "payment_method:create",
    "ach_vault:read_masked",
    "ach_vault:create",
    "ach_vault:update",
    "ach_authorization:create",
    "ach_authorization:read",
    "ifta:read",
    "ifta:write",
    "ifta:sync",
    "eld:connect",
    "eld:sync",
    "truck:read",
    "truck:write",
    "reports:read",
    "reports:write",
    "reports:generate",
    "reports:download",
    "ucr:read",
    "ucr:read_own",
    "ucr:create",
    "ucr:update",
    "ucr:update_own_draft",
    "ucr:checkout",
    "ucr:submit",
    "ucr:upload_documents",
    "dmv:read",
    "dmv:create",
    "dmv:update",
    "dmvRenewal:create",
    "dmvRenewal:read:own",
    "dmvRenewal:update:own",
    "dmvRenewal:approve:own",
    "compliance2290:view",
    "compliance2290:create",
    "compliance2290:update",
    "compliance2290:upload_schedule1",
  ],
  STAFF: [
    "settings:read",
    "settings:update",
    "billing:read",
    "billing:manage",
    "payment_method:read",
    "ach_vault:read_masked",
    "ach_vault:read_full",
    "ach_vault:reveal_once",
    "ach_vault:use_for_manual_payment",
    "ach_authorization:read",
    "ifta:read",
    "ifta:write",
    "ifta:sync",
    "ifta:review",
    "ifta:approve",
    "ifta:settings",
    "eld:connect",
    "eld:sync",
    "reports:read",
    "reports:write",
    "reports:generate",
    "reports:download",
    "ucr:read",
    "ucr:read_all",
    "ucr:review",
    "ucr:request_correction",
    "ucr:approve",
    "ucr:assign",
    "ucr:process",
    "ucr:upload_receipt",
    "ucr:complete",
    "ucr:cancel",
    "ucr:upload_documents",
    "dmv:read",
    "dmv:create",
    "dmv:update",
    "dmv:review",
    "dmv:approve",
    "dmv:manage_settings",
    "dmvRenewal:read",
    "dmvRenewal:update",
    "dmvRenewal:assign",
    "dmvRenewal:request_action",
    "dmvRenewal:send_to_client",
    "dmvRenewal:complete",
    "dmvRenewal:cancel",
    "compliance2290:view",
    "compliance2290:create",
    "compliance2290:update",
    "compliance2290:review",
    "compliance2290:approve",
    "compliance2290:request_correction",
    "compliance2290:upload_schedule1",
  ],
  USER: [
    "profile:access",
    "profile:write",
    "dashboard:access",
    "settings:read",
    "settings:update",
    "billing:read",
    "billing:manage",
    "payment_method:read",
    "payment_method:create",
    "ach_vault:read_masked",
    "ach_vault:create",
    "ach_vault:update",
    "ach_authorization:create",
    "ach_authorization:read",
    "ucr:read",
    "ucr:read_own",
    "ucr:create",
    "ucr:update",
    "ucr:update_own_draft",
    "ucr:checkout",
    "ucr:submit",
    "ucr:upload_documents",
    "dmv:read",
    "dmv:create",
    "dmv:update",
    "dmvRenewal:create",
    "dmvRenewal:read:own",
    "dmvRenewal:update:own",
    "dmvRenewal:approve:own",
    "compliance2290:view",
    "compliance2290:create",
    "compliance2290:update",
    "compliance2290:upload_schedule1",
  ],
};

const BILLING_SETTINGS_ID = "default-billing-settings";

const APP_MODULES = [
  {
    slug: "ifta",
    name: "IFTA",
    description: "Fuel tax reporting and filing workflows.",
    requiresSubscription: false,
    isCore: false,
  },
  {
    slug: "ucr",
    name: "UCR",
    description: "Unified Carrier Registration compliance workflows.",
    requiresSubscription: false,
    isCore: false,
  },
  {
    slug: "2290",
    name: "2290",
    description: "HVUT Form 2290 compliance workflows.",
    requiresSubscription: false,
    isCore: false,
  },
  {
    slug: "dmv",
    name: "DMV Registration",
    description: "Registration and renewal workflows for DMV compliance.",
    requiresSubscription: false,
    isCore: false,
  },
  {
    slug: "documents",
    name: "Documents",
    description: "Shared document storage and retrieval.",
    requiresSubscription: false,
    isCore: true,
  },
  {
    slug: "reports",
    name: "Reports",
    description: "Cross-module reporting and exports.",
    requiresSubscription: false,
    isCore: false,
  },
] as const;

const BILLING_PLANS = [
  {
    code: "starter-monthly",
    name: "Starter Monthly",
    description: "Starter access for core collaboration and documents.",
    interval: SubscriptionInterval.MONTH,
    priceCents: 4900,
    currency: "USD",
    moduleSlugs: ["documents"],
  },
  {
    code: "pro-monthly",
    name: "Pro Monthly",
    description: "Expanded compliance tooling for growing fleets.",
    interval: SubscriptionInterval.MONTH,
    priceCents: 9900,
    currency: "USD",
    moduleSlugs: ["documents", "ifta", "ucr", "dmv", "reports"],
  },
  {
    code: "elite-monthly",
    name: "Elite Monthly",
    description: "Full compliance access across the current module suite.",
    interval: SubscriptionInterval.MONTH,
    priceCents: 14900,
    currency: "USD",
    moduleSlugs: ["documents", "ifta", "ucr", "2290", "dmv", "reports"],
  },
] as const;

const NEWS_UPDATES = [
  {
    id: "news-update-ifta-automation",
    eyebrow: "IFTA",
    title: "IFTA automation ready for the next quarter",
    description:
      "Sync ELD miles, review jurisdiction totals, resolve exceptions, and keep filing work moving from one dashboard.",
    cta: "Open IFTA",
    href: "/dashboard/ifta-v2",
    imageUrl: "/brand/truckers-unidos-logo.png",
    template: "MIXED",
    gradient: "linear-gradient(135deg, #002868 0%, #1a3f8f 100%)",
    audience: "ALL",
    sortOrder: 0,
  },
  {
    id: "news-update-ucr-concierge",
    eyebrow: "UCR",
    title: "UCR concierge workflow is live",
    description:
      "Customers can submit and pay while staff tracks assignments, receipts, corrections, and finalization in one place.",
    cta: "Review UCR",
    href: "/dashboard/ucr",
    imageUrl: "/brand/truckers-unidos-logo.png",
    template: "MIXED",
    gradient: "linear-gradient(135deg, #b22234 0%, #d94a5a 100%)",
    audience: "ALL",
    sortOrder: 1,
  },
  {
    id: "news-update-documents",
    eyebrow: "Documents",
    title: "Document history stays organized",
    description:
      "Uploaded receipts, permits, reports, and classified filing documents stay searchable across customer and staff views.",
    cta: "Browse docs",
    href: "/dashboard/documents",
    imageUrl: "/brand/truckers-unidos-logo.png",
    template: "MIXED",
    gradient: "linear-gradient(135deg, #002868 0%, #b22234 100%)",
    audience: "ALL",
    sortOrder: 2,
  },
] as const;

const SAMPLE_UCR_BRACKETS = [
  { minVehicles: 0, maxVehicles: 2, feeAmount: "46.00" },
  { minVehicles: 3, maxVehicles: 5, feeAmount: "138.00" },
  { minVehicles: 6, maxVehicles: 20, feeAmount: "276.00" },
  { minVehicles: 21, maxVehicles: 100, feeAmount: "963.00" },
  { minVehicles: 101, maxVehicles: 1000, feeAmount: "4592.00" },
  { minVehicles: 1001, maxVehicles: 1000000, feeAmount: "44710.00" },
] as const;

const DMV_REQUIREMENT_TEMPLATES: Array<{
  code: string;
  name: string;
  appliesToType?: DmvRegistrationType;
  isRequired?: boolean;
}> = [
  { code: "MC011_LICENSE_APPLICATION", name: "Licensing application" },
  { code: "MC003_VEHICLE_APPLICATION", name: "Vehicle application" },
  { code: "MC076_REGISTRANT_RESPONSIBILITIES", name: "Registrant / taxpayer responsibilities" },
  { code: "FEIN_PROOF", name: "FEIN proof" },
  { code: "TITLE_OR_OWNERSHIP", name: "Proof of ownership / title" },
  { code: "INSURANCE_CARD_NV", name: "Nevada insurance card" },
  { code: "VIN_INSPECTION_IF_APPLICABLE", name: "VIN inspection if applicable" },
  { code: "SALES_TAX_PROOF_IF_APPLICABLE", name: "Sales tax proof if applicable", isRequired: false },
  { code: "FORM_2290_IF_55000_PLUS", name: "Form 2290 for 55,000 lbs+ if applicable", isRequired: false },
  { code: "PRINCIPAL_DRIVER_LICENSE", name: "Principal current driver license" },
  {
    code: "MC006_MILEAGE_WEIGHT_APPLICATION",
    name: "Mileage / weight application",
    appliesToType: DmvRegistrationType.IRP,
  },
  {
    code: "MC004_APVD",
    name: "Apportioned vehicle declaration",
    appliesToType: DmvRegistrationType.IRP,
  },
  {
    code: "MC040_IRP_REGISTRATION_CERTIFICATION",
    name: "IRP registration certification",
    appliesToType: DmvRegistrationType.IRP,
  },
  {
    code: "DOT_PROOF",
    name: "DOT proof",
    appliesToType: DmvRegistrationType.IRP,
  },
  {
    code: "LEASE_LETTER_IF_APPLICABLE",
    name: "Lease letter if applicable",
    appliesToType: DmvRegistrationType.IRP,
    isRequired: false,
  },
  {
    code: "3X_NV_RESIDENCY_PROOFS",
    name: "Nevada residency / established place of business proofs",
    appliesToType: DmvRegistrationType.IRP,
  },
  {
    code: "PRIOR_JURISDICTION_MILEAGE_IF_RELOCATED",
    name: "Prior jurisdiction mileage if relocated",
    appliesToType: DmvRegistrationType.IRP,
    isRequired: false,
  },
] as const;

const DMV_SAMPLE_FEE_RULES: Array<{
  registrationType?: DmvRegistrationType;
  jurisdictionCode?: string;
  vehicleType?: TruckVehicleType;
  amount: string;
}> = [
  {
    registrationType: DmvRegistrationType.NEVADA_ONLY,
    vehicleType: TruckVehicleType.STRAIGHT_TRUCK,
    amount: "175.00",
  },
  {
    registrationType: DmvRegistrationType.NEVADA_ONLY,
    vehicleType: TruckVehicleType.SEMI_TRUCK,
    amount: "225.00",
  },
  {
    registrationType: DmvRegistrationType.IRP,
    jurisdictionCode: "NV",
    amount: "350.00",
  },
] as const;

async function upsertRoles() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }
}

async function upsertPermissions() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
  }
}

async function syncRolePermissions() {
  const roles = await prisma.role.findMany({ where: { name: { in: ROLES.map((r) => r.name) } } });
  const perms = await prisma.permission.findMany({ where: { key: { in: PERMISSIONS.map((p) => p.key) } } });

  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const permByKey = new Map(perms.map((p) => [p.key, p]));

  // Creamos relaciones (idempotente con upsert o createMany+skipDuplicates)
  // Recomendado: createMany con skipDuplicates (más rápido)
  const rows: { roleId: string; permissionId: string }[] = [];

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName);
    if (!role) continue;

    for (const key of keys) {
      const perm = permByKey.get(key);
      if (!perm) continue;

      rows.push({ roleId: role.id, permissionId: perm.id });
    }
  }

  // Si tu modelo RolePermission tiene unique compuesto (roleId, permissionId),
  // esto es 100% idempotente:
  await prisma.rolePermission.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

async function upsertJurisdictions() {
  for (const jurisdiction of US_JURISDICTIONS) {
    await prisma.jurisdiction.upsert({
      where: { code: jurisdiction.code },
      update: {
        name: jurisdiction.name,
        countryCode: jurisdiction.countryCode,
        isIftaMember: jurisdiction.isIftaMember,
        isActive: jurisdiction.isActive,
        sortOrder: jurisdiction.sortOrder,
      },
      create: {
        code: jurisdiction.code,
        name: jurisdiction.name,
        countryCode: jurisdiction.countryCode,
        isIftaMember: jurisdiction.isIftaMember,
        isActive: jurisdiction.isActive,
        sortOrder: jurisdiction.sortOrder,
      },
    });
  }
}

async function upsertAdminUser() {
  // Crear o actualizar el usuario admin
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: "Admin",
      // Si quieres NO cambiar la password si ya existe, comenta la línea siguiente:
      passwordHash,
    },
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      passwordHash,
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (!adminRole) throw new Error("ADMIN role not found after upsert");

  await prisma.userRole.createMany({
    data: [{ userId: admin.id, roleId: adminRole.id }],
    skipDuplicates: true,
  });

  return admin;
}

function buildOrganizationName(user: {
  name: string | null;
  email: string | null;
  companyProfile: {
    name: string | null;
    legalName: string | null;
    dbaName: string | null;
    companyName: string | null;
  } | null;
}) {
  return (
    user.companyProfile?.name ??
    user.companyProfile?.legalName ??
    user.companyProfile?.dbaName ??
    user.companyProfile?.companyName ??
    user.name ??
    user.email?.split("@")[0] ??
    "Default Company"
  );
}

async function ensureOrganizationsForAllUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      companyProfile: {
        select: {
          id: true,
          name: true,
          legalName: true,
          dbaName: true,
          companyName: true,
        },
      },
    },
  });

  for (const user of users) {
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
    });

    let organizationId = existingMembership?.organizationId ?? user.companyProfile?.id ?? null;

    if (!organizationId) {
      const organization = await prisma.companyProfile.create({
        data: {
          userId: user.id,
          name: buildOrganizationName(user),
          companyName: buildOrganizationName(user),
        },
        select: { id: true },
      });

      organizationId = organization.id;
    }

    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      update: { role: "OWNER" },
      create: {
        organizationId,
        userId: user.id,
        role: "OWNER",
      },
    });

    if (user.companyProfile && user.companyProfile.id === organizationId) {
      await prisma.companyProfile.update({
        where: { id: user.companyProfile.id },
        data: {
          name: user.companyProfile.name ?? buildOrganizationName(user),
          companyName: user.companyProfile.companyName ?? buildOrganizationName(user),
        },
      });
    }

    await prisma.paymentMethod.updateMany({
      where: {
        userId: user.id,
        organizationId: null,
      },
      data: { organizationId },
    });
  }
}

async function upsertBillingSettings() {
  await prisma.billingSettings.upsert({
    where: { id: BILLING_SETTINGS_ID },
    update: {
      subscriptionsEnabled: false,
      subscriptionsRequired: false,
      allowStripe: true,
      allowPaypal: true,
      allowCoupons: true,
      allowGiftSubscriptions: true,
      defaultGracePeriodDays: 3,
    },
    create: {
      id: BILLING_SETTINGS_ID,
      subscriptionsEnabled: false,
      subscriptionsRequired: false,
      allowStripe: true,
      allowPaypal: true,
      allowCoupons: true,
      allowGiftSubscriptions: true,
      defaultGracePeriodDays: 3,
    },
  });
}

async function upsertBillingCatalog() {
  for (const appModule of APP_MODULES) {
    await prisma.appModule.upsert({
      where: { slug: appModule.slug },
      update: {
        name: appModule.name,
        description: appModule.description,
        requiresSubscription: appModule.requiresSubscription,
        isCore: appModule.isCore,
        isActive: true,
      },
      create: {
        slug: appModule.slug,
        name: appModule.name,
        description: appModule.description,
        requiresSubscription: appModule.requiresSubscription,
        isCore: appModule.isCore,
        isActive: true,
      },
    });
  }

  const modules = await prisma.appModule.findMany({
    where: {
      slug: { in: APP_MODULES.map((module) => module.slug) },
    },
    select: { id: true, slug: true },
  });
  const moduleIdBySlug = new Map(modules.map((module) => [module.slug, module.id]));

  for (const plan of BILLING_PLANS) {
    const savedPlan = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        priceCents: plan.priceCents,
        currency: plan.currency,
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        priceCents: plan.priceCents,
        currency: plan.currency,
        isActive: true,
      },
      select: { id: true },
    });

    await prisma.planModule.deleteMany({
      where: { planId: savedPlan.id },
    });

    const moduleIds = plan.moduleSlugs
      .map((slug) => moduleIdBySlug.get(slug))
      .filter((value): value is string => Boolean(value));

    if (moduleIds.length > 0) {
      await prisma.planModule.createMany({
        data: moduleIds.map((moduleId) => ({
          planId: savedPlan.id,
          moduleId,
        })),
        skipDuplicates: true,
      });
    }
  }
}

async function upsertNewsUpdates() {
  for (const update of NEWS_UPDATES) {
    await prisma.newsUpdate.upsert({
      where: { id: update.id },
      update: {
        eyebrow: update.eyebrow,
        title: update.title,
        description: update.description,
        cta: update.cta,
        href: update.href,
        imageUrl: update.imageUrl,
        template: update.template,
        gradient: update.gradient,
        audience: update.audience,
        isActive: true,
        sortOrder: update.sortOrder,
      },
      create: {
        id: update.id,
        eyebrow: update.eyebrow,
        title: update.title,
        description: update.description,
        cta: update.cta,
        href: update.href,
        imageUrl: update.imageUrl,
        template: update.template,
        gradient: update.gradient,
        audience: update.audience,
        isActive: true,
        sortOrder: update.sortOrder,
      },
    });
  }
}

async function upsertSampleUcrBrackets() {
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];

  for (const year of years) {
    for (const bracket of SAMPLE_UCR_BRACKETS) {
      await prisma.uCRRateBracket.upsert({
        where: {
          year_minVehicles_maxVehicles: {
            year,
            minVehicles: bracket.minVehicles,
            maxVehicles: bracket.maxVehicles,
          },
        },
        update: {
          feeAmount: new Prisma.Decimal(bracket.feeAmount),
          active: true,
        },
        create: {
          year,
          minVehicles: bracket.minVehicles,
          maxVehicles: bracket.maxVehicles,
          feeAmount: new Prisma.Decimal(bracket.feeAmount),
          active: true,
        },
      });
    }
  }
}

async function upsertForm2290Defaults() {
  await prisma.form2290Setting.upsert({
    where: { id: "default-form2290-settings" },
    update: {
      minimumEligibleWeight: 55000,
      expirationWarningDays: 30,
    },
    create: {
      id: "default-form2290-settings",
      minimumEligibleWeight: 55000,
      expirationWarningDays: 30,
    },
  });

  await prisma.form2290TaxPeriod.updateMany({
    where: {
      NOT: { id: "form2290-tax-period-2025-2026" },
      isActive: true,
    },
    data: { isActive: false },
  });

  await prisma.form2290TaxPeriod.upsert({
    where: { id: "form2290-tax-period-2025-2026" },
    update: {
      name: "2025-2026",
      startDate: new Date("2025-07-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T23:59:59.999Z"),
      filingDeadline: new Date("2025-08-31T23:59:59.999Z"),
      isActive: true,
    },
    create: {
      id: "form2290-tax-period-2025-2026",
      name: "2025-2026",
      startDate: new Date("2025-07-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T23:59:59.999Z"),
      filingDeadline: new Date("2025-08-31T23:59:59.999Z"),
      isActive: true,
    },
  });
}

async function upsertDmvRequirementTemplates() {
  for (const [index, template] of DMV_REQUIREMENT_TEMPLATES.entries()) {
    await prisma.dmvRequirementTemplate.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        appliesToType: template.appliesToType ?? null,
        appliesToInitial: true,
        appliesToRenewal: true,
        isRequired: template.isRequired ?? true,
        active: true,
        sortOrder: index,
      },
      create: {
        code: template.code,
        name: template.name,
        appliesToType: template.appliesToType ?? null,
        appliesToInitial: true,
        appliesToRenewal: true,
        isRequired: template.isRequired ?? true,
        active: true,
        sortOrder: index,
      },
    });
  }
}

async function upsertDmvFeeRules() {
  for (const [index, rule] of DMV_SAMPLE_FEE_RULES.entries()) {
    await prisma.dmvFeeRule.upsert({
      where: { id: `dmv-fee-rule-${index + 1}` },
      update: {
        registrationType: rule.registrationType ?? null,
        jurisdictionCode: rule.jurisdictionCode ?? null,
        vehicleType: rule.vehicleType ?? null,
        amount: new Prisma.Decimal(rule.amount),
        active: true,
      },
      create: {
        id: `dmv-fee-rule-${index + 1}`,
        registrationType: rule.registrationType ?? null,
        jurisdictionCode: rule.jurisdictionCode ?? null,
        vehicleType: rule.vehicleType ?? null,
        amount: new Prisma.Decimal(rule.amount),
        active: true,
      },
    });
  }
}

async function main() {
  console.log("🌱 Seeding RBAC...");

  await upsertRoles();
  await upsertPermissions();
  await syncRolePermissions();
  await upsertJurisdictions();
  await upsertSampleUcrBrackets();
  await upsertForm2290Defaults();
  await upsertDmvRequirementTemplates();
  await upsertDmvFeeRules();
  await seedIftaJurisdictionProcedures(prisma);

  const admin = await upsertAdminUser();
  await ensureOrganizationsForAllUsers();
  await upsertBillingSettings();
  await upsertBillingCatalog();
  await upsertNewsUpdates();

  console.log("✅ Seed completed.");
  console.log(`👤 Admin: ${admin.email}`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD} (set via SEED_ADMIN_PASSWORD env var)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
