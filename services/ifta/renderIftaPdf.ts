import { readFile } from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { AppEnvironment } from "@/lib/db/types";
import {
  buildIftaExportFileName,
  type IftaExportReport,
} from "@/services/ifta/ensureFiledReportDocument";

type RenderedPdf = {
  buffer: Uint8Array;
  fileName: string;
  contentType: "application/pdf";
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 40;
const TABLE_TOP = 205;
const ROW_HEIGHT = 20;
const TABLE_COLUMNS = [
  { key: "jurisdiction", label: "Jurisdiction", x: 40, width: 165, align: "left" },
  { key: "totalMiles", label: "Total Miles", x: 215, width: 70, align: "right" },
  { key: "taxableMiles", label: "Taxable Miles", x: 295, width: 80, align: "right" },
  { key: "gallons", label: "Gallons", x: 385, width: 60, align: "right" },
  { key: "taxRate", label: "Tax Rate", x: 455, width: 50, align: "right" },
  { key: "taxDue", label: "Tax Due", x: 515, width: 57, align: "right" },
] as const;

type TableColumn = (typeof TABLE_COLUMNS)[number];

function formatNumber(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function quarterLabel(value: IftaExportReport["quarter"]) {
  switch (value) {
    case "Q1":
      return "Q1";
    case "Q2":
      return "Q2";
    case "Q3":
      return "Q3";
    default:
      return "Q4";
  }
}

function fitText(text: string, font: PDFFont, size: number, width: number) {
  if (font.widthOfTextAtSize(text, size) <= width) return text;

  const ellipsis = "...";
  let trimmed = text;
  while (trimmed.length > 0) {
    const candidate = `${trimmed}${ellipsis}`;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      return candidate;
    }
    trimmed = trimmed.slice(0, -1);
  }

  return ellipsis;
}

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    width?: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    align?: "left" | "right";
  },
) {
  const content =
    typeof options.width === "number"
      ? fitText(text, options.font, options.size, options.width)
      : text;

  const textWidth = options.font.widthOfTextAtSize(content, options.size);
  const x =
    options.align === "right" && typeof options.width === "number"
      ? options.x + options.width - textWidth
      : options.x;

  page.drawText(content, {
    x,
    y: options.y,
    font: options.font,
    size: options.size,
    color: options.color ?? rgb(0.1, 0.1, 0.1),
  });
}

function drawRule(page: PDFPage, y: number, color = rgb(0.83, 0.84, 0.86)) {
  page.drawLine({
    start: { x: PAGE_MARGIN, y },
    end: { x: PAGE_WIDTH - PAGE_MARGIN, y },
    thickness: 1,
    color,
  });
}

function createPage(pdfDoc: PDFDocument) {
  return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

function drawHeader(
  page: PDFPage,
  report: IftaExportReport,
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  drawText(page, "IFTA Quarterly Report", {
    x: PAGE_MARGIN,
    y: PAGE_HEIGHT - 54,
    font: boldFont,
    size: 18,
  });

  const baseY = PAGE_HEIGHT - 90;
  const rowGap = 15;
  const leftCol = PAGE_MARGIN;
  const rightCol = 315;

  const rows = [
    [`Carrier Name: ${report.carrierName}`, `Quarter: ${quarterLabel(report.quarter)}`],
    [`USDOT: ${report.usdot}`, `Year: ${String(report.year)}`],
    [`IFTA Account: ${report.iftaAccount}`, `Truck: ${report.truckLabel}`],
  ] as const;

  rows.forEach((row, index) => {
    const y = baseY - index * rowGap;
    drawText(page, row[0], {
      x: leftCol,
      y,
      width: 245,
      font: regularFont,
      size: 10,
    });
    drawText(page, row[1], {
      x: rightCol,
      y,
      width: 255,
      font: regularFont,
      size: 10,
    });
  });

  drawRule(page, PAGE_HEIGHT - 142);
}

function drawTableHeader(page: PDFPage, regularFont: PDFFont, boldFont: PDFFont) {
  drawText(page, "Jurisdiction | Total Miles | Taxable Miles | Gallons | Tax Rate | Tax Due", {
    x: -9999,
    y: -9999,
    font: regularFont,
    size: 1,
  });

  TABLE_COLUMNS.forEach((column) => {
    drawText(page, column.label, {
      x: column.x,
      y: PAGE_HEIGHT - TABLE_TOP,
      width: column.width,
      font: boldFont,
      size: 9,
      align: column.align,
    });
  });

  drawRule(page, PAGE_HEIGHT - (TABLE_TOP + 8));
}

function valueForColumn(
  reportLine: IftaExportReport["lines"][number],
  column: TableColumn,
) {
  switch (column.key) {
    case "jurisdiction":
      return `${reportLine.jurisdictionCode} - ${reportLine.jurisdiction}`;
    case "totalMiles":
      return formatNumber(reportLine.totalMiles);
    case "taxableMiles":
      return formatNumber(reportLine.taxableMiles);
    case "gallons":
      return formatNumber(reportLine.gallons);
    case "taxRate":
      return formatNumber(reportLine.taxRate);
    case "taxDue":
      return formatCurrency(reportLine.taxDue);
  }
}

async function readFirstAvailableFont(
  candidatePaths: string[],
) {
  for (const candidatePath of candidatePaths) {
    try {
      return await readFile(candidatePath);
    } catch {
      continue;
    }
  }

  return null;
}

export async function renderIftaPdf(
  report: IftaExportReport,
  environment: AppEnvironment = "production",
): Promise<RenderedPdf> {
  const fontsDirectory = path.join(process.cwd(), "public", "fonts");
  const regularFontBytes = await readFirstAvailableFont([
    path.join(fontsDirectory, "Roboto-Regular.ttf"),
    path.join(fontsDirectory, "Roboto-regular.ttf"),
    path.join(fontsDirectory, "Roboto-Reglar.ttf"),
    path.join(fontsDirectory, "Roboto-reglar.ttf"),
  ]);
  const boldFontBytes = await readFirstAvailableFont([
    path.join(fontsDirectory, "Roboto-Bold.ttf"),
    path.join(fontsDirectory, "Roboto-bold.ttf"),
    path.join(fontsDirectory, "Roboto-Bold.ttf"),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const regularFont = regularFontBytes
    ? await pdfDoc.embedFont(regularFontBytes)
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = boldFontBytes
    ? await pdfDoc.embedFont(boldFontBytes)
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = createPage(pdfDoc);
  drawHeader(page, report, regularFont, boldFont);
  drawTableHeader(page, regularFont, boldFont);

  let currentY = PAGE_HEIGHT - (TABLE_TOP + 28);

  for (const line of report.lines) {
    if (currentY <= 92) {
      page = createPage(pdfDoc);
      drawHeader(page, report, regularFont, boldFont);
      drawTableHeader(page, regularFont, boldFont);
      currentY = PAGE_HEIGHT - (TABLE_TOP + 28);
    }

    TABLE_COLUMNS.forEach((column) => {
      drawText(page, valueForColumn(line, column), {
        x: column.x,
        y: currentY,
        width: column.width,
        font: regularFont,
        size: 9,
        align: column.align,
      });
    });

    drawRule(page, currentY - 4, rgb(0.95, 0.96, 0.97));
    currentY -= ROW_HEIGHT;
  }

  if (currentY <= 120) {
    page = createPage(pdfDoc);
    drawHeader(page, report, regularFont, boldFont);
    currentY = PAGE_HEIGHT - 180;
  }

  const netLabel = report.totalTaxDue < 0 ? "Net Tax Credit" : "Net Tax Due";

  drawText(page, "Totals", {
    x: PAGE_MARGIN,
    y: currentY - 8,
    font: boldFont,
    size: 12,
  });

  drawText(page, `Total Miles: ${formatNumber(report.totalMiles)}`, {
    x: PAGE_MARGIN,
    y: currentY - 28,
    font: regularFont,
    size: 10,
  });

  drawText(
    page,
    `Total Taxable Miles: ${formatNumber(report.totalTaxableMiles)}`,
    {
      x: PAGE_MARGIN,
      y: currentY - 44,
      font: regularFont,
      size: 10,
    },
  );

  drawText(page, `Total Gallons: ${formatNumber(report.totalGallons)}`, {
    x: PAGE_MARGIN,
    y: currentY - 60,
    font: regularFont,
    size: 10,
  });

  drawText(page, `${netLabel}: ${formatCurrency(report.totalTaxDue)}`, {
    x: PAGE_MARGIN,
    y: currentY - 82,
    font: boldFont,
    size: 11,
  });

  if (environment === "sandbox") {
    page.drawText("SANDBOX - NOT FOR OFFICIAL USE", {
      x: 122,
      y: 360,
      font: boldFont,
      size: 22,
      color: rgb(0.78, 0.33, 0.09),
      rotate: degrees(-28),
      opacity: 0.18,
    });
  }

  const pdfBytes = await pdfDoc.save();

  return {
    buffer: pdfBytes,
    fileName: buildIftaExportFileName(report, "pdf"),
    contentType: "application/pdf",
  };
}
