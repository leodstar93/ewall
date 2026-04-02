import {
  DmvRegistrationType,
  DmvRegistrationStatus,
  FuelType,
  Form2290Status,
  Prisma,
  Quarter,
  ReportStatus,
  TruckOperationType,
  TruckVehicleType,
  UCREntityType,
  UCRFilingStatus,
} from "@prisma/client";
import { US_JURISDICTIONS } from "@/features/ifta/constants/us-jurisdictions";
import type { DbClient, ServiceContext } from "@/lib/db/types";
import { createUcrFiling } from "@/services/ucr/createUcrFiling";
import { calculateIftaReport } from "@/services/ifta/calculateReport";
import { createIftaReport } from "@/services/ifta/createIftaReport";
import { create2290Filing } from "@/services/form2290/create2290Filing";
import { createRegistration } from "@/services/dmv/createRegistration";
import { updateRegistrationStatus } from "@/services/dmv/updateRegistrationStatus";

const SANDBOX_ROLES = [
  { name: "ADMIN", description: "Sandbox internal admin" },
  { name: "STAFF", description: "Sandbox operations staff" },
  { name: "TRUCKER", description: "Sandbox client role" },
  { name: "USER", description: "Sandbox basic user" },
] as const;

const SANDBOX_PERMISSIONS = [
  { key: "sandbox:access", description: "Access sandbox console" },
  { key: "sandbox:manage", description: "Manage sandbox console" },
  { key: "sandbox:reset", description: "Reset sandbox data" },
  { key: "sandbox:seed", description: "Load sandbox scenarios" },
  { key: "sandbox:impersonate", description: "Start or stop sandbox impersonation" },
  { key: "sandbox:logs:read", description: "Read sandbox audit logs" },
  { key: "settings:read", description: "Read account settings" },
  { key: "settings:update", description: "Update account settings" },
  { key: "billing:manage", description: "Manage billing methods" },
  { key: "payment_method:read", description: "Read saved payment methods" },
  { key: "payment_method:create", description: "Create saved payment methods" },
  { key: "ach_vault:read_masked", description: "Read masked ACH vault details" },
  { key: "ach_vault:read_full", description: "Read full ACH vault details" },
  { key: "ach_vault:create", description: "Create ACH vault records" },
  { key: "ach_vault:update", description: "Update ACH vault records" },
  { key: "ach_vault:reveal_once", description: "Reveal full ACH vault data once with a reason" },
  { key: "ach_vault:use_for_manual_payment", description: "Use ACH vault records for manual filing payments" },
  { key: "ach_authorization:create", description: "Create ACH authorization records" },
  { key: "ach_authorization:read", description: "Read ACH authorization records" },
  { key: "financial_audit:read", description: "Read financial access audit logs" },
  { key: "ucr:create", description: "Create UCR filings" },
  { key: "ucr:read", description: "Read UCR filings" },
  { key: "ifta:read", description: "Read IFTA reports" },
  { key: "ifta:write", description: "Write IFTA reports" },
  { key: "dmv:read", description: "Read DMV registrations" },
  { key: "dmv:create", description: "Create DMV registrations" },
  { key: "dmv:update", description: "Update DMV registrations" },
  { key: "dmv:review", description: "Review DMV registrations" },
  { key: "dmv:approve", description: "Approve DMV registrations" },
] as const;

const SANDBOX_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: SANDBOX_PERMISSIONS.map((permission) => permission.key),
  STAFF: [
    "settings:read",
    "settings:update",
    "billing:manage",
    "payment_method:read",
    "ach_vault:read_masked",
    "ach_vault:read_full",
    "ach_vault:reveal_once",
    "ach_vault:use_for_manual_payment",
    "ach_authorization:read",
    "financial_audit:read",
    "ucr:read",
    "ifta:read",
    "dmv:read",
    "dmv:update",
    "dmv:review",
    "dmv:approve",
  ],
  TRUCKER: [
    "settings:read",
    "settings:update",
    "billing:manage",
    "payment_method:read",
    "payment_method:create",
    "ach_vault:read_masked",
    "ach_vault:create",
    "ach_vault:update",
    "ach_authorization:create",
    "ach_authorization:read",
    "ucr:create",
    "ucr:read",
    "ifta:read",
    "ifta:write",
    "dmv:read",
    "dmv:create",
    "dmv:update",
  ],
  USER: [
    "settings:read",
    "settings:update",
    "billing:manage",
    "payment_method:read",
    "payment_method:create",
    "ach_vault:read_masked",
    "ach_vault:create",
    "ach_vault:update",
    "ach_authorization:create",
    "ach_authorization:read",
  ],
};

const SANDBOX_DEMO_USERS = [
  {
    email: "superadmin.demo@yourapp.com",
    name: "SANDBOX_ADMIN",
    roleNames: ["ADMIN"],
  },
  {
    email: "staff.demo@yourapp.com",
    name: "STAFF_DEMO",
    roleNames: ["STAFF"],
  },
  {
    email: "client.demo@yourapp.com",
    name: "CLIENT_DEMO",
    roleNames: ["TRUCKER"],
  },
] as const;

const SANDBOX_UCR_BRACKETS = [
  { minVehicles: 0, maxVehicles: 2, feeAmount: "46.00" },
  { minVehicles: 3, maxVehicles: 5, feeAmount: "138.00" },
  { minVehicles: 6, maxVehicles: 20, feeAmount: "276.00" },
  { minVehicles: 21, maxVehicles: 100, feeAmount: "963.00" },
  { minVehicles: 101, maxVehicles: 1000, feeAmount: "4592.00" },
  { minVehicles: 1001, maxVehicles: 1000000, feeAmount: "44710.00" },
] as const;

const SANDBOX_DMV_REQUIREMENT_TEMPLATES: Array<{
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
];

const SANDBOX_DMV_SAMPLE_FEE_RULES: Array<{
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

export const SANDBOX_SCENARIO_DEFINITIONS = [
  {
    key: "ucr_needs_correction",
    name: "UCR needs correction",
    description: "Client filing ready for QA on correction workflow.",
    moduleKey: "ucr",
  },
  {
    key: "ifta_under_review",
    name: "IFTA under review",
    description: "Quarterly IFTA report with calculated lines awaiting staff review.",
    moduleKey: "ifta",
  },
  {
    key: "2290_submitted",
    name: "2290 submitted",
    description: "Heavy vehicle filing submitted with support docs for sandbox walkthroughs.",
    moduleKey: "2290",
  },
  {
    key: "dmv_registration_under_review",
    name: "DMV registration under review",
    description: "DMV registration seeded in review for internal QA and walkthroughs.",
    moduleKey: "dmv",
  },
  // TODO: add IRP, Documents, and compliance dashboard scenarios.
] as const;

function assertSandboxEnvironment(environment: string) {
  if (environment !== "sandbox") {
    throw new Error("INVALID_ENVIRONMENT");
  }
}

async function ensureRolesAndPermissions(db: DbClient) {
  for (const role of SANDBOX_ROLES) {
    await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  for (const permission of SANDBOX_PERMISSIONS) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  const roles = await db.role.findMany({
    where: { name: { in: SANDBOX_ROLES.map((role) => role.name) } },
    select: { id: true, name: true },
  });
  const permissions = await db.permission.findMany({
    where: { key: { in: SANDBOX_PERMISSIONS.map((permission) => permission.key) } },
    select: { id: true, key: true },
  });

  const roleByName = new Map(roles.map((role) => [role.name, role.id]));
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.key, permission.id]),
  );

  await db.rolePermission.createMany({
    data: Object.entries(SANDBOX_ROLE_PERMISSIONS).flatMap(([roleName, keys]) =>
      keys.flatMap((key) => {
        const roleId = roleByName.get(roleName);
        const permissionId = permissionByKey.get(key);

        return roleId && permissionId ? [{ roleId, permissionId }] : [];
      }),
    ),
    skipDuplicates: true,
  });
}

async function ensureJurisdictions(db: DbClient) {
  for (const jurisdiction of US_JURISDICTIONS) {
    await db.jurisdiction.upsert({
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

async function ensureUcrBrackets(db: DbClient) {
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1];

  for (const year of years) {
    for (const bracket of SANDBOX_UCR_BRACKETS) {
      await db.uCRRateBracket.upsert({
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

async function ensureIftaTaxRates(db: DbClient) {
  const jurisdictions = await db.jurisdiction.findMany({
    where: { code: { in: ["AZ", "CA", "NV"] } },
    select: { id: true, code: true },
  });

  const rates = new Map([
    ["AZ", "0.2600"],
    ["CA", "0.3950"],
    ["NV", "0.2700"],
  ]);

  const year = new Date().getFullYear();
  for (const jurisdiction of jurisdictions) {
    const taxRate = rates.get(jurisdiction.code);
    if (!taxRate) continue;

    for (const quarter of [Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4]) {
      await db.iftaTaxRate.upsert({
        where: {
          jurisdictionId_year_quarter_fuelType: {
            jurisdictionId: jurisdiction.id,
            year,
            quarter,
            fuelType: FuelType.DI,
          },
        },
        update: {
          taxRate: new Prisma.Decimal(taxRate),
          source: "sandbox-seed",
          notes: "Sandbox fixture rate",
        },
        create: {
          jurisdictionId: jurisdiction.id,
          year,
          quarter,
          fuelType: FuelType.DI,
          taxRate: new Prisma.Decimal(taxRate),
          source: "sandbox-seed",
          notes: "Sandbox fixture rate",
        },
      });
    }
  }
}

async function ensureForm2290BaseData(db: DbClient) {
  await db.form2290Setting.createMany({
    data: [
      {
        minimumEligibleWeight: 55000,
        expirationWarningDays: 30,
      },
    ],
    skipDuplicates: true,
  });

  const currentYear = new Date().getFullYear();
  const taxPeriodStart = new Date(Date.UTC(currentYear, 6, 1));
  const taxPeriodEnd = new Date(Date.UTC(currentYear + 1, 5, 30));
  const filingDeadline = new Date(Date.UTC(currentYear, 7, 31));

  const existingActive = await db.form2290TaxPeriod.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  await db.form2290TaxPeriod.create({
    data: {
      name: `${currentYear}-${currentYear + 1} HVUT`,
      startDate: taxPeriodStart,
      endDate: taxPeriodEnd,
      filingDeadline,
      isActive: !existingActive,
    },
  }).catch(() => null);
}

async function ensureDmvBaseData(db: DbClient) {
  for (const [index, template] of SANDBOX_DMV_REQUIREMENT_TEMPLATES.entries()) {
    await db.dmvRequirementTemplate.upsert({
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

  for (const rule of SANDBOX_DMV_SAMPLE_FEE_RULES) {
    const existing = await db.dmvFeeRule.findFirst({
      where: {
        registrationType: rule.registrationType ?? null,
        jurisdictionCode: rule.jurisdictionCode ?? null,
        vehicleType: rule.vehicleType ?? null,
        amount: new Prisma.Decimal(rule.amount),
        active: true,
      },
      select: { id: true },
    });

    if (!existing) {
      await db.dmvFeeRule.create({
        data: {
          registrationType: rule.registrationType ?? null,
          jurisdictionCode: rule.jurisdictionCode ?? null,
          vehicleType: rule.vehicleType ?? null,
          amount: new Prisma.Decimal(rule.amount),
          active: true,
        },
      });
    }
  }
}

async function ensureDemoUsers(db: DbClient) {
  const roles = await db.role.findMany({
    where: { name: { in: SANDBOX_ROLES.map((role) => role.name) } },
    select: { id: true, name: true },
  });
  const roleByName = new Map(roles.map((role) => [role.name, role.id]));

  for (const demoUser of SANDBOX_DEMO_USERS) {
    const user = await db.user.upsert({
      where: { email: demoUser.email },
      update: {
        name: demoUser.name,
        passwordHash: null,
      },
      create: {
        email: demoUser.email,
        name: demoUser.name,
        passwordHash: null,
      },
      select: { id: true },
    });

    await db.userRole.createMany({
      data: demoUser.roleNames.flatMap((roleName) => {
        const roleId = roleByName.get(roleName);
        return roleId ? [{ userId: user.id, roleId }] : [];
      }),
      skipDuplicates: true,
    });
  }
}

export async function upsertSandboxScenarioCatalog(db: DbClient) {
  for (const scenario of SANDBOX_SCENARIO_DEFINITIONS) {
    await db.sandboxScenario.upsert({
      where: { key: scenario.key },
      update: {
        name: scenario.name,
        description: scenario.description,
        moduleKey: scenario.moduleKey,
        isActive: true,
      },
      create: {
        key: scenario.key,
        name: scenario.name,
        description: scenario.description,
        moduleKey: scenario.moduleKey,
        isActive: true,
      },
    });
  }
}

export async function ensureSandboxBaseData(db: DbClient) {
  await ensureRolesAndPermissions(db);
  await ensureJurisdictions(db);
  await ensureUcrBrackets(db);
  await ensureIftaTaxRates(db);
  await ensureForm2290BaseData(db);
  await ensureDmvBaseData(db);
  await ensureDemoUsers(db);
  await upsertSandboxScenarioCatalog(db);
}

export async function listSandboxDemoUsers(db: DbClient) {
  return db.user.findMany({
    where: {
      email: {
        in: SANDBOX_DEMO_USERS.map((user) => user.email),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { email: "asc" },
  });
}

export async function clearSandboxData(db: DbClient) {
  await db.sandboxImpersonationSession.updateMany({
    where: { isActive: true },
    data: {
      isActive: false,
      endedAt: new Date(),
    },
  });

  await db.notification.deleteMany();
  await db.dmvRenewalDocument.deleteMany();
  await db.dmvRegistrationDocument.deleteMany();
  await db.dmvRequirementSnapshot.deleteMany();
  await db.dmvRegistrationJurisdiction.deleteMany();
  await db.dmvActivity.deleteMany();
  await db.dmvRenewal.deleteMany();
  await db.dmvRegistration.deleteMany();
  await db.form2290ActivityLog.deleteMany();
  await db.form2290Correction.deleteMany();
  await db.form2290Document.deleteMany();
  await db.form2290Filing.deleteMany();
  await db.iftaReportLine.deleteMany();
  await db.tripMileage.deleteMany();
  await db.trip.deleteMany();
  await db.fuelPurchase.deleteMany();
  await db.iftaReport.deleteMany();
  await db.uCRDocument.deleteMany();
  await db.uCRFiling.deleteMany();
  await db.document.deleteMany();
  await db.truck.deleteMany();
  await db.iftaTaxRateImportRun.deleteMany();
  await db.iftaTaxRate.deleteMany();
  await db.uCRRateBracket.deleteMany();
  await db.form2290TaxPeriod.deleteMany();
  await db.form2290Setting.deleteMany();
  await db.dmvFeeRule.deleteMany();
  await db.dmvRequirementTemplate.deleteMany();
  await db.jurisdiction.deleteMany();
  await db.userRole.deleteMany();
  await db.rolePermission.deleteMany();
  await db.account.deleteMany();
  await db.session.deleteMany();
  await db.verificationToken.deleteMany();
  await db.user.deleteMany();
  await db.permission.deleteMany();
  await db.role.deleteMany();
  await db.sandboxScenario.deleteMany();
}

async function seedUcrNeedsCorrectionScenario(ctx: ServiceContext) {
  const clientDemo = await ctx.db.user.findUniqueOrThrow({
    where: { email: "client.demo@yourapp.com" },
    select: { id: true },
  });

  const filing = await createUcrFiling(
    { db: ctx.db },
    {
      userId: clientDemo.id,
      filingYear: new Date().getFullYear(),
      legalName: "Client Demo Logistics LLC",
      usdotNumber: "USDOT1234567",
      mcNumber: "MC7654321",
      fein: "12-3456789",
      baseState: "NV",
      entityType: UCREntityType.MOTOR_CARRIER,
      interstateOperation: true,
      fleetSize: 12,
      clientNotes: "Sandbox scenario seeded for correction workflow.",
    },
  );

  const updated = await ctx.db.uCRFiling.update({
    where: { id: filing.id },
    data: {
      status: UCRFilingStatus.CORRECTION_REQUESTED,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      reviewStartedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      correctionRequestedAt: new Date(),
      correctionNote: "Please upload a corrected payment receipt and confirm fleet size.",
      staffNotes: "Sandbox QA scenario: correction requested.",
    },
    select: {
      id: true,
      status: true,
      filingYear: true,
    },
  });

  return {
    entityType: "UCRFiling",
    entityId: updated.id,
    metadata: {
      scenarioKey: "ucr_needs_correction",
      status: updated.status,
      filingYear: updated.filingYear,
    } satisfies Prisma.InputJsonValue,
  };
}

async function seedIftaUnderReviewScenario(ctx: ServiceContext) {
  const clientDemo = await ctx.db.user.findUniqueOrThrow({
    where: { email: "client.demo@yourapp.com" },
    select: { id: true },
  });

  const truck = await ctx.db.truck.create({
    data: {
      userId: clientDemo.id,
      unitNumber: "SBX-101",
      nickname: "Demo Fleet 101",
      plateNumber: "SANDBX1",
      vin: `SANDBOXVIN${Date.now()}`,
      make: "Freightliner",
      model: "Cascadia",
      year: 2024,
      grossWeight: 80000,
      axleCount: 5,
      isActive: true,
      isInterstate: true,
      operationType: TruckOperationType.INTERSTATE,
    },
    select: { id: true },
  });

  const report = await createIftaReport(
    { db: ctx.db },
    {
      userId: clientDemo.id,
      truckId: truck.id,
      year: new Date().getFullYear(),
      quarter: Quarter.Q1,
      fuelType: FuelType.DI,
      notes: "Sandbox IFTA review scenario.",
    },
  );

  const jurisdictions = await ctx.db.jurisdiction.findMany({
    where: { code: { in: ["AZ", "CA", "NV"] } },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  await ctx.db.iftaReportLine.createMany({
    data: jurisdictions.map((jurisdiction, index) => ({
      reportId: report.id,
      jurisdictionId: jurisdiction.id,
      fuelType: FuelType.DI,
      taxRate: new Prisma.Decimal("0"),
      miles: new Prisma.Decimal(index === 0 ? "540.25" : index === 1 ? "402.75" : "618.10"),
      paidGallons: new Prisma.Decimal(index === 0 ? "72.40" : index === 1 ? "51.30" : "81.90"),
      sortOrder: index,
    })),
    skipDuplicates: true,
  });

  await calculateIftaReport({ db: ctx.db, reportId: report.id });

  const updated = await ctx.db.iftaReport.update({
    where: { id: report.id },
    data: {
      status: ReportStatus.PENDING_STAFF_REVIEW,
      submittedForReviewAt: new Date(),
    },
    select: {
      id: true,
      status: true,
      year: true,
      quarter: true,
    },
  });

  return {
    entityType: "IftaReport",
    entityId: updated.id,
    metadata: {
      scenarioKey: "ifta_under_review",
      status: updated.status,
      year: updated.year,
      quarter: updated.quarter,
    } satisfies Prisma.InputJsonValue,
  };
}

async function seed2290SubmittedScenario(ctx: ServiceContext) {
  const clientDemo = await ctx.db.user.findUniqueOrThrow({
    where: { email: "client.demo@yourapp.com" },
    select: { id: true },
  });

  const activeTaxPeriod = await ctx.db.form2290TaxPeriod.findFirst({
    where: { isActive: true },
    select: { id: true, endDate: true },
    orderBy: { createdAt: "asc" },
  });

  if (!activeTaxPeriod) {
    throw new Error("TAX_PERIOD_NOT_FOUND");
  }

  const truck = await ctx.db.truck.create({
    data: {
      userId: clientDemo.id,
      unitNumber: "2290-SBX-1",
      nickname: "HVUT Demo Unit",
      plateNumber: "HVUTSBX",
      vin: `2290SANDBOXVIN${Date.now()}`,
      make: "Peterbilt",
      model: "579",
      year: new Date().getFullYear(),
      grossWeight: 80000,
      axleCount: 5,
      isActive: true,
      isInterstate: true,
      operationType: TruckOperationType.INTERSTATE,
      is2290Eligible: true,
    },
    select: { id: true },
  });

  const filing = await create2290Filing({
    db: ctx.db,
    actorUserId: clientDemo.id,
    canManageAll: false,
    truckId: truck.id,
    taxPeriodId: activeTaxPeriod.id,
    firstUsedMonth: 7,
    firstUsedYear: new Date().getFullYear(),
    notes: "Sandbox Form 2290 scenario seeded for demo walkthroughs.",
  });

  const updated = await ctx.db.form2290Filing.update({
    where: { id: filing.id },
    data: {
      status: Form2290Status.SUBMITTED,
      filedAt: new Date(),
      amountDue: new Prisma.Decimal("550.00"),
    },
    select: {
      id: true,
      status: true,
      taxPeriodId: true,
    },
  });

  return {
    entityType: "Form2290Filing",
    entityId: updated.id,
    metadata: {
      scenarioKey: "2290_submitted",
      status: updated.status,
      taxPeriodId: updated.taxPeriodId,
    } satisfies Prisma.InputJsonValue,
  };
}

async function seedDmvRegistrationUnderReviewScenario(ctx: ServiceContext) {
  const clientDemo = await ctx.db.user.findUniqueOrThrow({
    where: { email: "client.demo@yourapp.com" },
    select: { id: true },
  });

  const truck = await ctx.db.truck.create({
    data: {
      userId: clientDemo.id,
      unitNumber: "DMV-SBX-1",
      nickname: "DMV Demo Unit",
      plateNumber: "DMVSBX1",
      statePlate: "NV",
      vin: `DMVSANDBOXVIN${Date.now()}`,
      make: "Kenworth",
      model: "T680",
      year: new Date().getFullYear(),
      grossWeight: 68000,
      axleCount: 5,
      isActive: true,
      isInterstate: false,
      operationType: TruckOperationType.INTRASTATE,
      is2290Eligible: true,
    },
    select: { id: true },
  });

  const registration = await createRegistration({
    db: ctx.db,
    truckId: truck.id,
    actorUserId: clientDemo.id,
    canManageAll: false,
    registrationType: DmvRegistrationType.NEVADA_ONLY,
    effectiveDate: new Date(),
    expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
    dotNumber: "USDOT7654321",
    fein: "98-7654321",
    nevadaAddress: "123 Sandbox Ave, Las Vegas, NV",
    jurisdictions: [{ jurisdictionCode: "NV" }],
  });

  const updated = await updateRegistrationStatus({
    db: ctx.db,
    registrationId: registration.id,
    nextStatus: DmvRegistrationStatus.UNDER_REVIEW,
    actorUserId: clientDemo.id,
    canManageAll: false,
  });

  return {
    entityType: "DmvRegistration",
    entityId: updated.id,
    metadata: {
      scenarioKey: "dmv_registration_under_review",
      status: updated.status,
      truckId: updated.truckId,
    } satisfies Prisma.InputJsonValue,
  };
}

export async function seedSandboxScenario(ctx: ServiceContext, scenarioKey: string) {
  assertSandboxEnvironment(ctx.environment);

  switch (scenarioKey) {
    case "ucr_needs_correction":
      return seedUcrNeedsCorrectionScenario(ctx);
    case "ifta_under_review":
      return seedIftaUnderReviewScenario(ctx);
    case "2290_submitted":
      return seed2290SubmittedScenario(ctx);
    case "dmv_registration_under_review":
      return seedDmvRegistrationUnderReviewScenario(ctx);
    default:
      throw new Error("SCENARIO_NOT_FOUND");
  }
}

export function assertSandboxOnly(ctx: Pick<ServiceContext, "environment">) {
  assertSandboxEnvironment(ctx.environment);
}
