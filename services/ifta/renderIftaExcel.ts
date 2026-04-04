import * as XLSX from "xlsx";
import {
  buildIftaExportFileName,
  type IftaExportReport,
} from "@/services/ifta/ensureFiledReportDocument";

type RenderedExcel = {
  buffer: Buffer;
  fileName: string;
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
};

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

export function renderIftaExcel(report: IftaExportReport): RenderedExcel {
  const workbook = XLSX.utils.book_new();
  const rows: Array<Record<string, string | number>> = [
    {
      Jurisdiction: "Carrier Name",
      "Total Miles": report.carrierName,
      "Taxable Miles": "",
      Gallons: "",
      "Tax Rate": "",
      "Tax Due": "",
    },
    {
      Jurisdiction: "USDOT",
      "Total Miles": report.usdot,
      "Taxable Miles": "",
      Gallons: "",
      "Tax Rate": "",
      "Tax Due": "",
    },
    {
      Jurisdiction: "IFTA Account",
      "Total Miles": report.iftaAccount,
      "Taxable Miles": "",
      Gallons: "",
      "Tax Rate": "",
      "Tax Due": "",
    },
    {
      Jurisdiction: "Quarter",
      "Total Miles": quarterLabel(report.quarter),
      "Taxable Miles": "",
      Gallons: "",
      "Tax Rate": "",
      "Tax Due": "",
    },
    {
      Jurisdiction: "Year",
      "Total Miles": report.year,
      "Taxable Miles": "",
      Gallons: "",
      "Tax Rate": "",
      "Tax Due": "",
    },
    {
      Jurisdiction: "",
      "Total Miles": "",
      "Taxable Miles": "",
      Gallons: "",
      "Tax Rate": "",
      "Tax Due": "",
    },
    ...report.lines.map((line) => ({
      Jurisdiction: `${line.jurisdictionCode} - ${line.jurisdiction}`,
      "Total Miles": line.totalMiles,
      "Taxable Miles": line.taxableMiles,
      Gallons: line.gallons,
      "Tax Rate": line.taxRate,
      "Tax Due": line.taxDue,
    })),
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Jurisdiction",
      "Total Miles",
      "Taxable Miles",
      "Gallons",
      "Tax Rate",
      "Tax Due",
    ],
  });

  worksheet["!cols"] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "IFTA Report");

  return {
    buffer: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer,
    fileName: buildIftaExportFileName(report, "xlsx"),
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
