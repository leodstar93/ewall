import {
  DmvDocumentReviewStatus,
  DmvRequirementStatus,
} from "@prisma/client";

type DocumentLinkStatus = {
  status: DmvDocumentReviewStatus;
  rejectionNote?: string | null;
  createdAt?: Date;
};

export function deriveRequirementStatusFromLinks(links: DocumentLinkStatus[]) {
  if (links.some((link) => link.status === DmvDocumentReviewStatus.APPROVED)) {
    return {
      status: DmvRequirementStatus.APPROVED,
      note: null,
    };
  }

  if (links.some((link) => link.status === DmvDocumentReviewStatus.PENDING)) {
    return {
      status: DmvRequirementStatus.UPLOADED,
      note: null,
    };
  }

  const rejectedLinks = links.filter(
    (link) => link.status === DmvDocumentReviewStatus.REJECTED,
  );

  if (rejectedLinks.length > 0) {
    const latestRejected = [...rejectedLinks].sort((left, right) => {
      const leftTime = left.createdAt?.getTime() ?? 0;
      const rightTime = right.createdAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];

    return {
      status: DmvRequirementStatus.REJECTED,
      note: latestRejected?.rejectionNote ?? null,
    };
  }

  return {
    status: DmvRequirementStatus.MISSING,
    note: null,
  };
}
