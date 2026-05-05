import type { DbClient } from "@/lib/db/types";
import {
  assert2290FilingAccess,
  assert2290TruckAccess,
  canManageAll2290,
  resolve2290OrganizationId,
} from "@/services/form2290/shared";

export {
  assert2290FilingAccess,
  assert2290TruckAccess,
  canManageAll2290,
  resolve2290OrganizationId,
};

export type Form2290AccessContext = {
  db?: DbClient;
  actorUserId: string;
  permissions?: string[] | readonly string[];
  isAdmin: boolean;
};

export function buildForm2290Access(input: Form2290AccessContext) {
  return {
    actorUserId: input.actorUserId,
    canManageAll: canManageAll2290(input.permissions, input.isAdmin),
    db: input.db,
  };
}
