export type UsJurisdictionSeed = {
  code: string;
  name: string;
  countryCode: "US";
  isIftaMember: boolean;
  isActive: boolean;
  sortOrder: number;
};

const STATE_PAIRS = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

export const US_JURISDICTIONS: UsJurisdictionSeed[] = STATE_PAIRS.map(
  ([code, name], index) => ({
    code,
    name,
    countryCode: "US",
    isIftaMember: true,
    isActive: true,
    sortOrder: index + 1,
  }),
);

export function getBundledTaxRateForCode(code: string, fuelType: "DI" | "GA") {
  const charScore = code
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = fuelType === "DI" ? 0.21 : 0.19;
  const offset = (charScore % 9) * 0.01;
  return (base + offset).toFixed(4);
}
