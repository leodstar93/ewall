import {
  DmvFilingType,
  DmvRegistrationType,
  DmvRequirementStatus,
} from "@prisma/client";
import type { DbClient, ServiceContext } from "@/lib/db/types";
import { resolveDmvDb } from "@/services/dmv/shared";

export type RequirementSnapshotSeed = {
  code: string;
  name: string;
  isRequired: boolean;
  status: DmvRequirementStatus;
  note: string | null;
};

type BuildRequirementSnapshotInput = {
  db?: Pick<ServiceContext, "db"> | DbClient | null;
  registrationType: DmvRegistrationType;
  filingType: DmvFilingType;
  declaredGrossWeight?: number | null;
  carrierRelocated?: boolean;
  priorRequirements?: Array<{
    code: string;
    name: string;
    isRequired: boolean;
  }>;
};

export async function buildRequirementSnapshot(input: BuildRequirementSnapshotInput) {
  const db = resolveDmvDb(input.db);
  const usePriorRequirements =
    Array.isArray(input.priorRequirements) && input.priorRequirements.length > 0;

  const baseline = usePriorRequirements
    ? input.priorRequirements!.map((requirement) => ({
        code: requirement.code,
        name: requirement.name,
        isRequired: requirement.isRequired,
      }))
    : await db.dmvRequirementTemplate.findMany({
        where: {
          active: true,
          OR: [
            { appliesToType: null },
            { appliesToType: input.registrationType },
          ],
          ...(input.filingType === DmvFilingType.INITIAL
            ? { appliesToInitial: true }
            : { appliesToRenewal: true }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          code: true,
          name: true,
          isRequired: true,
        },
      });

  const entries = new Map(
    baseline.map((requirement) => [
      requirement.code,
      {
        code: requirement.code,
        name: requirement.name,
        isRequired: requirement.isRequired,
      },
    ]),
  );

  if (input.registrationType === DmvRegistrationType.IRP) {
    for (const [code, name] of [
      ["MC006_MILEAGE_WEIGHT_APPLICATION", "Mileage / weight application"],
      ["MC040_IRP_REGISTRATION_CERTIFICATION", "IRP registration certification"],
      ["DOT_PROOF", "DOT proof"],
      ["3X_NV_RESIDENCY_PROOFS", "Nevada residency / established place of business proofs"],
    ] as const) {
      entries.set(code, { code, name, isRequired: true });
    }
  }

  if ((input.declaredGrossWeight ?? 0) >= 55000) {
    entries.set("FORM_2290_IF_55000_PLUS", {
      code: "FORM_2290_IF_55000_PLUS",
      name: "Form 2290 for 55,000 lbs+ if applicable",
      isRequired: true,
    });
  }

  if (input.registrationType === DmvRegistrationType.IRP && input.carrierRelocated) {
    entries.set("PRIOR_JURISDICTION_MILEAGE_IF_RELOCATED", {
      code: "PRIOR_JURISDICTION_MILEAGE_IF_RELOCATED",
      name: "Prior jurisdiction mileage if relocated",
      isRequired: true,
    });
  }

  return Array.from(entries.values()).map(
    (requirement): RequirementSnapshotSeed => ({
      code: requirement.code,
      name: requirement.name,
      isRequired: requirement.isRequired,
      status: DmvRequirementStatus.MISSING,
      note: null,
    }),
  );
}
