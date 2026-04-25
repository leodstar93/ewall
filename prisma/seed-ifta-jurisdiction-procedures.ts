import {
  IftaFilingMethod,
  IftaJurisdictionPaymentMethod,
  type PrismaClient,
} from "@prisma/client";

const DEFAULT_STEPS = [
  "Open the state IFTA portal.",
  "Login using saved portal credentials or contact the client.",
  "Navigate to the quarterly IFTA return.",
  "Enter miles and fuel totals from the E-Wall IFTA summary.",
  "Submit the return.",
  "Contact the client for ACH or card payment information.",
  "Submit payment.",
  "Upload receipt and confirmation number back into E-Wall.",
];

const PROCEDURES = [
  {
    jurisdiction: "NV",
    title: "Nevada IFTA Manual Portal Filing",
    portalUrl: "https://tax.nv.gov/",
    filingMethod: IftaFilingMethod.MANUAL_PORTAL,
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
    requiresPortalLogin: true,
    requiresClientCredential: true,
    supportsUpload: false,
    staffInstructions: {
      steps: DEFAULT_STEPS,
    },
  },
  {
    jurisdiction: "CA",
    title: "California IFTA Manual Portal Filing",
    portalUrl: "https://onlineservices.cdtfa.ca.gov/",
    filingMethod: IftaFilingMethod.MANUAL_PORTAL,
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
    requiresPortalLogin: true,
    requiresClientCredential: true,
    supportsUpload: false,
    staffInstructions: {
      steps: DEFAULT_STEPS,
    },
  },
  {
    jurisdiction: "TX",
    title: "Texas IFTA Manual Portal Filing",
    portalUrl: "https://comptroller.texas.gov/",
    filingMethod: IftaFilingMethod.MANUAL_PORTAL,
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
    requiresPortalLogin: true,
    requiresClientCredential: true,
    supportsUpload: false,
    staffInstructions: {
      steps: DEFAULT_STEPS,
    },
  },
  {
    jurisdiction: "FL",
    title: "Florida IFTA Manual Portal Filing",
    portalUrl: "https://floridarevenue.com/",
    filingMethod: IftaFilingMethod.MANUAL_PORTAL,
    paymentMethod: IftaJurisdictionPaymentMethod.CARD,
    requiresPortalLogin: true,
    requiresClientCredential: true,
    supportsUpload: false,
    staffInstructions: {
      steps: DEFAULT_STEPS,
    },
  },
] as const;

export async function seedIftaJurisdictionProcedures(prisma: PrismaClient) {
  for (const procedure of PROCEDURES) {
    await prisma.iftaJurisdictionProcedure.upsert({
      where: { jurisdiction: procedure.jurisdiction },
      update: {
        title: procedure.title,
        portalUrl: procedure.portalUrl,
        filingMethod: procedure.filingMethod,
        paymentMethod: procedure.paymentMethod,
        requiresPortalLogin: procedure.requiresPortalLogin,
        requiresClientCredential: procedure.requiresClientCredential,
        supportsUpload: procedure.supportsUpload,
        staffInstructions: procedure.staffInstructions,
        isActive: true,
      },
      create: {
        jurisdiction: procedure.jurisdiction,
        title: procedure.title,
        portalUrl: procedure.portalUrl,
        filingMethod: procedure.filingMethod,
        paymentMethod: procedure.paymentMethod,
        requiresPortalLogin: procedure.requiresPortalLogin,
        requiresClientCredential: procedure.requiresClientCredential,
        supportsUpload: procedure.supportsUpload,
        staffInstructions: procedure.staffInstructions,
        isActive: true,
      },
    });
  }
}
