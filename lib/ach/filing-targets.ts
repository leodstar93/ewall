import { prisma } from "@/lib/prisma";
import { AchServiceError } from "@/lib/ach/errors";
import { FILING_TYPES, USAGE_TYPES, type FilingType, type UsageType } from "@/lib/ach/constants";

export type FilingTarget = {
  defaultUsageType: UsageType;
  filingId: string;
  filingType: FilingType;
  readPermission: string;
  title: string;
  userId: string;
};

export function getFilingReadPermission(filingType: FilingType) {
  switch (filingType) {
    case FILING_TYPES.UCR:
      return "ucr:read";
    case FILING_TYPES.FORM2290:
      return "compliance2290:view";
    case FILING_TYPES.IFTA:
      return "ifta:read";
    case FILING_TYPES.DMV_REGISTRATION:
      return "dmv:read";
    case FILING_TYPES.DMV_RENEWAL:
      return "dmvRenewal:read";
    default:
      throw new AchServiceError("Unsupported filing type.", 400);
  }
}

export async function resolveFilingTarget(
  filingType: FilingType,
  filingId: string,
): Promise<FilingTarget> {
  switch (filingType) {
    case FILING_TYPES.UCR: {
      const filing = await prisma.uCRFiling.findUnique({
        where: { id: filingId },
        select: {
          id: true,
          filingYear: true,
          legalName: true,
          userId: true,
        },
      });

      if (!filing) {
        throw new AchServiceError("UCR filing not found.", 404);
      }

      return {
        defaultUsageType: USAGE_TYPES.UCR,
        filingId: filing.id,
        filingType,
        readPermission: getFilingReadPermission(filingType),
        title: `UCR ${filing.filingYear} - ${filing.legalName || "Customer filing"}`,
        userId: filing.userId,
      };
    }
    case FILING_TYPES.FORM2290: {
      const filing = await prisma.form2290Filing.findUnique({
        where: { id: filingId },
        select: {
          id: true,
          userId: true,
          taxPeriod: {
            select: {
              name: true,
            },
          },
          truck: {
            select: {
              unitNumber: true,
            },
          },
        },
      });

      if (!filing) {
        throw new AchServiceError("Form 2290 filing not found.", 404);
      }

      return {
        defaultUsageType: USAGE_TYPES.IRS,
        filingId: filing.id,
        filingType,
        readPermission: getFilingReadPermission(filingType),
        title: `Form 2290 ${filing.taxPeriod.name} - Unit ${filing.truck.unitNumber}`,
        userId: filing.userId,
      };
    }
    case FILING_TYPES.IFTA: {
      const report = await prisma.iftaReport.findUnique({
        where: { id: filingId },
        select: {
          id: true,
          quarter: true,
          userId: true,
          year: true,
          truck: {
            select: {
              unitNumber: true,
            },
          },
        },
      });

      if (!report) {
        throw new AchServiceError("IFTA report not found.", 404);
      }

      return {
        defaultUsageType: USAGE_TYPES.IFTA,
        filingId: report.id,
        filingType,
        readPermission: getFilingReadPermission(filingType),
        title: `IFTA ${report.year} ${report.quarter}${report.truck ? ` - Unit ${report.truck.unitNumber}` : ""}`,
        userId: report.userId,
      };
    }
    case FILING_TYPES.DMV_REGISTRATION: {
      const registration = await prisma.dmvRegistration.findUnique({
        where: { id: filingId },
        select: {
          id: true,
          registrationType: true,
          userId: true,
          truck: {
            select: {
              unitNumber: true,
            },
          },
        },
      });

      if (!registration) {
        throw new AchServiceError("DMV registration not found.", 404);
      }

      return {
        defaultUsageType: USAGE_TYPES.REGISTRATION,
        filingId: registration.id,
        filingType,
        readPermission: getFilingReadPermission(filingType),
        title: `DMV ${registration.registrationType} - Unit ${registration.truck.unitNumber}`,
        userId: registration.userId,
      };
    }
    case FILING_TYPES.DMV_RENEWAL: {
      const renewal = await prisma.dmvRenewalCase.findUnique({
        where: { id: filingId },
        select: {
          caseNumber: true,
          id: true,
          userId: true,
        },
      });

      if (!renewal) {
        throw new AchServiceError("DMV renewal not found.", 404);
      }

      return {
        defaultUsageType: USAGE_TYPES.DMV,
        filingId: renewal.id,
        filingType,
        readPermission: getFilingReadPermission(filingType),
        title: `DMV Renewal ${renewal.caseNumber}`,
        userId: renewal.userId,
      };
    }
    default: {
      throw new AchServiceError("Unsupported filing type.", 400);
    }
  }
}
