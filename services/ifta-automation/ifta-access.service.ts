import {
  IftaAccessMode,
  IftaFilingMethod,
  IftaJurisdictionPaymentMethod,
  Prisma,
} from "@prisma/client";
import { decryptEldSecret, encryptEldSecret } from "@/lib/eld-provider-encryption";
import { prisma } from "@/lib/prisma";
import { ensureUserOrganization } from "@/lib/services/organization.service";
import { SettingsValidationError } from "@/lib/services/settings-errors";
import { FilingWorkflowService } from "@/services/ifta-automation/filing-workflow.service";
import {
  type DbLike,
  IftaAutomationError,
  resolveDb,
} from "@/services/ifta-automation/shared";

type CredentialInput = {
  username?: unknown;
  password?: unknown;
  pin?: unknown;
  notes?: unknown;
};

type IftaAccessUpdateInput = {
  iftaAccessMode?: unknown;
  iftaAccessNote?: unknown;
  credential?: CredentialInput;
};

type ProcedureRecord = {
  jurisdiction: string;
  title: string;
  portalUrl: string | null;
  filingMethod: IftaFilingMethod;
  paymentMethod: IftaJurisdictionPaymentMethod;
  requiresPortalLogin: boolean;
  requiresClientCredential: boolean;
  supportsUpload: boolean;
  staffInstructions: Prisma.JsonValue;
  checklist: Prisma.JsonValue | null;
};

export type CompanyIftaAccessResponse = {
  state: string | null;
  iftaAccessMode: IftaAccessMode;
  iftaAccessNote: string | null;
  hasSavedCredential: boolean;
  savedCredentialJurisdiction?: string;
};

export type StaffIftaInstructionsResponse = {
  filingId: string;
  baseJurisdiction: string | null;
  accessMode: IftaAccessMode;
  paymentInfoMode: "CONTACT_CLIENT";
  procedure: {
    title: string;
    portalUrl?: string;
    filingMethod: IftaFilingMethod;
    paymentMethod: IftaJurisdictionPaymentMethod;
    requiresPortalLogin: boolean;
    supportsUpload: boolean;
    staffInstructions: {
      steps: string[];
    };
    checklist?: unknown;
  } | null;
  hasSavedPortalCredential: boolean;
};

export type RevealedPortalCredentialResponse = {
  jurisdiction: string;
  username: string | null;
  password: string | null;
  pin: string | null;
  notes: string | null;
};

function normalizeJurisdiction(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || null;
}

function normalizeOptionalString(
  value: unknown,
  label: string,
  maxLength: number,
) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new SettingsValidationError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new SettingsValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function normalizeMode(value: unknown) {
  if (value === IftaAccessMode.SAVED_IN_SYSTEM || value === IftaAccessMode.CONTACT_ME) {
    return value;
  }

  throw new SettingsValidationError("Invalid IFTA access mode.");
}

function hasOwn(input: object, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function normalizeSteps(value: Prisma.JsonValue): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }

  const maybeSteps = (value as { steps?: unknown }).steps;
  if (!Array.isArray(maybeSteps)) {
    return [];
  }

  return maybeSteps
    .map((step) => (typeof step === "string" ? step.trim() : ""))
    .filter(Boolean);
}

function procedureToSnapshot(procedure: ProcedureRecord) {
  return {
    jurisdiction: procedure.jurisdiction,
    title: procedure.title,
    portalUrl: procedure.portalUrl,
    filingMethod: procedure.filingMethod,
    paymentMethod: procedure.paymentMethod,
    requiresPortalLogin: procedure.requiresPortalLogin,
    requiresClientCredential: procedure.requiresClientCredential,
    supportsUpload: procedure.supportsUpload,
    staffInstructions: procedure.staffInstructions,
    checklist: procedure.checklist,
  } satisfies Prisma.JsonObject;
}

function snapshotToProcedure(
  value: Prisma.JsonValue | null,
): StaffIftaInstructionsResponse["procedure"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as {
    title?: unknown;
    portalUrl?: unknown;
    filingMethod?: unknown;
    paymentMethod?: unknown;
    requiresPortalLogin?: unknown;
    supportsUpload?: unknown;
    staffInstructions?: Prisma.JsonValue;
    checklist?: unknown;
  };

  if (
    typeof candidate.title !== "string" ||
    typeof candidate.filingMethod !== "string" ||
    typeof candidate.paymentMethod !== "string" ||
    typeof candidate.requiresPortalLogin !== "boolean" ||
    typeof candidate.supportsUpload !== "boolean"
  ) {
    return null;
  }

  const steps = normalizeSteps(candidate.staffInstructions ?? null);

  return {
    title: candidate.title,
    portalUrl: typeof candidate.portalUrl === "string" ? candidate.portalUrl : undefined,
    filingMethod: candidate.filingMethod as IftaFilingMethod,
    paymentMethod: candidate.paymentMethod as IftaJurisdictionPaymentMethod,
    requiresPortalLogin: candidate.requiresPortalLogin,
    supportsUpload: candidate.supportsUpload,
    staffInstructions: { steps },
    checklist: typeof candidate.checklist === "undefined" ? undefined : candidate.checklist,
  };
}

function recordToProcedure(
  procedure: ProcedureRecord | null,
): StaffIftaInstructionsResponse["procedure"] {
  if (!procedure) return null;

  return {
    title: procedure.title,
    portalUrl: procedure.portalUrl ?? undefined,
    filingMethod: procedure.filingMethod,
    paymentMethod: procedure.paymentMethod,
    requiresPortalLogin: procedure.requiresPortalLogin,
    supportsUpload: procedure.supportsUpload,
    staffInstructions: {
      steps: normalizeSteps(procedure.staffInstructions),
    },
    checklist: procedure.checklist ?? undefined,
  };
}

async function getCompanyProfileWithAccess(userId: string) {
  const organization = await ensureUserOrganization(userId);
  const companyProfile = await prisma.companyProfile.findUnique({
    where: { id: organization.id },
    select: {
      id: true,
      state: true,
      iftaAccessMode: true,
      iftaAccessNote: true,
    },
  });

  if (!companyProfile) {
    throw new SettingsValidationError("Company profile not found.");
  }

  return companyProfile;
}

async function getActivePortalCredentialForCompany(
  companyProfileId: string,
  jurisdiction: string | null,
  db?: DbLike,
) {
  if (!jurisdiction) return null;

  const resolvedDb = resolveDb(db ?? null);
  return resolvedDb.iftaPortalCredential.findFirst({
    where: {
      companyProfileId,
      jurisdiction,
      isActive: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

async function getActiveJurisdictionProcedure(
  jurisdiction: string | null,
  db?: DbLike,
): Promise<ProcedureRecord | null> {
  if (!jurisdiction) return null;

  const resolvedDb = resolveDb(db ?? null);
  return resolvedDb.iftaJurisdictionProcedure.findFirst({
    where: {
      jurisdiction,
      isActive: true,
    },
    select: {
      jurisdiction: true,
      title: true,
      portalUrl: true,
      filingMethod: true,
      paymentMethod: true,
      requiresPortalLogin: true,
      requiresClientCredential: true,
      supportsUpload: true,
      staffInstructions: true,
      checklist: true,
    },
  });
}

export async function getCompanyIftaAccess(userId: string): Promise<CompanyIftaAccessResponse> {
  const companyProfile = await getCompanyProfileWithAccess(userId);
  const jurisdiction = normalizeJurisdiction(companyProfile.state);
  const credential = await getActivePortalCredentialForCompany(
    companyProfile.id,
    jurisdiction,
    prisma,
  );

  return {
    state: jurisdiction,
    iftaAccessMode: companyProfile.iftaAccessMode ?? IftaAccessMode.CONTACT_ME,
    iftaAccessNote: companyProfile.iftaAccessNote ?? null,
    hasSavedCredential: Boolean(credential),
    savedCredentialJurisdiction: credential?.jurisdiction,
  };
}

export async function updateCompanyIftaAccess(
  userId: string,
  input: IftaAccessUpdateInput,
): Promise<CompanyIftaAccessResponse> {
  const companyProfile = await getCompanyProfileWithAccess(userId);
  const jurisdiction = normalizeJurisdiction(companyProfile.state);

  if (!jurisdiction) {
    throw new SettingsValidationError(
      "Company state is required before configuring IFTA access.",
    );
  }

  const iftaAccessMode = normalizeMode(input.iftaAccessMode);
  const iftaAccessNote = normalizeOptionalString(
    input.iftaAccessNote,
    "IFTA access note",
    500,
  );

  await prisma.$transaction(async (tx) => {
    await tx.companyProfile.update({
      where: { id: companyProfile.id },
      data: {
        iftaAccessMode,
        iftaAccessNote,
      },
    });

    if (iftaAccessMode === IftaAccessMode.CONTACT_ME) {
      await tx.iftaPortalCredential.updateMany({
        where: {
          companyProfileId: companyProfile.id,
          jurisdiction,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
      return;
    }

    const rawCredential =
      typeof input.credential === "object" && input.credential !== null ? input.credential : {};
    const usernameProvided = hasOwn(rawCredential, "username");
    const passwordProvided = hasOwn(rawCredential, "password");
    const pinProvided = hasOwn(rawCredential, "pin");
    const notesProvided = hasOwn(rawCredential, "notes");

    const username = usernameProvided
      ? normalizeOptionalString(rawCredential.username, "Portal username", 160)
      : undefined;
    const password = passwordProvided
      ? normalizeOptionalString(rawCredential.password, "Portal password", 200)
      : undefined;
    const pin = pinProvided
      ? normalizeOptionalString(rawCredential.pin, "Portal PIN", 80)
      : undefined;
    const notes = notesProvided
      ? normalizeOptionalString(rawCredential.notes, "Portal notes", 500)
      : undefined;

    const existing = await getActivePortalCredentialForCompany(
      companyProfile.id,
      jurisdiction,
      tx,
    );

    if ((!existing && !username) || (!existing && !password)) {
      throw new SettingsValidationError(
        "Username and password are required before saving IFTA portal credentials.",
      );
    }

    if (usernameProvided && !username) {
      throw new SettingsValidationError("Portal username is required.");
    }

    if (passwordProvided && !password) {
      throw new SettingsValidationError("Portal password is required.");
    }

    await tx.iftaPortalCredential.updateMany({
      where: {
        companyProfileId: companyProfile.id,
        jurisdiction,
        isActive: true,
        ...(existing
          ? {
              id: {
                not: existing.id,
              },
            }
          : {}),
      },
      data: {
        isActive: false,
      },
    });

    if (existing) {
      await tx.iftaPortalCredential.update({
        where: { id: existing.id },
        data: {
          usernameEncrypted:
            typeof username === "string"
              ? encryptEldSecret(username)
              : existing.usernameEncrypted,
          passwordEncrypted:
            typeof password === "string"
              ? encryptEldSecret(password)
              : existing.passwordEncrypted,
          pinEncrypted:
            typeof pin === "undefined"
              ? existing.pinEncrypted
              : pin
                ? encryptEldSecret(pin)
                : null,
          notesEncrypted:
            typeof notes === "undefined"
              ? existing.notesEncrypted
              : notes
                ? encryptEldSecret(notes)
                : null,
          isActive: true,
        },
      });
      return;
    }

    await tx.iftaPortalCredential.create({
      data: {
        companyProfileId: companyProfile.id,
        jurisdiction,
        usernameEncrypted: username ? encryptEldSecret(username) : null,
        passwordEncrypted: password ? encryptEldSecret(password) : null,
        pinEncrypted: pin ? encryptEldSecret(pin) : null,
        notesEncrypted: notes ? encryptEldSecret(notes) : null,
        isActive: true,
      },
    });
  });

  return getCompanyIftaAccess(userId);
}

export async function ensureFilingIftaSnapshots(input: {
  filingId: string;
  db?: DbLike;
}) {
  const db = resolveDb(input.db ?? null);
  const filing = await db.iftaFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      tenantId: true,
      baseJurisdictionSnapshot: true,
      iftaAccessModeSnapshot: true,
      jurisdictionProcedureSnapshot: true,
      tenant: {
        select: {
          state: true,
          iftaAccessMode: true,
        },
      },
    },
  });

  if (!filing) {
    throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
  }

  const jurisdiction = normalizeJurisdiction(filing.tenant.state);
  const procedure = await getActiveJurisdictionProcedure(jurisdiction, db);
  const data: Prisma.IftaFilingUpdateInput = {};

  if (!filing.baseJurisdictionSnapshot && jurisdiction) {
    data.baseJurisdictionSnapshot = jurisdiction;
  }

  if (!filing.iftaAccessModeSnapshot) {
    data.iftaAccessModeSnapshot =
      filing.tenant.iftaAccessMode ?? IftaAccessMode.CONTACT_ME;
  }

  if (filing.jurisdictionProcedureSnapshot == null && procedure) {
    data.jurisdictionProcedureSnapshot = procedureToSnapshot(procedure);
  }

  if (Object.keys(data).length === 0) {
    return filing;
  }

  return db.iftaFiling.update({
    where: { id: filing.id },
    data,
  });
}

export async function getStaffIftaInstructions(
  filingId: string,
  db?: DbLike,
): Promise<StaffIftaInstructionsResponse> {
  const resolvedDb = resolveDb(db ?? null);
  const filing = await resolvedDb.iftaFiling.findUnique({
    where: { id: filingId },
    select: {
      id: true,
      tenantId: true,
      baseJurisdictionSnapshot: true,
      iftaAccessModeSnapshot: true,
      jurisdictionProcedureSnapshot: true,
      tenant: {
        select: {
          state: true,
          iftaAccessMode: true,
        },
      },
    },
  });

  if (!filing) {
    throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
  }

  const baseJurisdiction =
    filing.baseJurisdictionSnapshot ?? normalizeJurisdiction(filing.tenant.state);
  const accessMode =
    filing.iftaAccessModeSnapshot ??
    filing.tenant.iftaAccessMode ??
    IftaAccessMode.CONTACT_ME;
  const snapshotProcedure = snapshotToProcedure(filing.jurisdictionProcedureSnapshot);
  const liveProcedure = snapshotProcedure
    ? null
    : await getActiveJurisdictionProcedure(baseJurisdiction, resolvedDb);
  const procedure = snapshotProcedure ?? recordToProcedure(liveProcedure);
  const activeCredential = await getActivePortalCredentialForCompany(
    filing.tenantId,
    baseJurisdiction,
    resolvedDb,
  );

  return {
    filingId: filing.id,
    baseJurisdiction,
    accessMode,
    paymentInfoMode: "CONTACT_CLIENT",
    procedure,
    hasSavedPortalCredential: Boolean(activeCredential),
  };
}

export async function revealPortalCredentialsForFiling(input: {
  filingId: string;
  actorUserId: string;
  db?: DbLike;
}): Promise<RevealedPortalCredentialResponse> {
  const db = resolveDb(input.db ?? null);
  const filing = await db.iftaFiling.findUnique({
    where: { id: input.filingId },
    select: {
      id: true,
      tenantId: true,
      baseJurisdictionSnapshot: true,
      tenant: {
        select: {
          state: true,
        },
      },
    },
  });

  if (!filing) {
    throw new IftaAutomationError("IFTA filing not found.", 404, "IFTA_FILING_NOT_FOUND");
  }

  const jurisdiction =
    filing.baseJurisdictionSnapshot ?? normalizeJurisdiction(filing.tenant.state);
  if (!jurisdiction) {
    throw new IftaAutomationError(
      "No base jurisdiction is configured for this filing.",
      400,
      "IFTA_BASE_JURISDICTION_MISSING",
    );
  }

  const credential = await getActivePortalCredentialForCompany(
    filing.tenantId,
    jurisdiction,
    db,
  );
  const response: RevealedPortalCredentialResponse = {
    jurisdiction,
    username: credential?.usernameEncrypted
      ? decryptEldSecret(credential.usernameEncrypted)
      : null,
    password: credential?.passwordEncrypted
      ? decryptEldSecret(credential.passwordEncrypted)
      : null,
    pin: credential?.pinEncrypted ? decryptEldSecret(credential.pinEncrypted) : null,
    notes: credential?.notesEncrypted ? decryptEldSecret(credential.notesEncrypted) : null,
  };

  await FilingWorkflowService.logAudit({
    filingId: filing.id,
    actorUserId: input.actorUserId,
    action: "IFTA_PORTAL_CREDENTIAL_REVEALED",
    message: "Staff revealed stored IFTA portal credentials.",
    payloadJson: {
      companyProfileId: filing.tenantId,
      jurisdiction,
    },
    db,
  });

  return response;
}
