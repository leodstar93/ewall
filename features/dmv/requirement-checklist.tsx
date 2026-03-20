"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { requirementStatusLabel } from "@/features/dmv/shared";

export type ChecklistRequirement = {
  id: string;
  code: string;
  name: string;
  status: "MISSING" | "UPLOADED" | "APPROVED" | "REJECTED" | "WAIVED";
};

export type ChecklistLinkedDocument = {
  id: string;
  requirementCode: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  document: {
    id: string;
    name: string;
    fileName: string;
    createdAt: string;
  };
};

export type ChecklistAvailableDocument = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  createdAt: string;
};

type ChecklistRequirementReviewStatus = "APPROVED" | "REJECTED" | "WAIVED";

type RequirementChecklistProps = {
  requirements: ChecklistRequirement[];
  linkedDocuments: ChecklistLinkedDocument[];
  availableDocuments: ChecklistAvailableDocument[];
  emptyMessage: string;
  uploadHint: string;
  successMessage?: string | null;
  isLocked?: boolean;
  lockedMessage?: string | null;
  canReviewRequirements?: boolean;
  onUpload: (requirement: ChecklistRequirement, file: File) => Promise<void>;
  onAttachExisting: (
    requirement: ChecklistRequirement,
    documentId: string,
  ) => Promise<void>;
  onUnlinkDocument: (
    requirement: ChecklistRequirement,
    document: ChecklistLinkedDocument,
  ) => Promise<void>;
  onSetRequirementStatus?: (
    requirement: ChecklistRequirement,
    status: ChecklistRequirementReviewStatus,
  ) => Promise<void>;
};

export default function RequirementChecklist({
  requirements,
  linkedDocuments,
  availableDocuments,
  emptyMessage,
  uploadHint,
  successMessage,
  isLocked = false,
  lockedMessage,
  canReviewRequirements = false,
  onUpload,
  onAttachExisting,
  onUnlinkDocument,
  onSetRequirementStatus,
}: RequirementChecklistProps) {
  const [busyRequirementCode, setBusyRequirementCode] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const pendingRequirementRef = useRef<ChecklistRequirement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const documentsByRequirement = useMemo(
    () =>
      new Map(
        requirements.map((requirement) => [
          requirement.code,
          linkedDocuments.filter((document) => document.requirementCode === requirement.code),
        ]),
      ),
    [linkedDocuments, requirements],
  );

  function beginUpload(requirement: ChecklistRequirement) {
    if (isLocked) return;
    pendingRequirementRef.current = requirement;
    setLocalError(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const requirement = pendingRequirementRef.current;

    if (!file || !requirement) {
      event.target.value = "";
      pendingRequirementRef.current = null;
      return;
    }

    try {
      setBusyRequirementCode(requirement.code);
      setLocalError(null);
      await onUpload(requirement, file);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not upload document.",
      );
    } finally {
      setBusyRequirementCode(null);
      pendingRequirementRef.current = null;
      event.target.value = "";
    }
  }

  async function attachExisting(requirement: ChecklistRequirement) {
    if (isLocked) return;
    const documentId = selectedDocumentIds[requirement.code];
    if (!documentId) {
      setLocalError("Choose an existing document before attaching it.");
      return;
    }

    try {
      setBusyRequirementCode(requirement.code);
      setLocalError(null);
      await onAttachExisting(requirement, documentId);
      setSelectedDocumentIds((current) => ({ ...current, [requirement.code]: "" }));
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not attach existing document.",
      );
    } finally {
      setBusyRequirementCode(null);
    }
  }

  async function unlinkDocument(
    requirement: ChecklistRequirement,
    document: ChecklistLinkedDocument,
  ) {
    if (isLocked) return;
    try {
      setBusyRequirementCode(requirement.code);
      setLocalError(null);
      await onUnlinkDocument(requirement, document);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not unlink document.",
      );
    } finally {
      setBusyRequirementCode(null);
    }
  }

  async function setRequirementStatus(
    requirement: ChecklistRequirement,
    status: ChecklistRequirementReviewStatus,
  ) {
    if (!canReviewRequirements || !onSetRequirementStatus) return;

    try {
      setBusyRequirementCode(requirement.code);
      setLocalError(null);
      await onSetRequirementStatus(requirement, status);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not update requirement status.",
      );
    } finally {
      setBusyRequirementCode(null);
    }
  }

  return (
    <>
      {successMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}
      {localError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {localError}
        </div>
      ) : null}
      {isLocked && lockedMessage ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {lockedMessage}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {requirements.length === 0 ? (
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        ) : (
          requirements.map((requirement) => {
            const requirementDocuments = documentsByRequirement.get(requirement.code) ?? [];
            const attachableDocuments = availableDocuments.filter(
              (document) =>
                !requirementDocuments.some(
                  (linkedDocument) => linkedDocument.document.id === document.id,
                ),
            );

            return (
              <div
                key={requirement.id}
                className="rounded-2xl border border-zinc-200 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-zinc-900">{requirement.name}</p>
                    <p className="text-xs text-zinc-500">{requirement.code}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                    {requirementStatusLabel(requirement.status)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => beginUpload(requirement)}
                    disabled={isLocked || busyRequirementCode === requirement.code}
                    className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    {busyRequirementCode === requirement.code ? "Working..." : uploadHint}
                  </button>

                  <select
                    value={selectedDocumentIds[requirement.code] ?? ""}
                    disabled={isLocked || busyRequirementCode === requirement.code}
                    onChange={(event) =>
                      setSelectedDocumentIds((current) => ({
                        ...current,
                        [requirement.code]: event.target.value,
                      }))
                    }
                    className="min-w-[220px] rounded-xl border border-zinc-300 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  >
                    <option value="">Attach existing document</option>
                    {attachableDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.name} - {document.fileName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => attachExisting(requirement)}
                    disabled={isLocked || busyRequirementCode === requirement.code}
                    className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Attach existing
                  </button>
                </div>

                {canReviewRequirements && onSetRequirementStatus ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
                    {requirement.status !== "APPROVED" ? (
                      <button
                        type="button"
                        onClick={() => setRequirementStatus(requirement, "APPROVED")}
                        disabled={busyRequirementCode === requirement.code}
                        className="rounded-xl border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Approve
                      </button>
                    ) : null}
                    {requirement.status !== "REJECTED" ? (
                      <button
                        type="button"
                        onClick={() => setRequirementStatus(requirement, "REJECTED")}
                        disabled={busyRequirementCode === requirement.code}
                        className="rounded-xl border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Reject
                      </button>
                    ) : null}
                    {requirement.status !== "WAIVED" ? (
                      <button
                        type="button"
                        onClick={() => setRequirementStatus(requirement, "WAIVED")}
                        disabled={busyRequirementCode === requirement.code}
                        className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Waive
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {requirementDocuments.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {requirementDocuments.map((documentLink) => (
                      <div
                        key={documentLink.id}
                        className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {documentLink.document.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {documentLink.document.fileName} · {documentLink.status.toLowerCase()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/api/v1/features/documents/${documentLink.document.id}/view`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-white"
                          >
                            Preview
                          </a>
                          <a
                            href={`/api/v1/features/documents/${documentLink.document.id}/download`}
                            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-white"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => unlinkDocument(requirement, documentLink)}
                            disabled={isLocked || busyRequirementCode === requirement.code}
                            className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Unlink
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  );
}
