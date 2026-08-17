import ExcelJS from "exceljs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { fingerprintReview } from "../src/fingerprint.js";
import { processReviews } from "../src/process.js";
import type { ReviewInput } from "../src/types.js";

const base: ReviewInput = { businessName: "Example Business", source: "google", reviewerName: "Ada",
  stars: 5, relativeTime: "4 days ago", reviewText: "Excellent service." };

describe("Review Watcher", () => {
  test("fingerprint ignores changing relative time and captured time", () => {
    expect(fingerprintReview(base)).toBe(fingerprintReview({ ...base, relativeTime: "a week ago", capturedAt: "2030-01-01T00:00:00Z" }));
  });

  test("duplicate handling and new review detection", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-"));
    const options = { statePath: join(root, "data", "seen.json"), reportsDir: join(root, "reports"), now: new Date("2026-08-17T12:00:00Z") };
    const first = await processReviews([base, { ...base }], options);
    expect(first.newCount).toBe(1);
    expect((await processReviews([base], { ...options, now: new Date("2026-08-17T12:01:00Z") })).newCount).toBe(0);
    expect((await processReviews([{ ...base, reviewText: "A genuinely different review." }], { ...options, now: new Date("2026-08-17T12:02:00Z") })).newCount).toBe(1);
  });

  test("writes a valid XLSX with expected row", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-xlsx-"));
    const result = await processReviews([base], { statePath: join(root, "seen.json"), reportsDir: join(root, "reports"), now: new Date("2026-08-17T12:00:00Z") });
    expect(result.reportPath).toBeTruthy();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(result.reportPath!);
    const sheet = workbook.getWorksheet("New Reviews")!;
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell("C2").value).toBe("Ada");
    expect(sheet.getCell("E2").value).toBe("Excellent service.");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBeTruthy();
  });
});
