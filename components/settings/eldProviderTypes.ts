export type EldProviderCredentialsFormData = {
  providerName: string;
  loginUrl: string;
  username: string;
  password: string;
  accountIdentifier: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const emptyEldProviderCredentialsState: EldProviderCredentialsFormData = {
  providerName: "",
  loginUrl: "",
  username: "",
  password: "",
  accountIdentifier: "",
  notes: "",
  createdAt: "",
  updatedAt: "",
};
