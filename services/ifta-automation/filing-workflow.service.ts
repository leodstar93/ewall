import {
  IftaExceptionSeverity,
  IftaFilingStatus,
} from "@prisma/client";
import {
  IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
  type DbLike,
  IftaAutomationError,
  canStartStaffReview,
  canTruckerEditFiling,
  getIftaAutomationFilingOrThrow,
  hasBlockingOpenExceptions,
  isOpenExceptionStatus,
  normalizeJurisdictionCode,
  parseOptionalDate,
  resolveDb,
  toDecimalString,
} from "@/services/ifta-automation/shared";
import { CanonicalNormalizationService } from "@/services/ifta-automation/canonical-normalization.service";
import { IftaCalculationEngine } from "@/services/ifta-automation/ifta-calculation-engine.service";
import { IftaExceptionEngine } from "@/services/ifta-automation/ifta-exception-engine.service";
import {
  notifyIftaAutomationApproved,
  notifyIftaAutomationChangesRequested,
  notifyIftaAutomationClientApproved,
  notifyIftaAutomationPendingApproval,
  notifyIftaAutomationReopened,
  notifyIftaAutomationSubmitted,
  notifyIftaAutomationUnderReview,
} from "@/services/ifta-automation/notifications";
import { SnapshotService } from "@/services/ifta-automation/snapshot.service";

const SEND_FOR_APPROVAL_STATUSES = new Set<IftaFilingStatus>([
  IftaFilingStatus.DATA_READY,
  IftaFilingStatus.NEEDS_REVIEW,
  IftaFilingStatus.READY_FOR_REVIEW,
  IftaFilingStatus.IN_REVIEW,
  IftaFilingStatus.CHANGES_REQUESTED,
  IftaFilingStatus.REOPENED,
  IftaFilingStatus.SNAPSHOT_READY,
]);

export class FilingWorkflowService {
  static async logAudit(input: {
    filingId: string;
    actorUserId?: string | null;
    action: string;
    message?: string | null;
    payloadJson?: Record<string, unknown> | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    return db.iftaAuditLog.create({
      data: {
        filingId: input.filingId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        message: input.message ?? null,
        payloadJson: input.payloadJson
          ? JSON.parse(JSON.stringify(input.payloadJson))
          : undefined,
      },
    });
  }

  static async setStatus(input: {
    filingId: string;
    status: IftaFilingStatus;
    actorUserId?: string | null;
    message?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const current = await db.iftaFiling.findUnique({
      where: { id: input.filingId },
      select: { id: true, status: true },
    });

    if (!current) {
      throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
    }

    if (current.status === input.status) {
      return db.iftaFiling.findUniqueOrThrow({
        where: { id: input.filingId },
      });
    }

    const updated = await db.iftaFiling.update({
      where: { id: input.filingId },
      data: {
        status: input.status,
      },
    });

    await this.logAudit({
      filingId: input.filingId,
      actorUserId: input.actorUserId,
      action: "filing.status",
      message:
        input.message ?? `Status changed from ${current.status} to ${input.status}.`,
      payloadJson: {
        fromStatus: current.status,
        toStatus: input.status,
      },
      db,
    });

    return updated;
  }

  static async refreshDerivedState(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    await CanonicalNormalizationService.rebuildFiling({
      filingId: input.filingId,
      db,
    });
    await IftaCalculationEngine.calculateFiling({
      filingId: input.filingId,
      db,
    });
    return IftaExceptionEngine.evaluateFiling({
      filingId: input.filingId,
      db,
    });
  }

  static async replaceManualFuelAdjustments(input: {
    filingId: string;
    actorUserId?: string | null;
    lines: Array<{
      filingVehicleId?: string | null;
      purchasedAt?: string | Date | null;
      jurisdiction: string;
      gallons: number;
    }>;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (!canTruckerEditFiling(filing.status)) {
      throw new IftaAutomationError(
        "Submitted filings cannot be edited unless staff sends them back for changes.",
        409,
        "IFTA_FILING_EDIT_BLOCKED",
      );
    }

    const mergedLines = new Map<string, number>();
    const normalizedLines: Array<{
      filingVehicleId: string | null;
      purchasedAt: Date | null;
      jurisdiction: string;
      gallons: number;
    }> = [];

    for (const line of input.lines) {
      const jurisdiction = normalizeJurisdictionCode(line.jurisdiction);
      const gallons = Number(line.gallons);
      const filingVehicleId = line.filingVehicleId?.trim() || null;
      const purchasedAt = parseOptionalDate(line.purchasedAt);

      if (!jurisdiction || jurisdiction.length < 2 || jurisdiction.length > 3) {
        throw new IftaAutomationError(
          "Each manual fuel row needs a valid jurisdiction code.",
          400,
          "INVALID_IFTA_MANUAL_JURISDICTION",
        );
      }

      if (!Number.isFinite(gallons) || gallons < 0) {
        throw new IftaAutomationError(
          "Manual gallons must be zero or greater.",
          400,
          "INVALID_IFTA_MANUAL_GALLONS",
        );
      }

      if (gallons === 0) {
        continue;
      }

      if (purchasedAt && (purchasedAt < filing.periodStart || purchasedAt > filing.periodEnd)) {
        throw new IftaAutomationError(
          "Manual fuel purchase dates must stay inside the filing quarter.",
          400,
          "IFTA_MANUAL_PURCHASE_OUTSIDE_PERIOD",
        );
      }

      normalizedLines.push({
        filingVehicleId,
        purchasedAt,
        jurisdiction,
        gallons,
      });

      mergedLines.set(jurisdiction, (mergedLines.get(jurisdiction) ?? 0) + gallons);
    }

    await db.iftaFuelLine.deleteMany({
      where: {
        filingId: filing.id,
        sourceType: IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
      },
    });

    if (normalizedLines.length > 0) {
      await db.iftaFuelLine.createMany({
        data: normalizedLines.map((line) => ({
          filingId: filing.id,
          filingVehicleId: line.filingVehicleId,
          jurisdiction: line.jurisdiction,
          purchasedAt: line.purchasedAt,
          fuelType: "diesel",
          gallons: toDecimalString(line.gallons, 3),
          taxPaid: true,
          sourceType: IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
          sourceRefId: null,
        })),
      });
    }

    await IftaCalculationEngine.calculateFiling({
      filingId: filing.id,
      db,
    });
    await IftaExceptionEngine.evaluateFiling({
      filingId: filing.id,
      db,
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.manual_fuel.replace",
      message: `Updated ${normalizedLines.length} manual fuel row${normalizedLines.length === 1 ? "" : "s"}.`,
      payloadJson: {
        jurisdictions: Array.from(mergedLines.entries()).map(([jurisdiction, gallons]) => ({
          jurisdiction,
          gallons: toDecimalString(gallons, 3),
        })),
        purchases: normalizedLines.map((line) => ({
          filingVehicleId: line.filingVehicleId,
          purchasedAt: line.purchasedAt?.toISOString() ?? null,
          jurisdiction: line.jurisdiction,
          gallons: toDecimalString(line.gallons, 3),
        })),
      },
      db,
    });

    return getIftaAutomationFilingOrThrow(filing.id, db);
  }

  static async replaceManualDistanceAdjustments(input: {
    filingId: string;
    actorUserId?: string | null;
    lines: Array<{
      jurisdiction: string;
      taxableMiles: number;
    }>;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (!canTruckerEditFiling(filing.status)) {
      throw new IftaAutomationError(
        "Submitted filings cannot be edited unless staff sends them back for changes.",
        409,
        "IFTA_FILING_EDIT_BLOCKED",
      );
    }

    const mergedLines = new Map<string, number>();
    const normalizedLines: Array<{
      jurisdiction: string;
      taxableMiles: number;
    }> = [];

    for (const line of input.lines) {
      const jurisdiction = normalizeJurisdictionCode(line.jurisdiction);
      const taxableMiles = Number(line.taxableMiles);

      if (!jurisdiction || jurisdiction.length < 2 || jurisdiction.length > 3) {
        throw new IftaAutomationError(
          "Each manual miles row needs a valid jurisdiction code.",
          400,
          "INVALID_IFTA_MANUAL_DISTANCE_JURISDICTION",
        );
      }

      if (!Number.isFinite(taxableMiles) || taxableMiles < 0) {
        throw new IftaAutomationError(
          "Manual miles must be zero or greater.",
          400,
          "INVALID_IFTA_MANUAL_DISTANCE",
        );
      }

      if (taxableMiles === 0) {
        continue;
      }

      normalizedLines.push({
        jurisdiction,
        taxableMiles,
      });
      mergedLines.set(jurisdiction, (mergedLines.get(jurisdiction) ?? 0) + taxableMiles);
    }

    await db.iftaDistanceLine.deleteMany({
      where: {
        filingId: filing.id,
        sourceType: IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
      },
    });

    if (normalizedLines.length > 0) {
      await db.iftaDistanceLine.createMany({
        data: normalizedLines.map((line) => ({
          filingId: filing.id,
          filingVehicleId: null,
          jurisdiction: line.jurisdiction,
          tripDate: null,
          taxableMiles: toDecimalString(line.taxableMiles, 2),
          sourceType: IFTA_AUTOMATION_MANUAL_SOURCE_TYPE,
          sourceRefId: null,
        })),
      });
    }

    await IftaCalculationEngine.calculateFiling({
      filingId: filing.id,
      db,
    });
    await IftaExceptionEngine.evaluateFiling({
      filingId: filing.id,
      db,
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.manual_distance.replace",
      message: `Updated ${normalizedLines.length} manual distance row${normalizedLines.length === 1 ? "" : "s"}.`,
      payloadJson: {
        jurisdictions: Array.from(mergedLines.entries()).map(([jurisdiction, taxableMiles]) => ({
          jurisdiction,
          taxableMiles: toDecimalString(taxableMiles, 2),
        })),
      },
      db,
    });

    return getIftaAutomationFilingOrThrow(filing.id, db);
  }

  static async submitForReview(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (!canTruckerEditFiling(filing.status)) {
      throw new IftaAutomationError(
        "This filing can no longer be submitted from its current status.",
        409,
        "IFTA_FILING_SUBMIT_INVALID_STATUS",
      );
    }

    const updated = await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        status: IftaFilingStatus.READY_FOR_REVIEW,
        submittedByUserId: input.actorUserId ?? filing.submittedByUserId,
      },
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.submit",
      message: "Submitted filing for staff review.",
      db,
    });

    await notifyIftaAutomationSubmitted(
      await getIftaAutomationFilingOrThrow(filing.id, db),
      {
        actorUserId: input.actorUserId,
      },
    );

    return updated;
  }

  static async startReview(input: {
    filingId: string;
    actorUserId: string;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (!canStartStaffReview(filing.status)) {
      throw new IftaAutomationError(
        "Only submitted IFTA filings can be taken into staff review.",
        409,
        "IFTA_START_REVIEW_INVALID_STATUS",
      );
    }

    const nextStatus =
      filing.status === IftaFilingStatus.READY_FOR_REVIEW
        ? IftaFilingStatus.IN_REVIEW
        : filing.status;
    const reviewerChanged = filing.assignedStaffUserId !== input.actorUserId;
    const statusChanged = filing.status !== nextStatus;

    if (!reviewerChanged && !statusChanged) {
      return filing;
    }

    const updated = await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        status: nextStatus,
        assignedStaffUserId: input.actorUserId,
      },
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.start_review",
      message:
        filing.assignedStaffUserId && filing.assignedStaffUserId !== input.actorUserId
          ? "Review was reassigned to a different staff member."
          : "Review was assigned to the current staff member.",
      payloadJson: {
        fromStatus: filing.status,
        toStatus: nextStatus,
        previousAssignedStaffUserId: filing.assignedStaffUserId,
        assignedStaffUserId: input.actorUserId,
      },
      db,
    });

    if (statusChanged && nextStatus === IftaFilingStatus.IN_REVIEW) {
      await notifyIftaAutomationUnderReview(
        await getIftaAutomationFilingOrThrow(filing.id, db),
      );
    }

    return updated;
  }

  static async requestChanges(input: {
    filingId: string;
    actorUserId?: string | null;
    note?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const updated = await db.iftaFiling.update({
      where: { id: input.filingId },
      data: {
        status: IftaFilingStatus.CHANGES_REQUESTED,
        notesInternal: input.note ?? undefined,
      },
    });

    await this.logAudit({
      filingId: input.filingId,
      actorUserId: input.actorUserId,
      action: "filing.request_changes",
      message: input.note ?? "Staff requested changes on the filing.",
      db,
    });

    await notifyIftaAutomationChangesRequested(
      await getIftaAutomationFilingOrThrow(input.filingId, db),
      input.note,
    );

    return updated;
  }

  static async createSnapshot(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const snapshot = await SnapshotService.createSnapshot({
      filingId: input.filingId,
      actorUserId: input.actorUserId,
      db,
    });
    await this.setStatus({
      filingId: input.filingId,
      status: IftaFilingStatus.SNAPSHOT_READY,
      actorUserId: input.actorUserId,
      message: `Snapshot version ${snapshot.version} is ready.`,
      db,
    });

    return snapshot;
  }

  static async sendForApproval(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (filing.status === IftaFilingStatus.PENDING_APPROVAL) {
      return filing;
    }

    if (!SEND_FOR_APPROVAL_STATUSES.has(filing.status)) {
      throw new IftaAutomationError(
        "This filing is not ready to be sent for approval.",
        409,
        "IFTA_SEND_FOR_APPROVAL_INVALID_STATUS",
      );
    }

    if (hasBlockingOpenExceptions(filing.exceptions)) {
      throw new IftaAutomationError(
        "Blocking IFTA exceptions must be resolved before sending for approval.",
        409,
        "IFTA_APPROVAL_BLOCKED",
      );
    }

    if (
      filing.exceptions.some(
        (exception) =>
          exception.severity === IftaExceptionSeverity.ERROR &&
          isOpenExceptionStatus(exception.status),
      )
    ) {
      throw new IftaAutomationError(
        "Open IFTA errors must be resolved before sending for approval.",
        409,
        "IFTA_APPROVAL_HAS_ERRORS",
      );
    }

    const draftSnapshot = await SnapshotService.createSnapshot({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      db,
    });

    if (filing.status !== IftaFilingStatus.SNAPSHOT_READY) {
      await this.setStatus({
        filingId: filing.id,
        status: IftaFilingStatus.SNAPSHOT_READY,
        actorUserId: input.actorUserId,
        message: `Snapshot version ${draftSnapshot.version} is ready.`,
        db,
      });
    }

    const snapshot = await SnapshotService.freezeSnapshot({
      filingId: filing.id,
      snapshotId: draftSnapshot.id,
      actorUserId: input.actorUserId,
      db,
    });

    const updated = await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        status: IftaFilingStatus.PENDING_APPROVAL,
      },
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.send_for_approval",
      message: `Sent filing for client approval with snapshot version ${snapshot.version}.`,
      db,
    });

    await notifyIftaAutomationPendingApproval(
      await getIftaAutomationFilingOrThrow(filing.id, db),
    );

    return updated;
  }

  static async clientApprove(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (filing.status !== IftaFilingStatus.PENDING_APPROVAL) {
      throw new IftaAutomationError(
        "Only filings pending approval can be approved by the client.",
        409,
        "IFTA_CLIENT_APPROVE_INVALID_STATUS",
      );
    }

    const updated = await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        status: IftaFilingStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.client_approve",
      message: "Client approved the filing.",
      db,
    });

    await notifyIftaAutomationClientApproved(
      await getIftaAutomationFilingOrThrow(filing.id, db),
    );

    return updated;
  }

  static async finalize(input: {
    filingId: string;
    actorUserId?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (filing.status !== IftaFilingStatus.APPROVED) {
      throw new IftaAutomationError(
        "Only client-approved filings can be finalized.",
        409,
        "IFTA_FINALIZE_INVALID_STATUS",
      );
    }

    const updated = await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        status: IftaFilingStatus.FINALIZED,
      },
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.finalize",
      message: "Filing finalized by staff.",
      db,
    });

    await notifyIftaAutomationApproved(
      await getIftaAutomationFilingOrThrow(filing.id, db),
    );

    return updated;
  }

  static async reopen(input: {
    filingId: string;
    actorUserId?: string | null;
    note?: string | null;
    db?: DbLike;
  }) {
    const db = resolveDb(input.db ?? null);
    const filing = await getIftaAutomationFilingOrThrow(input.filingId, db);

    if (
      filing.status !== IftaFilingStatus.APPROVED &&
      filing.status !== IftaFilingStatus.FINALIZED
    ) {
      throw new IftaAutomationError(
        "Only approved or finalized filings can be reopened.",
        409,
        "IFTA_REOPEN_INVALID_STATUS",
      );
    }

    const updated = await db.iftaFiling.update({
      where: { id: filing.id },
      data: {
        status: IftaFilingStatus.REOPENED,
      },
    });

    await this.logAudit({
      filingId: filing.id,
      actorUserId: input.actorUserId,
      action: "filing.reopen",
      message: input.note ?? "Reopened approved filing.",
      db,
    });

    await notifyIftaAutomationReopened(
      await getIftaAutomationFilingOrThrow(filing.id, db),
      input.note,
    );

    return updated;
  }
}
