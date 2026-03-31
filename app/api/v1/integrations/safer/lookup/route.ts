import { requireApiPermission } from "@/lib/rbac-api";

type SaferLookupResponse = {
  found: boolean;
  source: "SAFER";
  searchedDotNumber: string;
  company?: {
    legalName: string | null;
    dbaName: string | null;
    dotNumber: string | null;
    mcNumber: string | null;
    businessPhone: string | null;
    address: string | null;
    state: string | null;
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

const ALL_LABELS = LABEL_GROUPS.flatMap((group) => group.labels).sort(
  (left, right) => right.length - left.length,
);

const NORMALIZED_LABELS = new Set(
  ALL_LABELS.map((label) => label.replace(/\s+/g, " ").trim().replace(/[:.]+$/, "").toLowerCase()),
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
    .map((line) => normalizeWhitespace(line))
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
    if (match && match.index > 0) {
      result = result.slice(0, match.index);
    }
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
    const inlineMatch = new RegExp(
      `^${escapeRegExp(label)}\\s*:?\\s*(.+)$`,
      "i",
    ).exec(cell);

    if (!inlineMatch) continue;

    const candidate = sanitizeExtractedValue(inlineMatch[1] ?? "");
    if (candidate) return candidate;
  }

  return "";
}

function extractValueFromRows(
  rows: string[][],
  labels: readonly string[],
  options?: { multiline?: boolean },
) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];

    for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
      const cell = row[cellIndex] ?? "";
      const inlineValue = getInlineValue(cell, labels);
      if (inlineValue) return inlineValue;

      const matchesExactLabel = labels.some(
        (label) => normalizeLabel(cell) === normalizeLabel(label),
      );

      if (!matchesExactLabel) continue;

      const sameRowValue = row
        .slice(cellIndex + 1)
        .filter((value) => !isKnownLabel(value))
        .map((value) => sanitizeExtractedValue(value))
        .filter(Boolean)
        .join(" ");

      if (sameRowValue) return sameRowValue;

      const nextRowValues: string[] = [];

      for (let nextRowIndex = rowIndex + 1; nextRowIndex < rows.length; nextRowIndex += 1) {
        const nextRow = rows[nextRowIndex] ?? [];
        const candidateCells = nextRow
          .filter((value) => !isKnownLabel(value))
          .map((value) => sanitizeExtractedValue(value))
          .filter(Boolean);

        if (candidateCells.length === 0) {
          if (nextRow.some((value) => isKnownLabel(value))) break;
          continue;
        }

        nextRowValues.push(candidateCells.join(" "));

        if (!options?.multiline) {
          break;
        }

        if (nextRow.some((value) => isKnownLabel(value)) || nextRowValues.length >= 2) {
          break;
        }
      }

      if (nextRowValues.length > 0) {
        return normalizeWhitespace(nextRowValues.join(" "));
      }
    }
  }

  return "";
}

function extractValueFromLines(
  lines: string[],
  labels: readonly string[],
  options?: { multiline?: boolean },
) {
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const inlineValue = getInlineValue(line, labels);
    if (inlineValue) return inlineValue;

    const matchesExactLabel = labels.some(
      (label) => normalizeLabel(line) === normalizeLabel(label),
    );

    if (!matchesExactLabel) continue;

    const nextLines: string[] = [];

    for (let nextLineIndex = lineIndex + 1; nextLineIndex < lines.length; nextLineIndex += 1) {
      const nextLine = sanitizeExtractedValue(lines[nextLineIndex] ?? "");

      if (!nextLine) continue;
      if (isKnownLabel(nextLine)) break;

      nextLines.push(nextLine);
      if (!options?.multiline || nextLines.length >= 2) break;
    }

    if (nextLines.length > 0) {
      return normalizeWhitespace(nextLines.join(" "));
    }
  }

  return "";
}

function extractValue(
  rows: string[][],
  lines: string[],
  labels: readonly string[],
  options?: { multiline?: boolean },
) {
  return (
    extractValueFromRows(rows, labels, options) ||
    extractValueFromLines(lines, labels, options)
  );
}

function normalizeDotNumber(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

function normalizeMcNumber(value: string | null) {
  if (!value) return null;
  const explicitMatch = value.match(/\bMC[- ]?(\d{4,8})\b/i);
  if (explicitMatch?.[1]) {
    return `MC-${explicitMatch[1]}`;
  }

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
    const normalized = fallbackState.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  }

  if (!address) return null;
  const match = address.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?$/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function extractMcNumber(rows: string[][], lines: string[], text: string) {
  const labeledValue = extractValue(rows, lines, [
    "MC/MX/FF Number(s)",
    "MC/MX/FF Number",
    "Docket Number",
    "MC Number",
  ]);

  const normalizedLabeledValue = normalizeMcNumber(labeledValue || null);
  if (normalizedLabeledValue) {
    return normalizedLabeledValue;
  }

  const inlineMcMatch = text.match(/\bMC[- ]?(\d{4,8})\b/i);
  if (inlineMcMatch?.[1]) {
    return `MC-${inlineMcMatch[1]}`;
  }

  const docketMatch = text.match(
    /(?:MC\/MX\/FF Number\(s\)|MC\/MX\/FF Number|Docket Number|MC Number)\s*:?\s*(\d{4,8})\b/i,
  );
  if (docketMatch?.[1]) {
    return `MC-${docketMatch[1]}`;
  }

  return null;
}

function parseSaferSnapshot(html: string, searchedDotNumber: string): SaferLookupResponse {
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
  const businessPhone = normalizePhone(
    extractValue(rows, lines, ["Telephone", "Phone"]) || null,
  );
  const address = normalizeAddress(
    extractValue(rows, lines, ["Physical Address"], { multiline: true }) || null,
  );
  const state = extractState(address, extractValue(rows, lines, ["State"]) || null);
  const driversCount = normalizeCount(extractValue(rows, lines, ["Drivers"]) || null);
  const trucksCount = normalizeCount(extractValue(rows, lines, ["Power Units"]) || null);

  const found = Boolean(
    legalName ||
      dbaName ||
      mcNumber ||
      businessPhone ||
      address ||
      state ||
      driversCount ||
      trucksCount,
  );

  return {
    found,
    source: "SAFER",
    searchedDotNumber,
    company: found
      ? {
          legalName,
          dbaName,
          dotNumber,
          mcNumber,
          businessPhone,
          address,
          state,
          trucksCount,
          driversCount,
        }
      : undefined,
    warnings: found ? [] : ["We couldn't read this SAFER snapshot."],
  };
}

export async function POST(request: Request) {
  const guard = await requireApiPermission("settings:read");
  if (!guard.ok) return guard.res;

  try {
    const payload = (await request.json().catch(() => ({}))) as { dotNumber?: unknown };
    const rawDotNumber =
      typeof payload.dotNumber === "string" ? payload.dotNumber.trim() : "";
    const dotNumber = rawDotNumber.replace(/\D/g, "");

    if (!/^\d{5,8}$/.test(dotNumber)) {
      return Response.json({ error: "Invalid USDOT number." }, { status: 400 });
    }

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
      return Response.json(
        { error: "We couldn't retrieve company data from SAFER right now." },
        { status: 502 },
      );
    }

    const html = await response.text();
    const result = parseSaferSnapshot(html, dotNumber);

    return Response.json(result, { status: result.found ? 200 : 404 });
  } catch {
    return Response.json(
      { error: "We couldn't retrieve company data from SAFER right now." },
      { status: 502 },
    );
  }
}
