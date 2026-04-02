"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import StaffFilingPaymentPanel from "@/components/ach/StaffFilingPaymentPanel";
import RequirementChecklist, {
  ChecklistAvailableDocument,
  ChecklistLinkedDocument,
  ChecklistRequirement,
} from "@/features/dmv/requirement-checklist";
import {
  canActivateRegistration,
  canApproveRegistration,
  canEditRegistration,
  canMarkRegistrationReady,
  canRejectRegistration,
  canSendRegistrationToReview,
  canSubmitRegistration,
  formatDate,
  registrationStatusClasses,
  registrationStatusLabel,
  registrationTypeLabel,
  renewalStatusLabel,
} from "@/features/dmv/shared";

type DetailPageProps = {
  truckId: string;
  canUpdateRegistration: boolean;
  canReviewRegistration: boolean;
  canApproveRegistration: boolean;
  mode?: "driver" | "staff";
  trucksApiBasePath?: string;
  registrationsApiBasePath?: string;
  documentsApiBasePath?: string;
  newRegistrationHref?: string;
  renewalHrefBase?: string | null;
};

type RenewalSummary = {
  id: string;
  cycleYear: number;
  status:
    | "NOT_OPEN"
    | "OPEN"
    | "WAITING_CLIENT_DOCS"
    | "UNDER_REVIEW"
    | "CORRECTION_REQUIRED"
    | "READY_FOR_FILING"
    | "SUBMITTED"
    | "APPROVED"
    | "COMPLETED"
    | "REJECTED"
    | "OVERDUE";
  dueDate: string | null;
};

type RegistrationSummary = {
  id: string;
  registrationType: "NEVADA_ONLY" | "IRP";
  status:
    | "DRAFT"
    | "WAITING_CLIENT_DOCS"
    | "UNDER_REVIEW"
    | "CORRECTION_REQUIRED"
    | "READY_FOR_FILING"
    | "SUBMITTED"
    | "APPROVED"
    | "ACTIVE"
    | "EXPIRED"
    | "REJECTED"
    | "CANCELLED";
  effectiveDate: string | null;
  expirationDate: string | null;
  dmvAccountNumber?: string | null;
  fleetNumber?: string | null;
  cabCardNumber?: string | null;
  plateNumber?: string | null;
  declaredGrossWeight?: number | null;
  establishedBusinessOk?: boolean | null;
  carrierRelocated?: boolean;
  dotNumber?: string | null;
  mcNumber?: string | null;
  fein?: string | null;
  nevadaAddress?: string | null;
  requirements: ChecklistRequirement[];
  documents: ChecklistLinkedDocument[];
  renewals: RenewalSummary[];
};

type DmvTruckDetail = {
  unitNumber: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  dmvRegistrations: RegistrationSummary[];
};

export default function DmvDetailPage({
  truckId,
  canUpdateRegistration,
  canReviewRegistration,
  canApproveRegistration: canApproveRegistrationPermission,
  mode = "driver",
  trucksApiBasePath,
  registrationsApiBasePath,
  documentsApiBasePath,
  newRegistrationHref,
  renewalHrefBase,
}: DetailPageProps) {
  const resolvedTrucksApiBasePath = trucksApiBasePath ?? "/api/v1/features/dmv/trucks";
  const resolvedRegistrationsApiBasePath =
    registrationsApiBasePath ?? "/api/v1/features/dmv/registrations";
  const resolvedDocumentsApiBasePath =
    documentsApiBasePath ?? "/api/v1/features/documents";

  const [truck, setTruck] = useState<DmvTruckDetail | null>(null);
  const [availableDocuments, setAvailableDocuments] = useState<ChecklistAvailableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    registrationType: "",
    effectiveDate: "",
    expirationDate: "",
    declaredGrossWeight: "",
    dmvAccountNumber: "",
    fleetNumber: "",
    cabCardNumber: "",
    plateNumber: "",
    dotNumber: "",
    mcNumber: "",
    fein: "",
    nevadaAddress: "",
    establishedBusinessOk: false,
    carrierRelocated: false,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setActionMessage(null);
      const response = await fetch(`${resolvedTrucksApiBasePath}/${truckId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        truck?: DmvTruckDetail;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load DMV truck.");
      }
      const nextTruck = data.truck ?? null;
      setTruck(nextTruck);

      const registrationId = nextTruck?.dmvRegistrations?.[0]?.id;
      if (!registrationId) {
        setAvailableDocuments([]);
        return;
      }

      const requirementsResponse = await fetch(
        `${resolvedRegistrationsApiBasePath}/${registrationId}/requirements`,
        {
          cache: "no-store",
        },
      );
      const requirementsData = (await requirementsResponse.json().catch(() => ({}))) as {
        availableDocuments?: ChecklistAvailableDocument[];
        error?: string;
      };

      if (!requirementsResponse.ok) {
        throw new Error(
          requirementsData.error || "Could not load DMV requirement documents.",
        );
      }

      setAvailableDocuments(
        Array.isArray(requirementsData.availableDocuments)
          ? requirementsData.availableDocuments
          : [],
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DMV truck.");
    } finally {
      setLoading(false);
    }
  }, [resolvedRegistrationsApiBasePath, resolvedTrucksApiBasePath, truckId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentRegistration = useMemo(() => truck?.dmvRegistrations?.[0] ?? null, [truck]);
  const currentRenewal = useMemo(() => currentRegistration?.renewals?.[0] ?? null, [currentRegistration]);
  const resolvedRenewalHrefBase =
    typeof renewalHrefBase === "undefined"
      ? mode === "staff"
        ? "/admin/features/dmv/renewals"
        : "/dmv/renewals"
      : renewalHrefBase;
  const resolvedNewRegistrationHref =
    newRegistrationHref ??
    (mode === "staff" ? "/admin/features/dmv/new" : "/dmv/new");

  useEffect(() => {
    if (!currentRegistration) return;

    setEditForm({
      registrationType: currentRegistration.registrationType ?? "",
      effectiveDate: currentRegistration.effectiveDate
        ? currentRegistration.effectiveDate.slice(0, 10)
        : "",
      expirationDate: currentRegistration.expirationDate
        ? currentRegistration.expirationDate.slice(0, 10)
        : "",
      declaredGrossWeight:
        typeof currentRegistration.declaredGrossWeight === "number"
          ? String(currentRegistration.declaredGrossWeight)
          : "",
      dmvAccountNumber: currentRegistration.dmvAccountNumber ?? "",
      fleetNumber: currentRegistration.fleetNumber ?? "",
      cabCardNumber: currentRegistration.cabCardNumber ?? "",
      plateNumber: currentRegistration.plateNumber ?? "",
      dotNumber: currentRegistration.dotNumber ?? "",
      mcNumber: currentRegistration.mcNumber ?? "",
      fein: currentRegistration.fein ?? "",
      nevadaAddress: currentRegistration.nevadaAddress ?? "",
      establishedBusinessOk: currentRegistration.establishedBusinessOk === true,
      carrierRelocated: currentRegistration.carrierRelocated === true,
    });
  }, [currentRegistration]);

  async function uploadRequirementDocument(requirement: ChecklistRequirement, file: File) {
    if (!currentRegistration) return;

    setUploadMessage(null);
    setActionMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", requirement.name);
    formData.append(
      "description",
      `DMV registration requirement upload for unit ${truck?.unitNumber ?? ""}`,
    );
    formData.append("category", "dmv-registration");

    const uploadResponse = await fetch(resolvedDocumentsApiBasePath, {
      method: "POST",
      body: formData,
    });

    const uploadedDocument = (await uploadResponse.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
    };

    if (!uploadResponse.ok || !uploadedDocument.id) {
      throw new Error(uploadedDocument.error || "Could not upload document.");
    }

      await attachExistingDocument(requirement, uploadedDocument.id);
    setUploadMessage(`Uploaded document for ${requirement.name}.`);
  }

  async function attachExistingDocument(
    requirement: ChecklistRequirement,
    documentId: string,
  ) {
    if (!currentRegistration) return;
    setActionMessage(null);

    const attachResponse = await fetch(
      `${resolvedRegistrationsApiBasePath}/${currentRegistration.id}/requirements`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: requirement.code,
          documentId,
          documentStatus: "PENDING",
        }),
      },
    );

    const attachData = (await attachResponse.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!attachResponse.ok) {
      throw new Error(attachData.error || "Could not attach document to requirement.");
    }

    await load();
  }

  async function unlinkRequirementDocument(
    requirement: ChecklistRequirement,
    document: ChecklistLinkedDocument,
  ) {
    if (!currentRegistration) return;

    setUploadMessage(null);
    setActionMessage(null);

    const response = await fetch(
      `${resolvedRegistrationsApiBasePath}/${currentRegistration.id}/requirements`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: requirement.code,
          documentId: document.document.id,
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      throw new Error(data.error || "Could not unlink document from requirement.");
    }

    await load();
    setUploadMessage(`Removed document from ${requirement.name}.`);
  }

  async function setRequirementReviewStatus(
    requirement: ChecklistRequirement,
    status: "APPROVED" | "REJECTED" | "WAIVED",
  ) {
    if (!currentRegistration) return;

    setUploadMessage(null);
    setActionMessage(null);

    const response = await fetch(
      `${resolvedRegistrationsApiBasePath}/${currentRegistration.id}/requirements`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: requirement.code,
          status,
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Could not update requirement status.");
    }

    setTruck((current) => {
      if (!current) return current;

      return {
        ...current,
        dmvRegistrations: current.dmvRegistrations.map((registration) => {
          if (registration.id !== currentRegistration.id) return registration;

          return {
            ...registration,
            requirements: registration.requirements.map((item) =>
              item.code === requirement.code
                ? {
                    ...item,
                    status,
                  }
                : item,
            ),
          };
        }),
      };
    });
    setActionMessage(`${requirement.name} marked as ${status.toLowerCase()}.`);
  }

  async function runRegistrationAction(
    endpoint: "review" | "ready" | "submit" | "approve" | "reject",
    successText: string,
    body?: Record<string, unknown>,
  ) {
    if (!currentRegistration) return;

    try {
      setActionBusy(endpoint);
      setError(null);
      setUploadMessage(null);
      setActionMessage(null);

      const response = await fetch(
        `${resolvedRegistrationsApiBasePath}/${currentRegistration.id}/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
      );

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not update DMV registration.");
      }

      await load();
      setActionMessage(successText);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Could not update DMV registration.",
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function saveRegistrationEdits() {
    if (!currentRegistration) return;

    try {
      setEditBusy(true);
      setError(null);
      setActionMessage(null);
      setUploadMessage(null);

      const response = await fetch(
        `${resolvedRegistrationsApiBasePath}/${currentRegistration.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationType: editForm.registrationType || undefined,
            effectiveDate: editForm.effectiveDate || null,
            expirationDate: editForm.expirationDate || null,
            declaredGrossWeight: editForm.declaredGrossWeight
              ? Number(editForm.declaredGrossWeight)
              : null,
            dmvAccountNumber: editForm.dmvAccountNumber || null,
            fleetNumber: editForm.fleetNumber || null,
            cabCardNumber: editForm.cabCardNumber || null,
            plateNumber: editForm.plateNumber || null,
            dotNumber: editForm.dotNumber || null,
            mcNumber: editForm.mcNumber || null,
            fein: editForm.fein || null,
            nevadaAddress: editForm.nevadaAddress || null,
            establishedBusinessOk: editForm.establishedBusinessOk,
            carrierRelocated: editForm.carrierRelocated,
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not update DMV registration.");
      }

      await load();
      setActionMessage("DMV registration updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update DMV registration.",
      );
    } finally {
      setEditBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading DMV truck...</div>;
  }

  if (error) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  if (!truck) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Truck not found.</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#ffedd5)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Truck Detail
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              Unit {truck.unitNumber}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              VIN {truck.vin || "not provided"}, {truck.year || "year n/a"} {truck.make || "make n/a"} {truck.model || ""}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {resolvedRenewalHrefBase ? (
              <Link
                href={resolvedRenewalHrefBase}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Renewals
              </Link>
            ) : null}
            <Link
              href={resolvedNewRegistrationHref}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              New registration
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Registration type
          </p>
          <p className="mt-3 text-lg font-semibold text-zinc-950">
            {registrationTypeLabel(currentRegistration?.registrationType)}
          </p>
        </article>
        <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Current status
          </p>
          <div className="mt-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${registrationStatusClasses(currentRegistration?.status)}`}>
              {registrationStatusLabel(currentRegistration?.status)}
            </span>
          </div>
        </article>
        <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Effective date
          </p>
          <p className="mt-3 text-lg font-semibold text-zinc-950">
            {formatDate(currentRegistration?.effectiveDate)}
          </p>
        </article>
        <article className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Expiration date
          </p>
          <p className="mt-3 text-lg font-semibold text-zinc-950">
            {formatDate(currentRegistration?.expirationDate)}
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Requirement Checklist
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-950">
            Current registration requirements
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            Upload a new file or attach an existing document directly to each DMV requirement.
          </p>
          <RequirementChecklist
            requirements={currentRegistration?.requirements ?? []}
            linkedDocuments={currentRegistration?.documents ?? []}
            availableDocuments={availableDocuments}
            emptyMessage="No requirements yet."
            uploadHint="Upload new file"
            successMessage={uploadMessage}
            isLocked={!canEditRegistration(currentRegistration?.status)}
            lockedMessage="Document uploads and unlink are only available before the registration is sent for review."
            canReviewRequirements={
              canReviewRegistration || canApproveRegistrationPermission
            }
            documentsApiBasePath={resolvedDocumentsApiBasePath}
            onUpload={uploadRequirementDocument}
            onAttachExisting={attachExistingDocument}
            onUnlinkDocument={unlinkRequirementDocument}
            onSetRequirementStatus={setRequirementReviewStatus}
          />
        </article>

        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Renewal Workspace
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-950">
            Current cycle
          </h3>
          {currentRenewal ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-sm text-zinc-500">Cycle year</p>
                <p className="mt-1 text-lg font-semibold text-zinc-950">{currentRenewal.cycleYear}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-sm text-zinc-500">Renewal status</p>
                <p className="mt-1 text-lg font-semibold text-zinc-950">
                  {renewalStatusLabel(currentRenewal.status)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 p-4">
                <p className="text-sm text-zinc-500">Due date</p>
                <p className="mt-1 text-lg font-semibold text-zinc-950">
                  {formatDate(currentRenewal.dueDate)}
                </p>
              </div>
              {resolvedRenewalHrefBase ? (
                <Link
                  href={resolvedRenewalHrefBase}
                  className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                >
                  Open renewals module
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="mt-5 text-sm text-zinc-500">No renewal has been opened for this registration yet.</p>
          )}
        </article>
      </section>

      {mode === "staff" && currentRegistration ? (
        <StaffFilingPaymentPanel
          filingType="dmv-registration"
          filingId={currentRegistration.id}
        />
      ) : null}

      {canUpdateRegistration && currentRegistration ? (
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Registration Edit
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-950">
            Update DMV registration details
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            Edit the case details before staff finalizes review and filing.
          </p>
          {!canEditRegistration(currentRegistration.status) ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Registration editing is locked after the case has been sent for review.
            </div>
          ) : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Registration type</span>
              <select
                value={editForm.registrationType}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    registrationType: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              >
                <option value="NEVADA_ONLY">Nevada only</option>
                <option value="IRP">IRP</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Declared gross weight</span>
              <input
                value={editForm.declaredGrossWeight}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    declaredGrossWeight: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Effective date</span>
              <input
                type="date"
                value={editForm.effectiveDate}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    effectiveDate: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Expiration date</span>
              <input
                type="date"
                value={editForm.expirationDate}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    expirationDate: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">DMV account number</span>
              <input
                value={editForm.dmvAccountNumber}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    dmvAccountNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Fleet number</span>
              <input
                value={editForm.fleetNumber}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    fleetNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Cab card number</span>
              <input
                value={editForm.cabCardNumber}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    cabCardNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Plate number</span>
              <input
                value={editForm.plateNumber}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    plateNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">DOT number</span>
              <input
                value={editForm.dotNumber}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    dotNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">MC number</span>
              <input
                value={editForm.mcNumber}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    mcNumber: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">FEIN</span>
              <input
                value={editForm.fein}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    fein: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Nevada address</span>
              <input
                value={editForm.nevadaAddress}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    nevadaAddress: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={editForm.establishedBusinessOk}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    establishedBusinessOk: event.target.checked,
                  }))
                }
              />
              <span>Established place of business validated</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={editForm.carrierRelocated}
                disabled={!canEditRegistration(currentRegistration.status)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    carrierRelocated: event.target.checked,
                  }))
                }
              />
              <span>Carrier relocated from another jurisdiction</span>
            </label>
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => void saveRegistrationEdits()}
              disabled={editBusy || !canEditRegistration(currentRegistration.status)}
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {editBusy ? "Saving..." : "Save registration changes"}
            </button>
          </div>
        </section>
      ) : null}

      {(canUpdateRegistration || canReviewRegistration || canApproveRegistrationPermission) &&
      currentRegistration ? (
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Staff Actions
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-950">
            Review and decision controls
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            Use the actions below to move the registration through internal review, filing, and final DMV outcome.
          </p>
          {actionMessage ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionMessage}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            {canUpdateRegistration && canSendRegistrationToReview(currentRegistration.status) ? (
              <button
                type="button"
                onClick={() =>
                  runRegistrationAction(
                    "review",
                    currentRegistration.status === "CORRECTION_REQUIRED"
                      ? "Registration resubmitted for staff review."
                      : "Registration sent to staff review.",
                  )
                }
                disabled={actionBusy !== null}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionBusy === "review"
                  ? "Working..."
                  : currentRegistration.status === "CORRECTION_REQUIRED"
                    ? "Resubmit for review"
                    : "Send to review"}
              </button>
            ) : null}
            {canReviewRegistration && canMarkRegistrationReady(currentRegistration.status) ? (
              <button
                type="button"
                onClick={() => runRegistrationAction("ready", "Registration marked ready for filing.")}
                disabled={actionBusy !== null}
                className="rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionBusy === "ready" ? "Working..." : "Mark ready"}
              </button>
            ) : null}
            {canUpdateRegistration && canSubmitRegistration(currentRegistration.status) ? (
              <button
                type="button"
                onClick={() => runRegistrationAction("submit", "Registration marked as submitted to DMV.")}
                disabled={actionBusy !== null}
                className="rounded-2xl border border-sky-300 px-4 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionBusy === "submit" ? "Working..." : "Mark submitted"}
              </button>
            ) : null}
            {canApproveRegistrationPermission && canApproveRegistration(currentRegistration.status) ? (
              <button
                type="button"
                onClick={() => runRegistrationAction("approve", "Registration approved by DMV.")}
                disabled={actionBusy !== null}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionBusy === "approve" ? "Working..." : "Approve"}
              </button>
            ) : null}
            {canApproveRegistrationPermission && canActivateRegistration(currentRegistration.status) ? (
              <button
                type="button"
                onClick={() =>
                  runRegistrationAction("approve", "Registration activated.", {
                    activate: true,
                  })
                }
                disabled={actionBusy !== null}
                className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionBusy === "approve" ? "Working..." : "Activate"}
              </button>
            ) : null}
            {canReviewRegistration && canRejectRegistration(currentRegistration.status) ? (
              <button
                type="button"
                onClick={() => runRegistrationAction("reject", "Registration rejected.")}
                disabled={actionBusy !== null}
                className="rounded-2xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actionBusy === "reject" ? "Working..." : "Reject"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
