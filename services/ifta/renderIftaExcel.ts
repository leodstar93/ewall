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
  const overviewRows: Array<Record<string, string | number>> = [
    { Field: "Carrier Name", Value: report.carrierName },
    { Field: "USDOT", Value: report.usdot },
    { Field: "IFTA Account", Value: report.iftaAccount },
    { Field: "Quarter", Value: quarterLabel(report.quarter) },
    { Field: "Year", Value: report.year },
    { Field: "Truck", Value: report.truckLabel },
    { Field: "Total Miles", Value: report.totalMiles },
    { Field: "Total Taxable Miles", Value: report.totalTaxableMiles },
    { Field: "Total Gallons", Value: report.totalGallons },
    { Field: "Fleet MPG", Value: report.fleetMpg ?? "" },
    { Field: "Total Tax Due", Value: report.totalTaxDue },
    { Field: "Total Tax Credit", Value: report.totalTaxCredit ?? "" },
    { Field: "Total Net Tax", Value: report.totalNetTax ?? report.totalTaxDue },
  ];
  const overviewWorksheet = XLSX.utils.json_to_sheet(overviewRows, {
    header: ["Field", "Value"],
  });
  overviewWorksheet["!cols"] = [{ wch: 24 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, overviewWorksheet, "Overview");

  const rows: Array<Record<string, string | number>> = report.lines.map((line) => ({
    Jurisdiction: `${line.jurisdictionCode} - ${line.jurisdiction}`,
    "Total Miles": line.totalMiles,
    "Taxable Miles": line.taxableMiles,
    "Taxable Gallons": line.taxableGallons ?? "",
    "Tax Paid Gallons": line.taxPaidGallons ?? line.gallons,
    "Tax Rate": line.taxRate,
    "Tax Due": line.taxDue,
    "Tax Credit": line.taxCredit ?? "",
    "Net Tax": line.netTax ?? line.taxDue,
  }));

  if (rows.length === 0) {
    rows.push({
      Jurisdiction: "No jurisdiction activity",
      "Total Miles": "",
      "Taxable Miles": "",
      "Taxable Gallons": "",
      "Tax Paid Gallons": "",
      "Tax Rate": "",
      "Tax Due": "",
      "Tax Credit": "",
      "Net Tax": "",
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "Jurisdiction",
      "Total Miles",
      "Taxable Miles",
      "Taxable Gallons",
      "Tax Paid Gallons",
      "Tax Rate",
      "Tax Due",
      "Tax Credit",
      "Net Tax",
    ],
  });

  worksheet["!cols"] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
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
