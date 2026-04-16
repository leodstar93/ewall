import { Prisma } from "@prisma/client";
import { is2290Eligible } from "@/lib/form2290-workflow";
import { prisma } from "@/lib/prisma";
import { getForm2290Settings } from "@/services/form2290/shared";
import { getCustomerBillingOverview } from "./billing.service";
import {
  getCompanyProfile,
  type CompanyProfileInput,
  type CompanyProfileRecord,
  upsertCompanyProfile,
} from "./company.service";
import {
  getEldProviderCredential,
  type EldProviderCredentialInput,
  type EldProviderCredentialRecord,
  upsertEldProviderCredential,
} from "./eld-provider.service";
import { listPaymentMethods, type PaymentMethodRecord } from "./payment.service";
import { SettingsValidationError } from "./settings-errors";
import {
  getPersonalInfo,
  type PersonalInfoInput,
  type PersonalInfoRecord,
  updatePersonalInfo,
} from "./user.service";

export type TruckerDirectoryFilter =
  | "all"
  | "missing-personal"
  | "missing-company"
  | "needs-review"
  | "ready";

export type TruckerDirectorySort = "recent" | "name" | "company";

export type TruckerDirectoryItem = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  companyName: string;
  dotNumber: string;
  mcNumber: string;
  phone: string;
  state: string;
  trucksCount: number;
  filingCount: number;
  missingPersonal: boolean;
  missingCompany: boolean;
  needsReview: boolean;
  ready: boolean;
  roles: string[];
};

export type ManagedTruckerProfile = {
  id: string;
  personal: PersonalInfoRecord;
  company: CompanyProfileRecord;
  eldProvider: EldProviderCredentialRecord;
  payments: PaymentMethodRecord[];
  billing: {
    subscriptionsEnabled: boolean;
    organizationName: string;
    subscription: null | {
      status: string;
      provider: string;
      planName: string;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      lastPaymentError: string;
    };
    includedModules: Array<{
      id: string;
      slug: string;
      name: string;
      accessSource: string | null;
    }>;
    blockedPremiumModules: Array<{
      id: string;
      slug: string;
      name: string;
      blockedReason: string;
    }>;
  };
  trucks: Array<{
    id: string;
    unitNumber: string;
    nickname: string | null;
    plateNumber: string | null;
    vin: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    grossWeight: number | null;
    isActive: boolean;
    is2290Eligible: boolean;
    createdAt: string;
    updatedAt: string;
    counts: {
      trips: number;
      fuelPurchases: number;
      iftaReports: number;
      form2290Filings: number;
    };
  }>;
  documents: Array<{
    id: string;
    name: string;
    description: string | null;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  roles: string[];
  stats: {
    trucksCount: number;
    iftaReportsCount: number;
    ucrFilingsCount: number;
    form2290FilingsCount: number;
    dmvRegistrationsCount: number;
    dmvRenewalCasesCount: number;
  };
  profileState: {
    missingPersonal: boolean;
    missingCompany: boolean;
    needsReview: boolean;
    ready: boolean;
  };
};

export type ManagedTruckerProfileUpdateInput = {
  personal?: PersonalInfoInput | null;
  company?: CompanyProfileInput | null;
  eldProvider?: EldProviderCredentialInput | null;
};

export type ManagedTruckerTruckInput = {
  unitNumber?: unknown;
  nickname?: unknown;
  plateNumber?: unknown;
  vin?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
  grossWeight?: unknown;
};

const truckerDirectorySelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  userProfile: {
    select: {
      phone: true,
      address: true,
      city: true,
      state: true,
      zip: true,
    },
  },
  companyProfile: {
    select: {
      legalName: true,
      dbaName: true,
      companyName: true,
      dotNumber: true,
      mcNumber: true,
      businessPhone: true,
      state: true,
      saferNeedsReview: true,
    },
  },
  roles: {
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
  _count: {
    select: {
      trucks: true,
      iftaReports: true,
      ucrFilings: true,
      form2290Filings: true,
      dmvRegistrations: true,
      dmvRenewalCases: true,
    },
  },
} satisfies Prisma.UserSelect;

const managedTruckerSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  },
  _count: {
    select: {
      trucks: true,
      iftaReports: true,
      ucrFilings: true,
      form2290Filings: true,
      dmvRegistrations: true,
      dmvRenewalCases: true,
    },
  },
} satisfies Prisma.UserSelect;

type TruckerDirectoryRow = Prisma.UserGetPayload<{
  select: typeof truckerDirectorySelect;
}>;

type ManagedTruckerRow = Prisma.UserGetPayload<{
  select: typeof managedTruckerSelect;
}>;

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalYear(value: unknown) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  const maxYear = new Date().getFullYear() + 1;

  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > maxYear) {
    throw new SettingsValidationError("Year is invalid.");
  }

  return parsed;
}

function parseOptionalNonNegativeInt(value: unknown, label: string) {
  if (typeof value === "undefined") return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new SettingsValidationError(`${label} must be a whole number greater than or equal to 0.`);
  }

  return parsed;
}

function normalizeSearch(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function displayName(row: { name: string | null; email: string | null }) {
  return row.name?.trim() || row.email?.trim() || "Unnamed client";
}

function displayCompanyName(company: TruckerDirectoryRow["companyProfile"]) {
  return (
    company?.companyName?.trim() ||
    company?.legalName?.trim() ||
    company?.dbaName?.trim() ||
    ""
  );
}

function hasAddress(profile: TruckerDirectoryRow["userProfile"] | null) {
  return Boolean(
    profile?.address?.trim() ||
      profile?.city?.trim() ||
      profile?.state?.trim() ||
      profile?.zip?.trim(),
  );
}

function getProfileState(
  input: Pick<TruckerDirectoryRow, "name" | "email" | "userProfile" | "companyProfile">,
) {
  const missingPersonal = !Boolean(input.name?.trim() && input.userProfile?.phone?.trim() && hasAddress(input.userProfile));
  const missingCompany = !Boolean(
    displayCompanyName(input.companyProfile) && input.companyProfile?.dotNumber?.trim(),
  );
  const needsReview = Boolean(input.companyProfile?.saferNeedsReview);

  return {
    missingPersonal,
    missingCompany,
    needsReview,
    ready: !missingPersonal && !missingCompany && !needsReview,
  };
}

function matchesFilter(
  row: Pick<TruckerDirectoryRow, "name" | "email" | "userProfile" | "companyProfile">,
  filter: TruckerDirectoryFilter,
) {
  const state = getProfileState(row);

  if (filter === "missing-personal") return state.missingPersonal;
  if (filter === "missing-company") return state.missingCompany;
  if (filter === "needs-review") return state.needsReview;
  if (filter === "ready") return state.ready;

  return true;
}

function buildWhere(search: string): Prisma.UserWhereInput {
  const query = normalizeSearch(search);

  if (!query) {
    return {
      roles: {
        some: {
          role: {
            name: "TRUCKER",
          },
        },
      },
    };
  }

  return {
    roles: {
      some: {
        role: {
          name: "TRUCKER",
        },
      },
    },
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { userProfile: { is: { phone: { contains: query, mode: "insensitive" } } } },
      { userProfile: { is: { address: { contains: query, mode: "insensitive" } } } },
      { userProfile: { is: { city: { contains: query, mode: "insensitive" } } } },
      { userProfile: { is: { state: { contains: query, mode: "insensitive" } } } },
      { companyProfile: { is: { companyName: { contains: query, mode: "insensitive" } } } },
      { companyProfile: { is: { legalName: { contains: query, mode: "insensitive" } } } },
      { companyProfile: { is: { dbaName: { contains: query, mode: "insensitive" } } } },
      { companyProfile: { is: { dotNumber: { contains: query, mode: "insensitive" } } } },
      { companyProfile: { is: { mcNumber: { contains: query, mode: "insensitive" } } } },
    ],
  };
}

function toDirectoryItem(row: TruckerDirectoryRow): TruckerDirectoryItem {
  const profileState = getProfileState(row);

  return {
    id: row.id,
    name: displayName(row),
    email: row.email ?? "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    companyName: displayCompanyName(row.companyProfile),
    dotNumber: row.companyProfile?.dotNumber ?? "",
    mcNumber: row.companyProfile?.mcNumber ?? "",
    phone: row.userProfile?.phone ?? row.companyProfile?.businessPhone ?? "",
    state: row.userProfile?.state ?? row.companyProfile?.state ?? "",
    trucksCount: row._count.trucks,
    filingCount:
      row._count.iftaReports +
      row._count.ucrFilings +
      row._count.form2290Filings +
      row._count.dmvRegistrations +
      row._count.dmvRenewalCases,
    roles: row.roles.map((entry) => entry.role.name),
    ...profileState,
  };
}

export async function listManagedTruckers(input: {
  search?: string | null;
  filter?: string | null;
  sort?: string | null;
}): Promise<TruckerDirectoryItem[]> {
  const filter: TruckerDirectoryFilter =
    input.filter === "missing-personal" ||
    input.filter === "missing-company" ||
    input.filter === "needs-review" ||
    input.filter === "ready"
      ? input.filter
      : "all";

  const sort: TruckerDirectorySort =
    input.sort === "name" || input.sort === "company" ? input.sort : "recent";

  const rows = await prisma.user.findMany({
    where: buildWhere(input.search ?? ""),
    select: truckerDirectorySelect,
  });

  const collator = new Intl.Collator("en", { sensitivity: "base" });

  return rows
    .filter((row) => matchesFilter(row, filter))
    .map(toDirectoryItem)
    .sort((left, right) => {
      if (sort === "name") {
        return collator.compare(left.name, right.name);
      }

      if (sort === "company") {
        return collator.compare(
          left.companyName || left.name,
          right.companyName || right.name,
        );
      }

      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
}

async function findManagedTrucker(userId: string): Promise<ManagedTruckerRow | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: managedTruckerSelect,
  });

  if (!user) return null;
  if (!user.roles.some((entry) => entry.role.name === "TRUCKER")) return null;

  return user;
}

export async function getManagedTruckerProfile(
  userId: string,
): Promise<ManagedTruckerProfile | null> {
  const trucker = await findManagedTrucker(userId);
  if (!trucker) return null;

  const [personal, company, eldProvider, paymentMethods, billingOverview, trucks, documents] = await Promise.all([
    getPersonalInfo(userId),
    getCompanyProfile(userId),
    getEldProviderCredential(userId),
    listPaymentMethods(userId),
    getCustomerBillingOverview(userId),
    prisma.truck.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            trips: true,
            fuelPurchases: true,
            iftaReports: true,
            form2290Filings: true,
          },
        },
      },
      orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
    }),
    prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        fileName: true,
        fileUrl: true,
        fileSize: true,
        fileType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const profileState = getProfileState({
    name: personal.name,
    email: personal.email,
    userProfile: {
      phone: personal.phone,
      address: personal.address,
      city: personal.city,
      state: personal.state,
      zip: personal.zip,
    },
    companyProfile: {
      legalName: company.legalName,
      dbaName: company.dbaName,
      companyName: company.companyName,
      dotNumber: company.dotNumber,
      mcNumber: company.mcNumber,
      businessPhone: company.businessPhone,
      state: company.state,
      saferNeedsReview: company.saferNeedsReview,
    },
  });

  return {
    id: trucker.id,
    personal,
    company,
    eldProvider,
    payments: paymentMethods,
    billing: {
      subscriptionsEnabled: billingOverview.settings.subscriptionsEnabled,
      organizationName: billingOverview.organizationName,
      subscription: billingOverview.subscription
        ? {
            status: billingOverview.subscription.status,
            provider: billingOverview.subscription.provider,
            planName: billingOverview.subscription.plan?.name ?? "",
            currentPeriodStart: billingOverview.subscription.currentPeriodStart,
            currentPeriodEnd: billingOverview.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: billingOverview.subscription.cancelAtPeriodEnd,
            lastPaymentError: billingOverview.subscription.lastPaymentError,
          }
        : null,
      includedModules: billingOverview.includedModules,
      blockedPremiumModules: billingOverview.blockedPremiumModules,
    },
    trucks: trucks.map((truck) => ({
      id: truck.id,
      unitNumber: truck.unitNumber,
      nickname: truck.nickname,
      plateNumber: truck.plateNumber,
      vin: truck.vin,
      make: truck.make,
      model: truck.model,
      year: truck.year,
      grossWeight: truck.grossWeight,
      isActive: truck.isActive,
      is2290Eligible: truck.is2290Eligible,
      createdAt: truck.createdAt.toISOString(),
      updatedAt: truck.updatedAt.toISOString(),
      counts: {
        trips: truck._count.trips,
        fuelPurchases: truck._count.fuelPurchases,
        iftaReports: truck._count.iftaReports,
        form2290Filings: truck._count.form2290Filings,
      },
    })),
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      description: document.description,
      fileName: document.fileName,
      fileUrl: document.fileUrl,
      fileSize: document.fileSize,
      fileType: document.fileType,
      createdAt: document.createdAt.toISOString(),
    })),
    createdAt: trucker.createdAt.toISOString(),
    updatedAt: trucker.updatedAt.toISOString(),
    roles: trucker.roles.map((entry) => entry.role.name),
    stats: {
      trucksCount: trucker._count.trucks,
      iftaReportsCount: trucker._count.iftaReports,
      ucrFilingsCount: trucker._count.ucrFilings,
      form2290FilingsCount: trucker._count.form2290Filings,
      dmvRegistrationsCount: trucker._count.dmvRegistrations,
      dmvRenewalCasesCount: trucker._count.dmvRenewalCases,
    },
    profileState,
  };
}

export async function updateManagedTruckerProfile(
  userId: string,
  input: ManagedTruckerProfileUpdateInput,
): Promise<ManagedTruckerProfile | null> {
  const trucker = await findManagedTrucker(userId);
  if (!trucker) return null;

  const hasPersonalPayload = typeof input.personal === "object" && input.personal !== null;
  const hasCompanyPayload = typeof input.company === "object" && input.company !== null;
  const hasEldProviderPayload =
    typeof input.eldProvider === "object" && input.eldProvider !== null;

  if (!hasPersonalPayload && !hasCompanyPayload && !hasEldProviderPayload) {
    throw new SettingsValidationError("Nothing to update.");
  }

  await Promise.all([
    hasPersonalPayload ? updatePersonalInfo(userId, input.personal ?? {}) : Promise.resolve(),
    hasCompanyPayload ? upsertCompanyProfile(userId, input.company ?? {}) : Promise.resolve(),
    hasEldProviderPayload
      ? upsertEldProviderCredential(userId, input.eldProvider ?? {})
      : Promise.resolve(),
  ]);

  return getManagedTruckerProfile(userId);
}

export async function createManagedTruckerTruck(
  userId: string,
  input: ManagedTruckerTruckInput,
): Promise<ManagedTruckerProfile | null> {
  const trucker = await findManagedTrucker(userId);
  if (!trucker) return null;

  const settings = await getForm2290Settings();
  const unitNumber = normalizeOptionalText(input.unitNumber);
  const nickname = normalizeOptionalText(input.nickname);
  const plateNumber = normalizeOptionalText(input.plateNumber);
  const vin = normalizeOptionalText(input.vin);
  const make = normalizeOptionalText(input.make);
  const model = normalizeOptionalText(input.model);
  const year = parseOptionalYear(input.year);
  const grossWeight = parseOptionalNonNegativeInt(input.grossWeight, "Gross weight");

  if (!unitNumber) {
    throw new SettingsValidationError("Unit number is required.");
  }

  await prisma.truck.create({
    data: {
      userId,
      unitNumber,
      nickname,
      plateNumber,
      vin,
      make,
      model,
      year,
      grossWeight,
      is2290Eligible:
        typeof grossWeight === "number"
          ? is2290Eligible(grossWeight, settings.minimumEligibleWeight)
          : false,
    },
  });

  return getManagedTruckerProfile(userId);
}
