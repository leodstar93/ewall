import { Form2290DocumentType } from "@prisma/client";
import { autoClassifyDocument } from "@/services/documents/auto-classify";

export function infer2290DocumentCategory(mimeType: string | null | undefined) {
  if (!mimeType) return "form-2290-supporting-document";
  if (mimeType === "application/pdf") return "form-2290-pdf-document";
  if (mimeType.startsWith("image/")) return "form-2290-image-document";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    mimeType === "text/csv"
  ) {
    return "form-2290-spreadsheet-document";
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return "form-2290-text-document";
  }
  return "form-2290-supporting-document";
}

export function autoClassify2290DocumentType(input: {
  originalFileName: string;
  mimeType?: string | null;
  providedCategory?: string | null;
}) {
  const classification = autoClassifyDocument({
    originalFileName: input.originalFileName,
    mimeType: input.mimeType,
    providedCategory: input.providedCategory ?? infer2290DocumentCategory(input.mimeType),
    uploaderRole: "client",
  });
  const fingerprint = [
    input.originalFileName,
    classification.category,
    classification.displayName,
  ]
    .join(" ")
    .toLowerCase();

  if (/schedule.?1|stamped|irs.?2290|2290.?schedule/.test(fingerprint)) {
    return Form2290DocumentType.SCHEDULE_1;
  }

  if (/receipt|payment|paid|invoice|transaction|charge|confirmation/.test(fingerprint)) {
    return Form2290DocumentType.PAYMENT_PROOF;
  }

  if (/authorization|signed|signature|consent|power.?of.?attorney/.test(fingerprint)) {
    return Form2290DocumentType.AUTHORIZATION;
  }

  if (/provider|efile|e.?file|submission|accepted|confirmation/.test(fingerprint)) {
    return Form2290DocumentType.PROVIDER_CONFIRMATION;
  }

  return Form2290DocumentType.SUPPORTING_DOC;
}
