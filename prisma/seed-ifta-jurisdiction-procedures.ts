import {
  IftaFilingMethod,
  IftaJurisdictionPaymentMethod,
  type PrismaClient,
} from "@prisma/client";

type ProcedureSeed = {
  jurisdiction: string;
  name: string;
  portalUrl: string;
  filingMethod?: IftaFilingMethod;
  paymentMethod?: IftaJurisdictionPaymentMethod;
  requiresPortalLogin?: boolean;
  requiresClientCredential?: boolean;
  supportsUpload?: boolean;
  steps?: string[];
  checklist?: string[];
};

const DEFAULT_CHECKLIST = [
  "Open the jurisdiction portal.",
  "Login with saved portal credentials or contact the client.",
  "Open the quarterly IFTA return.",
  "Enter jurisdiction miles and gallons from E-Wall.",
  "Review calculated tax, credit, penalty, and interest.",
  "Confirm payment options inside the portal.",
  "Submit the return and payment when authorized.",
  "Upload receipt and confirmation number back into E-Wall.",
];

function defaultSteps(name: string) {
  return [
    `Open the official ${name} IFTA portal.`,
    "Login using saved portal credentials or contact the client for access.",
    "Navigate to the quarterly IFTA return or motor carrier fuel tax return.",
    "Enter miles and fuel totals from the E-Wall IFTA summary.",
    "Review tax due, credit, penalty, interest, and any portal validation messages.",
    "Confirm available electronic payment options in the portal before submitting.",
    "Submit the return after client authorization.",
    "Save the confirmation or receipt and upload it back into E-Wall.",
  ];
}

function procedure(input: ProcedureSeed) {
  return {
    jurisdiction: input.jurisdiction,
    title: `${input.name} IFTA Manual Portal Filing`,
    portalUrl: input.portalUrl,
    filingMethod: input.filingMethod ?? IftaFilingMethod.MANUAL_PORTAL,
    paymentMethod: input.paymentMethod ?? IftaJurisdictionPaymentMethod.UNKNOWN,
    requiresPortalLogin: input.requiresPortalLogin ?? true,
    requiresClientCredential: input.requiresClientCredential ?? true,
    supportsUpload: input.supportsUpload ?? false,
    staffInstructions: {
      steps: input.steps ?? defaultSteps(input.name),
    },
    checklist: input.checklist ?? DEFAULT_CHECKLIST,
  };
}

const PROCEDURES = [
  procedure({
    jurisdiction: "AL",
    name: "Alabama",
    portalUrl: "https://myalabamataxes.alabama.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "AZ",
    name: "Arizona",
    portalUrl: "https://azmvdnow.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "AR",
    name: "Arkansas",
    portalUrl: "https://atap.arkansas.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "CA",
    name: "California",
    portalUrl: "https://onlineservices.cdtfa.ca.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
    supportsUpload: true,
    steps: [
      "Open CDTFA Online Services.",
      "Login with the client's CDTFA online profile.",
      "Open the International Fuel Tax Agreement quarterly return.",
      "Enter the E-Wall jurisdiction summary or upload the CDTFA jurisdiction schedule template when available.",
      "Review calculated tax, credit, penalty, and interest.",
      "Use the portal payment flow after return submission when client authorization is available.",
      "Save the confirmation or receipt and upload it back into E-Wall.",
    ],
    checklist: [
      "Open CDTFA Online Services.",
      "Login to the client's account.",
      "Open the IFTA quarterly return.",
      "Enter or upload jurisdiction schedule details.",
      "Review return totals.",
      "Submit return.",
      "Complete portal payment when authorized.",
      "Upload confirmation and receipt.",
    ],
  }),
  procedure({
    jurisdiction: "CO",
    name: "Colorado",
    portalUrl: "https://www.colorado.gov/revenueonline/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "CT",
    name: "Connecticut",
    portalUrl: "https://portal.ct.gov/drs/myconnect",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "DE",
    name: "Delaware",
    portalUrl: "https://dmv.de.gov/services/ifta/index.shtml",
  }),
  procedure({
    jurisdiction: "FL",
    name: "Florida",
    portalUrl: "https://floridarevenue.com/taxes/eservices/",
    paymentMethod: IftaJurisdictionPaymentMethod.CARD,
  }),
  procedure({
    jurisdiction: "GA",
    name: "Georgia",
    portalUrl: "https://gtc.dor.ga.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "ID",
    name: "Idaho",
    portalUrl: "https://trucking.idaho.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "IL",
    name: "Illinois",
    portalUrl: "https://mytax.illinois.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "IN",
    name: "Indiana",
    portalUrl: "https://motorcarrier.dor.in.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "IA",
    name: "Iowa",
    portalUrl: "https://govconnect.iowa.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "KS",
    name: "Kansas",
    portalUrl: "https://www.kdor.ks.gov/Apps/kcsc/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "KY",
    name: "Kentucky",
    portalUrl: "https://drive.ky.gov/motor-carriers/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "LA",
    name: "Louisiana",
    portalUrl: "https://latap.revenue.louisiana.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "ME",
    name: "Maine",
    portalUrl: "https://apps1.web.maine.gov/online/ifta/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "MD",
    name: "Maryland",
    portalUrl: "https://egov.maryland.gov/mva/ifta/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "MA",
    name: "Massachusetts",
    portalUrl: "https://mtc.dor.state.ma.us/mtc/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "MI",
    name: "Michigan",
    portalUrl: "https://milogin.michigan.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "MN",
    name: "Minnesota",
    portalUrl: "https://www.mndriveinfo.org/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "MS",
    name: "Mississippi",
    portalUrl: "https://tap.dor.ms.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "MO",
    name: "Missouri",
    portalUrl: "https://mytax.mo.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "MT",
    name: "Montana",
    portalUrl: "https://tap.dor.mt.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "NE",
    name: "Nebraska",
    portalUrl: "https://dmv.nebraska.gov/services",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "NV",
    name: "Nevada",
    portalUrl: "https://www.nevadatax.nv.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "NH",
    name: "New Hampshire",
    portalUrl: "https://www.nh.gov/safety/divisions/dmv/financial-responsibility/road-toll/ifta.htm",
  }),
  procedure({
    jurisdiction: "NJ",
    name: "New Jersey",
    portalUrl: "https://www.njportal.com/DOR/IFTA/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "NM",
    name: "New Mexico",
    portalUrl: "https://tap.state.nm.us/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "NY",
    name: "New York",
    portalUrl: "https://www.tax.ny.gov/online/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "NC",
    name: "North Carolina",
    portalUrl: "https://www.ncdor.gov/file-pay/eservices",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "ND",
    name: "North Dakota",
    portalUrl: "https://www.nd.gov/tax/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "OH",
    name: "Ohio",
    portalUrl: "https://tax.ohio.gov/online-services/ohid-for-business",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "OK",
    name: "Oklahoma",
    portalUrl: "https://oktap.tax.ok.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "OR",
    name: "Oregon",
    portalUrl: "https://www.oregontruckingonline.com/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "PA",
    name: "Pennsylvania",
    portalUrl: "https://www.etides.state.pa.us/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "RI",
    name: "Rhode Island",
    portalUrl: "https://taxportal.ri.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "SC",
    name: "South Carolina",
    portalUrl: "https://mydorway.dor.sc.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "SD",
    name: "South Dakota",
    portalUrl: "https://apps.sd.gov/rv23account/login.aspx",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "TN",
    name: "Tennessee",
    portalUrl: "https://tntap.tn.gov/eservices/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "TX",
    name: "Texas",
    portalUrl: "https://comptroller.texas.gov/taxes/file-pay/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "UT",
    name: "Utah",
    portalUrl: "https://tap.tax.utah.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "VT",
    name: "Vermont",
    portalUrl: "https://myvtax.vermont.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "VA",
    name: "Virginia",
    portalUrl: "https://www.virginiatax.gov/ifta",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "WA",
    name: "Washington",
    portalUrl: "https://secure.dor.wa.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "WV",
    name: "West Virginia",
    portalUrl:
      "https://tax.wv.gov/business/motorfuel/internationalfueltaxagreement/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "WI",
    name: "Wisconsin",
    portalUrl: "https://tap.revenue.wi.gov/",
    paymentMethod: IftaJurisdictionPaymentMethod.ACH,
  }),
  procedure({
    jurisdiction: "WY",
    name: "Wyoming",
    portalUrl: "https://www.dot.state.wy.us/home/trucking_commercial_vehicles/ifta.html",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "AB",
    name: "Alberta",
    portalUrl: "https://tracs.finance.gov.ab.ca/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "BC",
    name: "British Columbia",
    portalUrl: "https://etax.gov.bc.ca/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "MB",
    name: "Manitoba",
    portalUrl: "https://taxcess.gov.mb.ca/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "NB",
    name: "New Brunswick",
    portalUrl:
      "https://www2.gnb.ca/content/gnb/en/services/services_renderer.201193.International_Fuel_Tax_Agreement_IFTA_licence.html",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "NL",
    name: "Newfoundland and Labrador",
    portalUrl: "https://www.gov.nl.ca/dgsnl/vehicleregistration/ifta/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "NS",
    name: "Nova Scotia",
    portalUrl: "https://novascotia.ca/sns/rmv/commercial/ifta.asp",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "ON",
    name: "Ontario",
    portalUrl: "https://www.ontario.ca/page/tax-services-online",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "PE",
    name: "Prince Edward Island",
    portalUrl:
      "https://www.princeedwardisland.ca/en/information/transportation-and-infrastructure/international-fuel-tax-agreement-ifta",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "QC",
    name: "Quebec",
    portalUrl: "https://www.revenuquebec.ca/en/online-services/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
  procedure({
    jurisdiction: "SK",
    name: "Saskatchewan",
    portalUrl: "https://sets.saskatchewan.ca/",
    paymentMethod: IftaJurisdictionPaymentMethod.MANUAL,
  }),
] as const;

export async function seedIftaJurisdictionProcedures(prisma: PrismaClient) {
  for (const procedureSeed of PROCEDURES) {
    await prisma.iftaJurisdictionProcedure.upsert({
      where: { jurisdiction: procedureSeed.jurisdiction },
      update: {
        title: procedureSeed.title,
        portalUrl: procedureSeed.portalUrl,
        filingMethod: procedureSeed.filingMethod,
        paymentMethod: procedureSeed.paymentMethod,
        requiresPortalLogin: procedureSeed.requiresPortalLogin,
        requiresClientCredential: procedureSeed.requiresClientCredential,
        supportsUpload: procedureSeed.supportsUpload,
        staffInstructions: procedureSeed.staffInstructions,
        checklist: procedureSeed.checklist,
        isActive: true,
      },
      create: {
        jurisdiction: procedureSeed.jurisdiction,
        title: procedureSeed.title,
        portalUrl: procedureSeed.portalUrl,
        filingMethod: procedureSeed.filingMethod,
        paymentMethod: procedureSeed.paymentMethod,
        requiresPortalLogin: procedureSeed.requiresPortalLogin,
        requiresClientCredential: procedureSeed.requiresClientCredential,
        supportsUpload: procedureSeed.supportsUpload,
        staffInstructions: procedureSeed.staffInstructions,
        checklist: procedureSeed.checklist,
        isActive: true,
      },
    });
  }
}
