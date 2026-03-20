"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import RequirementChecklist, {
  ChecklistAvailableDocument,
  ChecklistLinkedDocument,
  ChecklistRequirement,
} from "@/features/dmv/requirement-checklist";
import { formatDate, renewalStatusLabel } from "@/features/dmv/shared";

type RenewalPageProps = {
  renewalId: string;
  mode?: "driver" | "staff";
  canReviewRequirements?: boolean;
};

type RenewalDetail = {
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
  clientNotes: string | null;
  totalMiles: number | null;
  nvMiles: number | null;
  registration: {
    truck: {
      unitNumber: string;
    };
  };
  requirements: ChecklistRequirement[];
  documents: ChecklistLinkedDocument[];
};

export default function DmvRenewalPage({
  renewalId,
  mode = "driver",
  canReviewRequirements = false,
}: RenewalPageProps) {
  const [renewal, setRenewal] = useState<RenewalDetail | null>(null);
  const [availableDocuments, setAvailableDocuments] = useState<ChecklistAvailableDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [totalMiles, setTotalMiles] = useState("");
  const [nvMiles, setNvMiles] = useState("");

  const loadRenewal = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/features/dmv/renewals/${renewalId}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        renewal?: RenewalDetail;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "Could not load DMV renewal.");
      }
      const nextRenewal = data.renewal ?? null;
      setRenewal(nextRenewal);
      setClientNotes(nextRenewal?.clientNotes ?? "");
      setTotalMiles(String(nextRenewal?.totalMiles ?? ""));
      setNvMiles(String(nextRenewal?.nvMiles ?? ""));

      if (!nextRenewal?.id) {
        setAvailableDocuments([]);
        return;
      }

      const requirementsResponse = await fetch(
        `/api/v1/features/dmv/renewals/${nextRenewal.id}/requirements`,
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
          requirementsData.error || "Could not load DMV renewal documents.",
        );
      }

      setAvailableDocuments(
        Array.isArray(requirementsData.availableDocuments)
          ? requirementsData.availableDocuments
          : [],
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load DMV renewal.");
    } finally {
      setLoading(false);
    }
  }, [renewalId]);

  useEffect(() => {
    void loadRenewal();
  }, [loadRenewal]);

  async function saveWorkspace() {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`/api/v1/features/dmv/renewals/${renewalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientNotes,
          totalMiles: totalMiles ? Number(totalMiles) : null,
          nvMiles: nvMiles ? Number(nvMiles) : null,
          mileageSource: totalMiles ? "MANUAL" : null,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save DMV renewal.");
      }
      await loadRenewal();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save DMV renewal.");
    } finally {
      setSaving(false);
    }
  }

  async function attachExistingDocument(
    requirement: ChecklistRequirement,
    documentId: string,
  ) {
    if (!renewal) return;

    const response = await fetch(
      `/api/v1/features/dmv/renewals/${renewal.id}/requirements`,
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
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Could not attach renewal document.");
    }

    await loadRenewal();
  }

  async function uploadRequirementDocument(
    requirement: ChecklistRequirement,
    file: File,
  ) {
    if (!renewal) return;

    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", requirement.name);
    formData.append(
      "description",
      `DMV renewal requirement upload for unit ${renewal.registration.truck.unitNumber}`,
    );
    formData.append("category", "dmv-renewal");

    const uploadResponse = await fetch("/api/v1/features/documents", {
      method: "POST",
      body: formData,
    });
    const uploadedDocument = (await uploadResponse.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
    };
    if (!uploadResponse.ok || !uploadedDocument.id) {
      throw new Error(uploadedDocument.error || "Could not upload renewal document.");
    }

    await attachExistingDocument(requirement, uploadedDocument.id);
    setUploadMessage(`Uploaded document for ${requirement.name}.`);
  }

  async function unlinkRequirementDocument(
    requirement: ChecklistRequirement,
    document: ChecklistLinkedDocument,
  ) {
    if (!renewal) return;

    setUploadMessage(null);

    const response = await fetch(
      `/api/v1/features/dmv/renewals/${renewal.id}/requirements`,
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
      throw new Error(data.error || "Could not unlink renewal document.");
    }

    await loadRenewal();
    setUploadMessage(`Removed document from ${requirement.name}.`);
  }

  async function setRequirementReviewStatus(
    requirement: ChecklistRequirement,
    status: "APPROVED" | "REJECTED" | "WAIVED",
  ) {
    if (!renewal) return;

    setUploadMessage(null);

    const response = await fetch(
      `/api/v1/features/dmv/renewals/${renewal.id}/requirements`,
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
      throw new Error(data.error || "Could not update renewal requirement.");
    }

    setRenewal((current) => {
      if (!current) return current;

      return {
        ...current,
        requirements: current.requirements.map((item) =>
          item.code === requirement.code
            ? {
                ...item,
                status,
              }
            : item,
        ),
      };
    });
    setUploadMessage(`${requirement.name} marked as ${status.toLowerCase()}.`);
  }

  if (loading) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Loading DMV renewal...</div>;
  }

  if (error) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  if (!renewal) {
    return <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-sm">Renewal not found.</div>;
  }

  const backHref = mode === "staff" ? "/admin/features/dmv" : "/dmv";

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_50%,_#fef3c7)] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Renewal Workspace
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
              {renewal.registration.truck.unitNumber} renewal for {renewal.cycleYear}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Status {renewalStatusLabel(renewal.status)}. Due {formatDate(renewal.dueDate)}.
            </p>
          </div>
          <Link
            href={backHref}
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Back to DMV queue
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">Mileage + notes</h3>
          <div className="mt-5 grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Total miles</span>
              <input value={totalMiles} onChange={(event) => setTotalMiles(event.target.value)} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Nevada miles</span>
              <input value={nvMiles} onChange={(event) => setNvMiles(event.target.value)} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-zinc-700">Client notes</span>
              <textarea value={clientNotes} onChange={(event) => setClientNotes(event.target.value)} rows={5} className="w-full rounded-2xl border border-zinc-300 px-3 py-2" />
            </label>
            <button onClick={saveWorkspace} disabled={saving} className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400">
              {saving ? "Saving..." : "Save renewal workspace"}
            </button>
          </div>
        </article>

        <article className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-zinc-950">Checklist</h3>
          <p className="mt-2 text-sm text-zinc-600">
            Add new files, attach existing ones, and preview requirement documents directly from the renewal workspace.
          </p>
          <RequirementChecklist
            requirements={renewal.requirements}
            linkedDocuments={renewal.documents}
            availableDocuments={availableDocuments}
            emptyMessage="No renewal requirements yet."
            uploadHint="Upload new file"
            successMessage={uploadMessage}
            isLocked={renewal.status === "UNDER_REVIEW"}
            lockedMessage="Document changes are locked while this renewal is under review."
            canReviewRequirements={canReviewRequirements}
            onUpload={uploadRequirementDocument}
            onAttachExisting={attachExistingDocument}
            onUnlinkDocument={unlinkRequirementDocument}
            onSetRequirementStatus={setRequirementReviewStatus}
          />
        </article>
      </section>
    </div>
  );
}
