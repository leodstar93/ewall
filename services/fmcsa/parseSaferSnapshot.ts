import * as cheerio from "cheerio";
import type { ParsedSaferSnapshot } from "./saferTypes";

function cleanText(value?: string | null) {
  return value?.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripInlineLabelTail(value: string) {
  const trimmed = cleanText(value);
  const match = trimmed.match(/^(.*?)(?=\s+[A-Z][A-Za-z0-9/&(),' .-]{2,40}:\s*)/);
  return cleanText(match?.[1] ?? trimmed);
}

function extractFromPageText(pageText: string, label: string, nextLabels: string[]) {
  const nextPattern = nextLabels.map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `${escapeRegExp(label)}:\\s*(.*?)(?=\\s+(?:${nextPattern}):|$)`,
    "i",
  );
  const match = pageText.match(pattern);
  const value = cleanText(match?.[1] ?? "");

  if (!value) return "";

  const startsWithNextLabel = nextLabels.some((nextLabel) =>
    new RegExp(`^${escapeRegExp(nextLabel)}\\s*:`, "i").test(value),
  );

  return startsWithNextLabel ? "" : value;
}

function extractDirectValue(pageText: string, pattern: RegExp) {
  const match = pageText.match(pattern);
  return cleanText(match?.[1] ?? "");
}

function looksLikeLabel(line: string) {
  return /^[A-Z][A-Za-z0-9/&(),' .-]{2,60}:\s*/.test(line);
}

function isSectionBoundary(line: string) {
  return (
    /^#{2,}/.test(line) ||
    /^\* \* \*$/.test(line) ||
    /^SAFER (Layout|Table Layout)$/i.test(line) ||
    /^(USDOT INFORMATION|OPERATING AUTHORITY INFORMATION|COMPANY INFORMATION)$/i.test(line) ||
    /^Other Information/i.test(line) ||
    /^Operation Classification$/i.test(line) ||
    /^Carrier Operation$/i.test(line) ||
    /^Cargo Carried$/i.test(line)
  );
}

function buildLines(html: string) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  $("br").replaceWith("\n");
  $("tr, td, th, p, div, li, h1, h2, h3, h4, h5, h6").each((_, element) => {
    $(element).append("\n");
  });

  const rawLines = $("body")
    .text()
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);

  return rawLines.filter((line, index) => line !== rawLines[index - 1]);
}

function sliceSection(lines: string[], startPattern: RegExp, endPattern: RegExp) {
  const startIndex = lines.findIndex((line) => startPattern.test(line));
  if (startIndex < 0) return [];

  const nextLines = lines.slice(startIndex + 1);
  const endIndex = nextLines.findIndex((line) => endPattern.test(line));
  return endIndex >= 0 ? nextLines.slice(0, endIndex) : nextLines;
}

function extractLineNumber(lines: string[], pattern: RegExp) {
  const line = lines.find((entry) => pattern.test(entry));
  const match = line?.match(pattern);
  if (!match?.[1]) return null;

  const numeric = Number(match[1].replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function extractInspectionRow(
  lines: string[],
  pattern: RegExp,
  keys: string[],
): Record<string, number | null> {
  const line = lines.find((entry) => pattern.test(entry));
  const match = line?.match(pattern);
  if (!match) {
    return Object.fromEntries(keys.map((key) => [key, null]));
  }

  return Object.fromEntries(
    keys.map((key, index) => {
      const value = Number(match[index + 1]?.replace(/[^\d]/g, "") ?? "");
      return [key, Number.isFinite(value) ? value : null];
    }),
  );
}

function extractByLabel(
  lines: string[],
  label: string,
  options?: {
    multiline?: boolean;
    maxContinuationLines?: number;
    preserveLineBreaks?: boolean;
    allowStandaloneLabelValue?: boolean;
  },
) {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*:`, "i");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = pattern.exec(line);

    if (match) {
      const values: string[] = [];
      const remainder = stripInlineLabelTail(line.slice(match.index + match[0].length));

      if (remainder && !looksLikeLabel(remainder)) {
        values.push(remainder);
      }

      if (options?.multiline) {
        const maxContinuationLines = options.maxContinuationLines ?? 1;
        let cursor = index + 1;

        while (cursor < lines.length && values.length <= maxContinuationLines) {
          const nextLine = lines[cursor];
          if (
            !nextLine ||
            looksLikeLabel(nextLine) ||
            isSectionBoundary(nextLine) ||
            /^X\s+/i.test(nextLine)
          ) {
            break;
          }

          values.push(nextLine);
          cursor += 1;
        }
      }

      return options?.preserveLineBreaks
        ? values.map((value) => value.trim()).filter(Boolean).join("\n")
        : cleanText(values.join(" "));
    }

    if (options?.allowStandaloneLabelValue && line.toLowerCase() === label.toLowerCase()) {
      const nextLine = cleanText(lines[index + 1] ?? "");
      if (!nextLine || looksLikeLabel(nextLine) || isSectionBoundary(nextLine)) {
        return null;
      }

      return nextLine;
    }
  }

  return null;
}

function extractFirst(
  lines: string[],
  labels: string[],
  options?: {
    multiline?: boolean;
    maxContinuationLines?: number;
    preserveLineBreaks?: boolean;
    allowStandaloneLabelValue?: boolean;
  },
) {
  for (const label of labels) {
    const value = extractByLabel(lines, label, options);
    if (value) return value;
  }

  return null;
}

function extractCheckedItems(lines: string[], startLabels: string[], endLabels: string[]) {
  const startIndex = lines.findIndex((line) =>
    startLabels.some((label) => line.toLowerCase().startsWith(label.toLowerCase())),
  );

  if (startIndex < 0) return [];

  const items: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (endLabels.some((label) => line.toLowerCase().startsWith(label.toLowerCase()))) {
      break;
    }

    if (!line || isSectionBoundary(line)) {
      continue;
    }

    const checkedMatch = line.match(/^(?:X|\[x\]|\u2713)\s+(.+)$/i);
    if (checkedMatch?.[1]) {
      items.push(cleanText(checkedMatch[1]));
    }
  }

  return [...new Set(items)];
}

export function parseSaferSnapshot(html: string): ParsedSaferSnapshot {
  const lines = buildLines(html);
  const pageText = cleanText(lines.join(" "));

  const notFound =
    /No records matching/i.test(pageText) ||
    /No match/i.test(pageText) ||
    /not found/i.test(pageText) ||
    /No company snapshot found/i.test(pageText);

  if (notFound) {
    return {
      found: false,
      warnings: ["No company snapshot found for this USDOT number."],
      rawSnapshot: {},
    };
  }

  const legalName =
    extractFirst(lines, ["Legal Name", "Carrier Name"]) ||
    extractFromPageText(pageText, "Legal Name", ["DBA Name", "Physical Address", "Phone"]);
  const dbaName =
    extractFirst(lines, ["DBA Name"]) ||
    extractFromPageText(pageText, "DBA Name", ["Physical Address", "Phone", "Mailing Address"]);
  const usdotNumber = extractFirst(lines, ["USDOT Number", "USDOT"]);
  const mcNumber =
    extractFirst(lines, ["MC/MX/FF Number(s)", "MC/MX/FF Number", "Docket Number"]) ||
    extractDirectValue(pageText, /MC\/MX\/FF Number\(s\):\s*([A-Z-0-9]+)/i);
  const phone = extractFirst(lines, ["Phone", "Telephone"]);
  const addressRaw = extractFirst(lines, ["Physical Address"], {
    multiline: true,
    maxContinuationLines: 1,
    preserveLineBreaks: true,
    allowStandaloneLabelValue: true,
  });
  const mailingAddressRaw = extractFirst(lines, ["Mailing Address"], {
    multiline: true,
    maxContinuationLines: 1,
    preserveLineBreaks: true,
    allowStandaloneLabelValue: true,
  });
  const usdOTStatus = extractFirst(lines, ["USDOT Status"]);
  const outOfServiceDate = extractFirst(lines, ["Out of Service Date"]);
  const operatingStatus = extractFirst(lines, ["Operating Authority Status"]);
  const entityType = extractFirst(lines, ["Entity Type"]);
  const driversText =
    extractFirst(lines, ["Drivers"]) || extractDirectValue(pageText, /Drivers:\s*([\d,]+)/i);
  const powerUnitsText =
    extractFirst(lines, ["Power Units"]) ||
    extractDirectValue(pageText, /Power Units:\s*([\d,]+)/i);
  const nonCmvUnitsText = extractFirst(lines, ["Non-CMV Units"]);
  const mileageText = extractFirst(lines, ["MCS-150 Mileage (Year)", "MCS-150 Mileage"]);
  const formDateText = extractFirst(lines, ["MCS-150 Form Date"]);
  const dunsNumber = extractFirst(lines, ["DUNS Number"]);
  const snapshotDate = pageText.match(/as of\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null;

  const usInspectionSection = sliceSection(
    lines,
    /^US Inspection results/i,
    /^Canadian Inspection results/i,
  );
  const canadaInspectionSection = sliceSection(
    lines,
    /^Canadian Inspection results/i,
    /^The Federal safety rating/i,
  );
  const safetyRatingSection = sliceSection(lines, /^Carrier Safety Rating:/i, /^SAFER Home/i);
  const ratingLine = safetyRatingSection.find((line) => /^Rating:\s+/i.test(line)) ?? "";
  const reviewLine = safetyRatingSection.find((line) => /^Rating Date:\s+/i.test(line)) ?? "";
  const currentAsOfLine =
    safetyRatingSection.find((line) => /^The rating below is current as of:/i.test(line)) ?? "";

  const usInspectionRow = extractInspectionRow(
    usInspectionSection,
    /^Inspections\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/i,
    ["vehicle", "driver", "hazmat", "iep"],
  );
  const usCrashRow = extractInspectionRow(
    usInspectionSection,
    /^Crashes\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/i,
    ["fatal", "injury", "tow", "total"],
  );
  const canadaInspectionRow = extractInspectionRow(
    canadaInspectionSection,
    /^Inspections\s+(\d+)\s+(\d+)$/i,
    ["vehicle", "driver"],
  );
  const canadaCrashRow = extractInspectionRow(
    canadaInspectionSection,
    /^Crashes\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/i,
    ["fatal", "injury", "tow", "total"],
  );

  const operationClassification = extractCheckedItems(
    lines,
    ["Operation Classification:"],
    ["Carrier Operation:", "Cargo Carried:"],
  );
  const carrierOperation = extractCheckedItems(lines, ["Carrier Operation:"], ["Cargo Carried:"]);
  const cargoCarried = extractCheckedItems(
    lines,
    ["Cargo Carried:"],
    [
      "ID/Operations",
      "US Inspection results",
      "Canadian Inspection results",
      "Carrier Safety Rating:",
    ],
  );

  const warnings: string[] = [];
  if (!legalName || !usdotNumber) {
    warnings.push("Some SAFER fields could not be parsed from the snapshot.");
  }

  return {
    found: Boolean(legalName || usdotNumber),
    warnings,
    rawSnapshot: {
      legalName: legalName ?? null,
      dbaName: dbaName ?? null,
      usdotNumber: usdotNumber ?? null,
      mcNumber: mcNumber ?? null,
      phone: phone ?? null,
      addressRaw: addressRaw ?? null,
      mailingAddressRaw: mailingAddressRaw ?? null,
      usdOTStatus: usdOTStatus ?? null,
      outOfServiceDate: outOfServiceDate ?? null,
      operatingStatus: operatingStatus ?? null,
      entityType: entityType ?? null,
      snapshotDate,
      driversText: driversText ?? null,
      powerUnitsText: powerUnitsText ?? null,
      nonCmvUnitsText: nonCmvUnitsText ?? null,
      mileageText: mileageText ?? null,
      formDateText: formDateText ?? null,
      dunsNumber: dunsNumber ?? null,
      operationClassification,
      carrierOperation,
      cargoCarried,
      safetyRating: {
        currentAsOf: currentAsOfLine.replace(/^The rating below is current as of:\s*/i, "") || null,
        rating: ratingLine.match(/Rating:\s*(.*?)\s+Type:/i)?.[1] ?? null,
        type: ratingLine.match(/Type:\s*(.*)$/i)?.[1] ?? null,
        ratingDate: reviewLine.match(/Rating Date:\s*(.*?)\s+Review Date:/i)?.[1] ?? null,
        reviewDate: reviewLine.match(/Review Date:\s*(.*)$/i)?.[1] ?? null,
      },
      usInspections: {
        total: extractLineNumber(usInspectionSection, /^Total Inspections:\s*([\d,]+)/i),
        totalIep: extractLineNumber(usInspectionSection, /^Total IEP Inspections:\s*([\d,]+)/i),
        ...usInspectionRow,
      },
      usCrashes: usCrashRow,
      canadaInspections: {
        total: extractLineNumber(canadaInspectionSection, /^Total inspections:\s*([\d,]+)/i),
        ...canadaInspectionRow,
      },
      canadaCrashes: canadaCrashRow,
    },
  };
}
