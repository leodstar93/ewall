export type CompanyProfileFormData = {
  legalName: string;
  dbaName: string;
  companyName: string;
  dotNumber: string;
  mcNumber: string;
  ein: string;
  businessPhone: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  trucksCount: string;
  driversCount: string;
  saferStatus: string;
  saferEntityType: string;
  saferOperatingStatus: string;
  saferPowerUnits: string;
  saferDrivers: string;
  saferMcs150Mileage: string;
  saferMileageYear: string;
  saferLastFetchedAt: string;
  saferAutoFilled: boolean;
  saferNeedsReview: boolean;
};

export const emptyCompanyProfileState: CompanyProfileFormData = {
  legalName: "",
  dbaName: "",
  companyName: "",
  dotNumber: "",
  mcNumber: "",
  ein: "",
  businessPhone: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  trucksCount: "",
  driversCount: "",
  saferStatus: "",
  saferEntityType: "",
  saferOperatingStatus: "",
  saferPowerUnits: "",
  saferDrivers: "",
  saferMcs150Mileage: "",
  saferMileageYear: "",
  saferLastFetchedAt: "",
  saferAutoFilled: false,
  saferNeedsReview: false,
};
