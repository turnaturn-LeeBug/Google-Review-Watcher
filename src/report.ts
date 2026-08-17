import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ReviewRecord } from "./types.js";

export async function writeReport(path: string, records: ReviewRecord[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Review Watcher";
  const sheet = workbook.addWorksheet("New Reviews", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Review Date", key: "date", width: 18 },
    { header: "Google Relative Time", key: "relativeTime", width: 22 },
    { header: "Reviewer Name", key: "reviewerName", width: 24 },
    { header: "Star Rating", key: "stars", width: 13 },
    { header: "Review Text", key: "reviewText", width: 64 },
    { header: "Fingerprint", key: "fingerprint", width: 68 },
    { header: "Captured At", key: "capturedAt", width: 26 },
    { header: "Source", key: "source", width: 12 },
    { header: "Derived Review Date", key: "derivedReviewDate", width: 20 },
    { header: "Date Confidence", key: "dateConfidence", width: 18 },
    { header: "Google Review ID", key: "googleReviewId", width: 28 },
    { header: "Review Identity", key: "reviewIdentity", width: 72 }
  ];
  for (const record of records) sheet.addRow({ date: record.derivedReviewDate ?? "", ...record });
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn("reviewText").alignment = { wrapText: true, vertical: "top" };
  sheet.autoFilter = { from: "A1", to: "L1" };
  await workbook.xlsx.writeFile(path);
}
