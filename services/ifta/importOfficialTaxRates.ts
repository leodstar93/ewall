import { FuelType, Quarter } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertTaxRate } from "@/services/ifta/upsertTaxRate";

type ImportOfficialTaxRatesParams = {
  year: number;
  quarter: Quarter;
  fuelTypes?: FuelType[];
  usOnly?: boolean;
  executedById?: string;
};

function getSourceQuarterKey(year: number, quarter: Quarter) {
  return `${quarter.slice(1)}Q${year}`;
}

function buildOfficialCsvUrl(year: number, quarter: Quarter) {
  return `https://www.iftach.org/taxmatrix/charts/${getSourceQuarterKey(year, quarter)}.csv`;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseTaxValue(value: string | undefined) {
  const normalized = (value ?? "")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();

  if (!normalized || normalized === "-") {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOfficialJurisdictionName(value: string) {
  return value
    .replace(/#\d+$/i, "")
    .replace(/\bSURCHG\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function isHeaderRow(columns: string[]) {
  return (
    columns.length >= 4 &&
    columns[2]?.toUpperCase() === "GASOLINE" &&
    columns[3]?.toUpperCase() === "SPECIAL"
  );
}

type ParsedOfficialRateRow = {
  jurisdictionName: string;
  gasolineRate: number;
  dieselRate: number;
};

function parseOfficialCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const parsedRows: ParsedOfficialRateRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const columns = parseCsvLine(line);
    if (isHeaderRow(columns)) continue;
    if ((columns[1] ?? "").toUpperCase() !== "U.S.") continue;

    const rawName = columns[0] ?? "";
    if (!rawName.trim()) continue;

    parsedRows.push({
      jurisdictionName: normalizeOfficialJurisdictionName(rawName),
      gasolineRate: parseTaxValue(columns[2]),
      dieselRate: parseTaxValue(columns[3]),
    });
  }

  return parsedRows;
}

export async function importOfficialTaxRates(params: ImportOfficialTaxRatesParams) {
  const fuelTypes = params.fuelTypes?.length
    ? params.fuelTypes
    : [FuelType.DI, FuelType.GA];
  const sourceUrl = buildOfficialCsvUrl(params.year, params.quarter);

  const jurisdictions = await prisma.jurisdiction.findMany({
    where: {
      isActive: true,
      isIftaMember: true,
      ...(params.usOnly ? { countryCode: "US" } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  const response = await fetch(sourceUrl, {
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "TruckersUnidos-IFTA-Importer/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Official IFTA CSV download failed with status ${response.status}`);
  }

  const content = await response.text();
  if (!content.trim()) {
    throw new Error("Official IFTA CSV download returned an empty file");
  }

  const officialRows = parseOfficialCsv(content);
  const jurisdictionByName = new Map(
    jurisdictions.map((jurisdiction) => [
      normalizeOfficialJurisdictionName(jurisdiction.name),
      jurisdiction,
    ]),
  );

  const aggregatedRates = new Map<
    string,
    { jurisdictionId: string; fuelType: FuelType; taxRate: number }
  >();

  for (const row of officialRows) {
    const jurisdiction = jurisdictionByName.get(row.jurisdictionName);
    if (!jurisdiction) {
      continue;
    }

    for (const fuelType of fuelTypes) {
      const amount = fuelType === FuelType.GA ? row.gasolineRate : row.dieselRate;
      const key = `${jurisdiction.id}:${fuelType}`;
      const current = aggregatedRates.get(key);
      const nextAmount = (current?.taxRate ?? 0) + amount;

      aggregatedRates.set(key, {
        jurisdictionId: jurisdiction.id,
        fuelType,
        taxRate: Number(nextAmount.toFixed(4)),
      });
    }
  }

  let insertedRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;
  const totalRows = jurisdictions.length * fuelTypes.length;

  for (const jurisdiction of jurisdictions) {
    for (const fuelType of fuelTypes) {
      const existing = await prisma.iftaTaxRate.findUnique({
        where: {
          jurisdictionId_year_quarter_fuelType: {
            jurisdictionId: jurisdiction.id,
            year: params.year,
            quarter: params.quarter,
            fuelType,
          },
        },
        select: {
          id: true,
          taxRate: true,
          source: true,
        },
      });

      const aggregated = aggregatedRates.get(`${jurisdiction.id}:${fuelType}`);
      if (!aggregated) {
        skippedRows += 1;
        continue;
      }

      if (existing && existing.source === "MANUAL_ADMIN") {
        skippedRows += 1;
        continue;
      }

      await upsertTaxRate({
        jurisdictionId: jurisdiction.id,
        year: params.year,
        quarter: params.quarter,
        fuelType,
        taxRate: aggregated.taxRate.toFixed(4),
        notes: "Imported from official IFTA tax matrix CSV.",
        source: "IFTA_IMPORT",
        sourceFileUrl: sourceUrl,
        importedAt: new Date(),
        importedById: params.executedById ?? null,
      });

      if (existing) {
        updatedRows += 1;
      } else {
        insertedRows += 1;
      }
    }
  }

  const success = insertedRows + updatedRows > 0 || skippedRows === totalRows;
  const message = "Official IFTA tax matrix CSV imported successfully.";

  await prisma.iftaTaxRateImportRun.create({
    data: {
      year: params.year,
      quarter: params.quarter,
      sourceType: "IFTA_OFFICIAL_CSV",
      sourceUrl,
      totalRows,
      insertedRows,
      updatedRows,
      skippedRows,
      status: success ? "SUCCESS" : "FAILED",
      message,
      executedById: params.executedById ?? null,
    },
  });

  return {
    success,
    insertedRows,
    updatedRows,
    skippedRows,
    message,
    sourceUrl,
    sourceQuarterKey: getSourceQuarterKey(params.year, params.quarter),
  };
}
