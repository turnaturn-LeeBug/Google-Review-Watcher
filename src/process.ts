import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseGoogleDisplayedTime } from "./date.js";
import { fingerprintReview, reviewIdentity } from "./fingerprint.js";
import { writeReport } from "./report.js";
import { readState, writeStateAtomic } from "./state.js";
import type { ProcessResult, ReviewInput, ReviewRecord } from "./types.js";

export interface ProcessOptions { statePath?: string; reportsDir?: string; now?: Date }

function slug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "business";
}

function assertInput(value: unknown): asserts value is ReviewInput[] {
  if (!Array.isArray(value)) throw new Error("Input must be a JSON array of reviews.");
  for (const [index, item] of value.entries()) {
    const row = item as Partial<ReviewInput>;
    if (!row || typeof row.businessName !== "string" || !row.businessName.trim() ||
        typeof row.reviewerName !== "string" || !row.reviewerName.trim() || typeof row.reviewText !== "string" ||
        !(row.stars === null || (Number.isInteger(row.stars) && row.stars! >= 1 && row.stars! <= 5)) ||
        !(row.relativeTime === null || typeof row.relativeTime === "string") ||
        (row.source !== undefined && row.source !== "google")) throw new Error(`Invalid review at array index ${index}.`);
  }
}

export async function processReviews(inputs: ReviewInput[], options: ProcessOptions = {}): Promise<ProcessResult> {
  assertInput(inputs);
  const now = options.now ?? new Date();
  const statePath = resolve(options.statePath ?? "data/seen-reviews.json");
  const reportsDir = resolve(options.reportsDir ?? "reports");
  const state = await readState(statePath);
  const seen = new Set(state.fingerprints);
  const batch = new Set<string>();
  const records: ReviewRecord[] = [];
  for (const input of inputs) {
    const fingerprint = fingerprintReview(input);
    if (seen.has(fingerprint) || batch.has(fingerprint)) continue;
    batch.add(fingerprint);
    const capturedAt = input.capturedAt ?? now.toISOString();
    const date = parseGoogleDisplayedTime(input.googleDisplayedTime ?? input.relativeTime, new Date(capturedAt));
    records.push({ ...input, ...date, source: "google", capturedAt, fingerprint, reviewIdentity: reviewIdentity(input) });
  }
  if (records.length === 0) return { inputCount: inputs.length, newCount: 0, reportPath: null, records: [] };
  if (new Set(records.map((record) => record.businessName)).size !== 1)
    throw new Error("Each processing run must contain reviews for one business.");
  const day = now.toISOString().slice(0, 10);
  const base = `${slug(records[0].businessName)}-reviews-${day}`;
  const suffix = state.updatedAt?.slice(0, 10) === day ? `-${now.toISOString().replace(/[:.]/g, "-")}` : "";
  const reportPath = resolve(reportsDir, `${base}${suffix}.xlsx`);
  await writeReport(reportPath, records);
  await writeStateAtomic(statePath, { version: 1, fingerprints: [...seen, ...batch], updatedAt: now.toISOString() });
  return { inputCount: inputs.length, newCount: records.length, reportPath, records };
}

export async function processReviewFile(path: string, options: ProcessOptions = {}): Promise<ProcessResult> {
  const input = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  assertInput(input);
  return processReviews(input, options);
}
