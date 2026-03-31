import { prisma } from "@/lib/prisma";
import {
  dmvRenewalCaseInclude,
  filterVisibleDocuments,
  filterVisibleMessages,
  getDmvRenewalCaseOrThrow,
} from "@/services/dmv-renewal/shared";

type GetDmvRenewalDetailInput = {
  renewalId: string;
  actorUserId: string;
  canManageAll: boolean;
};

export async function getDmvRenewalDetail(input: GetDmvRenewalDetailInput) {
  const renewal = await getDmvRenewalCaseOrThrow(input);

  return {
    ...renewal,
    documents: filterVisibleDocuments(renewal.documents, input.canManageAll),
    messages: filterVisibleMessages(renewal.messages, input.canManageAll),
  };
}

export async function refreshDmvRenewalDetail(renewalId: string) {
  return prisma.dmvRenewalCase.findUniqueOrThrow({
    where: { id: renewalId },
    include: dmvRenewalCaseInclude,
  });
}

