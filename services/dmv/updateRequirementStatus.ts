import {
  DmvActorType,
  DmvRequirementStatus,
} from "@prisma/client";
import type { DbClient } from "@/lib/db/types";
import {
  assertDmvRegistrationAccess,
  assertDmvRenewalAccess,
  DmvServiceError,
  logDmvActivity,
  resolveDmvDb,
} from "@/services/dmv/shared";

type UpdateRequirementStatusInput =
  | {
      scope: "registration";
      db?: DbClient;
      registrationId: string;
      code: string;
      status: DmvRequirementStatus;
      note?: string | null;
      actorUserId: string;
      canManageAll: boolean;
    }
  | {
      scope: "renewal";
      db?: DbClient;
      renewalId: string;
      code: string;
      status: DmvRequirementStatus;
      note?: string | null;
      actorUserId: string;
      canManageAll: boolean;
    };

export async function updateRequirementStatus(
  input: UpdateRequirementStatusInput,
) {
  const db = resolveDmvDb(input.db);
  if (input.scope === "registration") {
    const registration = await assertDmvRegistrationAccess({
      db,
      registrationId: input.registrationId,
      actorUserId: input.actorUserId,
      canManageAll: input.canManageAll,
    });

    const requirement = registration.requirements.find(
      (item) => item.code === input.code,
    );

    if (!requirement) {
      throw new DmvServiceError("Requirement not found", 404, "REQUIREMENT_NOT_FOUND");
    }

    return db.$transaction(async (tx) => {
      const snapshot = await tx.dmvRequirementSnapshot.update({
        where: { id: requirement.id },
        data: {
          status: input.status,
          note: input.note ?? null,
        },
      });

      await logDmvActivity(tx, {
        registrationId: registration.id,
        actorUserId: input.actorUserId,
        actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
        action: "REGISTRATION_REQUIREMENT_UPDATED",
        message: input.code,
        metadataJson: {
          code: input.code,
          status: input.status,
        },
      });

      return snapshot;
    });
  }

  const renewal = await assertDmvRenewalAccess({
    db,
    renewalId: input.renewalId,
    actorUserId: input.actorUserId,
    canManageAll: input.canManageAll,
  });

  const requirement = renewal.requirements.find((item) => item.code === input.code);
  if (!requirement) {
    throw new DmvServiceError("Requirement not found", 404, "REQUIREMENT_NOT_FOUND");
  }

  return db.$transaction(async (tx) => {
    const snapshot = await tx.dmvRequirementSnapshot.update({
      where: { id: requirement.id },
      data: {
        status: input.status,
        note: input.note ?? null,
      },
    });

    await logDmvActivity(tx, {
      registrationId: renewal.registrationId,
      renewalId: renewal.id,
      actorUserId: input.actorUserId,
      actorType: input.canManageAll ? DmvActorType.STAFF : DmvActorType.CLIENT,
      action: "RENEWAL_REQUIREMENT_UPDATED",
      message: input.code,
      metadataJson: {
        code: input.code,
        status: input.status,
      },
    });

    return snapshot;
  });
}
