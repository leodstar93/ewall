import { saferLookupSchema } from "@/lib/validations/safer";
import type { SaferCompanyRaw, SaferLookupInput } from "./saferTypes";

export async function lookupSaferCompany(input: SaferLookupInput): Promise<SaferCompanyRaw> {
  const parsed = saferLookupSchema.parse(input);
  const dotNumber = parsed.dotNumber;

  const url = new URL("https://safer.fmcsa.dot.gov/query.asp");
  url.searchParams.set("query_param", "USDOT");
  url.searchParams.set("query_string", dotNumber);
  url.searchParams.set("query_type", "queryCarrierSnapshot");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 EWALL/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`SAFER lookup failed with status ${response.status}`);
  }

  const html = await response.text();

  return {
    source: "SAFER",
    searchedDotNumber: dotNumber,
    fetchedAt: new Date().toISOString(),
    html,
  };
}
