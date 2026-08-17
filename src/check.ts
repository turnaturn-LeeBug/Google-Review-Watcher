import { resolve } from "node:path";
import { readBusinessState, writeBusinessStateAtomic } from "./business-state.js";
import { parseGoogleDisplayedTime } from "./date.js";
import { DisabledEmailDelivery, type EmailDelivery } from "./email.js";
import { getEligibility } from "./eligibility.js";
import { fingerprintReview, reviewIdentity } from "./fingerprint.js";
import { writeReport } from "./report.js";
import type { BusinessConfig, BusinessRunResult, EmailConfig, ReviewInput, ReviewRecord } from "./types.js";

export interface BusinessRunOptions {
  now?: Date;
  dataDir?: string;
  reportsDir?: string;
  legacyStatePath?: string;
  emailConfig?: EmailConfig;
  emailDelivery?: EmailDelivery;
  reportWriter?: typeof writeReport;
}

function reportSlug(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "business";
}

export function normalizeBusinessReviews(business: BusinessConfig, inputs: ReviewInput[], now: Date): ReviewRecord[] {
  const records: ReviewRecord[] = [];
  for (const input of inputs) {
    if (input.businessId && input.businessId !== business.id) throw new Error(`Review businessId does not match ${business.id}.`);
    if (input.businessName !== business.businessName) throw new Error(`Review businessName does not match ${business.businessName}.`);
    const capturedAt = input.capturedAt ?? now.toISOString();
    const date = parseGoogleDisplayedTime(input.googleDisplayedTime ?? input.relativeTime, new Date(capturedAt));
    records.push({ ...input, ...date, businessId: business.id, source: "google", capturedAt,
      fingerprint: fingerprintReview(input), reviewIdentity: reviewIdentity(input) });
  }
  return records;
}

export async function runBusiness(business: BusinessConfig, inputs: ReviewInput[], options: BusinessRunOptions = {}): Promise<BusinessRunResult> {
  const now = options.now ?? new Date();
  const statePath = resolve(options.dataDir ?? "data/businesses", business.id, "state.json");
  const state = await readBusinessState(statePath, business.id, options.legacyStatePath);
  const eligibility = getEligibility(business, state, now);
  if (eligibility.status !== "ELIGIBLE") return { businessId: business.id, status: eligibility.status,
    newCount: 0, reportPath: null, lastSuccessfulRun: state.lastSuccessfulRun };
  try {
    const normalized = normalizeBusinessReviews(business, inputs, now);
    const seen = new Set(state.identities);
    const batch = new Set<string>();
    const records = normalized.filter((record) => {
      if (seen.has(record.reviewIdentity) || batch.has(record.reviewIdentity)) return false;
      batch.add(record.reviewIdentity);
      return true;
    });
    let reportPath: string | null = null;
    if (records.length) {
      const day = now.toISOString().slice(0, 10);
      const suffix = state.updatedAt?.slice(0, 10) === day ? `-${now.toISOString().replace(/[:.]/g, "-")}` : "";
      reportPath = resolve(options.reportsDir ?? "reports", business.id,
        `${reportSlug(business.businessName)}-reviews-${day}${suffix}.xlsx`);
      await (options.reportWriter ?? writeReport)(reportPath, records);
    }
    const emailConfig = business.email ?? options.emailConfig ?? { enabled: false };
    await (options.emailDelivery ?? new DisabledEmailDelivery()).deliver({ business, config: emailConfig, reportPath, records });
    const completedAt = now.toISOString();
    await writeBusinessStateAtomic(statePath, { version: 2, businessId: business.id,
      fingerprints: [...state.fingerprints, ...records.map((item) => item.fingerprint)],
      identities: [...state.identities, ...records.map((item) => item.reviewIdentity)],
      lastSuccessfulRun: completedAt, updatedAt: completedAt });
    return { businessId: business.id, status: "SUCCESS", newCount: records.length, reportPath,
      lastSuccessfulRun: completedAt };
  } catch (error) {
    return { businessId: business.id, status: "FAILED", newCount: 0, reportPath: null,
      lastSuccessfulRun: state.lastSuccessfulRun, error: error instanceof Error ? error.message : String(error) };
  }
}
