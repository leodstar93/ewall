export type SaferLookupResponse = {
  found: boolean;
  source: "SAFER";
  searchedDotNumber: string;
  company?: {
    legalName: string | null;
    dbaName: string | null;
    companyName: string | null;
    dotNumber: string | null;
    mcNumber: string | null;
    businessPhone: string | null;
    address: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    trucksCount: string | null;
    driversCount: string | null;
  };
  warnings: string[];
};

const LABEL_GROUPS = [
  { key: "legalName", labels: ["Legal Name", "Carrier Name"] },
  { key: "dbaName", labels: ["DBA Name", "DBA"] },
  { key: "dotNumber", labels: ["USDOT Number", "USDOT"] },
  { key: "mcNumber", labels: ["MC/MX/FF Number(s)", "MC/MX/FF Number", "Docket Number", "MC Number"] },
  { key: "businessPhone", labels: ["Telephone", "Phone"] },
  { key: "address", labels: ["Physical Address"] },
  { key: "state", labels: ["State"] },
  { key: "driversCount", labels: ["Drivers"] },
  { key: "trucksCount", labels: ["Power Units"] },
] as const;

const ALL_LABELS = LABEL_GROUPS.flatMap((g) => g.labels).sort(
  (a, b) => b.length - a.length,
);

const NORMALIZED_LABELS = new Set(
  ALL_LABELS.map((l) => l.replace(/\s+/g, " ").trim().replace(/[:.]+$/, "").toLowerCase()),
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[:.]+$/, "").toLowerCase();
}

function isKnownLabel(value: string) {
  return NORMALIZED_LABELS.has(normalizeLabel(value));
}

function htmlToStructuredText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/t[dh]>/gi, "\t")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/(?:p|div|li|ul|ol|table|section|font|strong|b)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, ""),
  );
}

function htmlToLines(html: string) {
  return htmlToStructuredText(html)
    .split(/\n+/)
    .map((l) => normalizeWhitespace(l))
    .filter(Boolean);
}

function htmlToRows(html: string) {
  return htmlToStructuredText(html)
    .split(/\n+/)
    .map((line) =>
      line
        .split(/\t+/)
        .map((cell) => normalizeWhitespace(cell))
        .filter(Boolean),
    )
    .filter((row) => row.length > 0);
}

function trimBeforeNextLabel(value: string) {
  let result = normalizeWhitespace(value);
  for (const label of ALL_LABELS) {
    const match = new RegExp(`\\b${escapeRegExp(label)}\\s*:`, "i").exec(result);
    if (match && match.index > 0) result = result.slice(0, match.index);
  }
  return normalizeWhitespace(result.replace(/^[\s:.-]+/, "").replace(/[\s,;:.()-]+$/, ""));
}

function sanitizeExtractedValue(value: string) {
  const normalized = trimBeforeNextLabel(value);
  if (!normalized) return "";
  if (isKnownLabel(normalized)) return "";
  return normalized;
}

function getInlineValue(cell: string, labels: readonly string[]) {
  for (const label of labels) {
    const m = new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*(.+)$`, "i").exec(cell);
    if (!m) continue;
    const candidate = sanitizeExtractedValue(m[1] ?? "");
    if (candidate) return candidate;
  }
  return "";
}

function extractValueFromRows(
  rows: string[][],
  labels: readonly string[],
  options?: { multiline?: boolean },
) {
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci] ?? "";
      const inline = getInlineValue(cell, labels);
      if (inline) return inline;

      const matchesLabel = labels.some((l) => normalizeLabel(cell) === normalizeLabel(l));
      if (!matchesLabel) continue;

      const sameRow = row
        .slice(ci + 1)
        .filter((v) => !isKnownLabel(v))
        .map((v) => sanitizeExtractedValue(v))
        .filter(Boolean)
        .join(" ");
      if (sameRow) return sameRow;

      const nextRows: string[] = [];
      for (let nri = ri + 1; nri < rows.length; nri++) {
        const nextRow = rows[nri] ?? [];
        const cells = nextRow
          .filter((v) => !isKnownLabel(v))
          .map((v) => sanitizeExtractedValue(v))
          .filter(Boolean);
        if (cells.length === 0) {
          if (nextRow.some((v) => isKnownLabel(v))) break;
          continue;
        }
        nextRows.push(cells.join(" "));
        if (!options?.multiline) break;
        if (nextRow.some((v) => isKnownLabel(v)) || nextRows.length >= 2) break;
      }
      if (nextRows.length > 0) return normalizeWhitespace(nextRows.join(" "));
    }
  }
  return "";
}

function extractValueFromLines(
  lines: string[],
  labels: readonly string[],
  options?: { multiline?: boolean },
) {
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] ?? "";
    const inline = getInlineValue(line, labels);
    if (inline) return inline;

    const matchesLabel = labels.some((l) => normalizeLabel(line) === normalizeLabel(l));
    if (!matchesLabel) continue;

    const next: string[] = [];
    for (let nli = li + 1; nli < lines.length; nli++) {
      const nl = sanitizeExtractedValue(lines[nli] ?? "");
      if (!nl) continue;
      if (isKnownLabel(nl)) break;
      next.push(nl);
      if (!options?.multiline || next.length >= 2) break;
    }
    if (next.length > 0) return normalizeWhitespace(next.join(" "));
  }
  return "";
}

function extractValue(
  rows: string[][],
  lines: string[],
  labels: readonly string[],
  options?: { multiline?: boolean },
) {
  return extractValueFromRows(rows, labels, options) || extractValueFromLines(lines, labels, options);
}

function normalizeDotNumber(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

function normalizeMcNumber(value: string | null) {
  if (!value) return null;
  const m = value.match(/\bMC[- ]?(\d{4,8})\b/i);
  if (m?.[1]) return `MC-${m[1]}`;
  const digits = value.replace(/\D/g, "");
  return /^\d{4,8}$/.test(digits) ? `MC-${digits}` : null;
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  return normalizeWhitespace(value);
}

function normalizeCount(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  return digits || null;
}

function normalizeAddress(value: string | null) {
  if (!value) return null;
  return normalizeWhitespace(value);
}

function extractState(address: string | null, fallbackState: string | null) {
  if (fallbackState) {
    const n = fallbackState.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(n)) return n;
  }
  if (!address) return null;
  const m = address.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?$/i);
  return m?.[1]?.toUpperCase() ?? null;
}

function extractCity(address: string | null) {
  if (!address) return null;
  // "123 Main St, Las Vegas, NV 89101" — city is typically before the state+zip
  const m = address.match(/,\s*([^,]+),\s*[A-Z]{2}\s+\d{5}/i);
  return m?.[1]?.trim() ?? null;
}

function extractAddressLine1(address: string | null) {
  if (!address) return null;
  // First part before comma is the street address
  const idx = address.indexOf(",");
  return idx > 0 ? address.slice(0, idx).trim() : address.trim();
}

function extractZipCode(address: string | null) {
  if (!address) return null;
  const m = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
  return m?.[1] ?? null;
}

function extractMcNumber(rows: string[][], lines: string[], text: string) {
  const labeled = extractValue(rows, lines, [
    "MC/MX/FF Number(s)",
    "MC/MX/FF Number",
    "Docket Number",
    "MC Number",
  ]);
  const normalized = normalizeMcNumber(labeled || null);
  if (normalized) return normalized;

  const inlineMc = text.match(/\bMC[- ]?(\d{4,8})\b/i);
  if (inlineMc?.[1]) return `MC-${inlineMc[1]}`;

  const docket = text.match(
    /(?:MC\/MX\/FF Number\(s\)|MC\/MX\/FF Number|Docket Number|MC Number)\s*:?\s*(\d{4,8})\b/i,
  );
  if (docket?.[1]) return `MC-${docket[1]}`;

  return null;
}

export function parseSaferSnapshot(html: string, searchedDotNumber: string): SaferLookupResponse {
  const lines = htmlToLines(html);
  const rows = htmlToRows(html);
  const text = normalizeWhitespace(lines.join(" "));

  if (/No records matching|No match|not found/i.test(text)) {
    return {
      found: false,
      source: "SAFER",
      searchedDotNumber,
      warnings: ["No company found for this USDOT number."],
    };
  }

  const legalName = extractValue(rows, lines, ["Legal Name", "Carrier Name"]) || null;
  const dbaName = extractValue(rows, lines, ["DBA Name", "DBA"]) || null;
  const dotNumber = normalizeDotNumber(
    extractValue(rows, lines, ["USDOT Number", "USDOT"]) || searchedDotNumber,
  );
  const mcNumber = extractMcNumber(rows, lines, text);
  const businessPhone = normalizePhone(extractValue(rows, lines, ["Telephone", "Phone"]) || null);
  const address = normalizeAddress(
    extractValue(rows, lines, ["Physical Address"], { multiline: true }) || null,
  );
  const state = extractState(address, extractValue(rows, lines, ["State"]) || null);
  const addressLine1 = extractAddressLine1(address);
  const city = extractCity(address);
  const zipCode = extractZipCode(address);
  const driversCount = normalizeCount(extractValue(rows, lines, ["Drivers"]) || null);
  const trucksCount = normalizeCount(extractValue(rows, lines, ["Power Units"]) || null);

  const found = Boolean(legalName || dbaName || mcNumber || businessPhone || address || state);

  return {
    found,
    source: "SAFER",
    searchedDotNumber,
    company: found
      ? {
          legalName,
          dbaName,
          companyName: legalName,
          dotNumber,
          mcNumber,
          businessPhone,
          address,
          addressLine1,
          addressLine2: null,
          city,
          state,
          zipCode,
          trucksCount,
          driversCount,
        }
      : undefined,
    warnings: found ? [] : ["We couldn't read this SAFER snapshot."],
  };
}

export async function fetchSaferByDot(dotNumber: string): Promise<SaferLookupResponse> {
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
    throw new Error("We couldn't retrieve company data from SAFER right now.");
  }

  const html = await response.text();
  return parseSaferSnapshot(html, dotNumber);
}
