import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readBusinessState, writeBusinessStateAtomic } from "../src/business-state.js";
import { runBusiness } from "../src/check.js";
import { parseConfig } from "../src/config.js";
import { parseGoogleDisplayedTime } from "../src/date.js";
import type { EmailDelivery } from "../src/email.js";
import { getEligibility } from "../src/eligibility.js";
import { fingerprintReview, reviewIdentity } from "../src/fingerprint.js";
import type { BusinessConfig, BusinessState, ReviewInput } from "../src/types.js";

const business = (id: string, name = `Business ${id}`): BusinessConfig => ({
  id, businessName: name, googleUrl: `https://www.google.com/maps/place/${id}`,
  minimumIntervalDays: 3, enabled: true
});
const review = (item: BusinessConfig, text = "A review"): ReviewInput => ({
  businessId: item.id, businessName: item.businessName, reviewerName: "Sample Reviewer", stars: 5,
  relativeTime: "2 days ago", reviewText: text
});
const baseState = (id: string, lastSuccessfulRun: string | null): BusinessState => ({
  version: 2, businessId: id, fingerprints: [], identities: [], lastSuccessfulRun, updatedAt: lastSuccessfulRun
});

describe("v0.2 configuration and state", () => {
  test("parses multiple businesses with defaults and legacy config", () => {
    const parsed = parseConfig({ businesses: [
      { id: "one", businessName: "One", googleUrl: "https://google.com/one", enabled: true },
      { id: "two", businessName: "Two", googleUrl: "https://google.com/two", minimumIntervalDays: 7, enabled: false }
    ] });
    expect(parsed.businesses.map((item) => item.id)).toEqual(["one", "two"]);
    expect(parsed.businesses[0].minimumIntervalDays).toBe(3);
    expect(parsed.businesses[1].minimumIntervalDays).toBe(7);
    expect(parseConfig({ businessName: "Legacy", googleUrl: "https://google.com/legacy" }).businesses[0].id).toBe("default-business");
  });

  test("keeps business state independent", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-multi-"));
    const a = business("alpha"); const b = business("beta");
    const options = { dataDir: join(root, "data"), reportsDir: join(root, "reports"), now: new Date("2026-08-17T12:00:00Z") };
    expect((await runBusiness(a, [review(a)], options)).status).toBe("SUCCESS");
    expect((await runBusiness(b, [review(b)], options)).status).toBe("SUCCESS");
    const stateA = await readBusinessState(join(root, "data", "alpha", "state.json"), "alpha");
    const stateB = await readBusinessState(join(root, "data", "beta", "state.json"), "beta");
    expect(stateA.identities).toHaveLength(1);
    expect(stateB.identities).toHaveLength(1);
    expect(stateA.businessId).not.toBe(stateB.businessId);
  });
});

describe("minimum interval", () => {
  const item = business("interval");
  test("less than interval is skipped", () => {
    expect(getEligibility(item, baseState(item.id, "2026-08-14T12:00:01Z"), new Date("2026-08-17T12:00:00Z")).status).toBe("SKIPPED_NOT_ELIGIBLE");
  });
  test("equal to interval is eligible", () => {
    expect(getEligibility(item, baseState(item.id, "2026-08-14T12:00:00Z"), new Date("2026-08-17T12:00:00Z")).status).toBe("ELIGIBLE");
  });
  test("greater than interval is eligible", () => {
    expect(getEligibility(item, baseState(item.id, "2026-08-14T11:59:59Z"), new Date("2026-08-17T12:00:00Z")).status).toBe("ELIGIBLE");
  });

  test("failed run does not update lastSuccessfulRun", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-fail-"));
    const dataDir = join(root, "data");
    const statePath = join(dataDir, item.id, "state.json");
    await writeBusinessStateAtomic(statePath, baseState(item.id, "2026-08-10T12:00:00Z"));
    const result = await runBusiness(item, [review(item)], { dataDir, reportsDir: join(root, "reports"),
      now: new Date("2026-08-17T12:00:00Z"), reportWriter: async () => { throw new Error("simulated XLSX failure"); } });
    expect(result.status).toBe("FAILED");
    expect((await readBusinessState(statePath, item.id)).lastSuccessfulRun).toBe("2026-08-10T12:00:00Z");
  });

  test("email failure does not update lastSuccessfulRun", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-email-fail-"));
    const dataDir = join(root, "data");
    const failing: EmailDelivery = { deliver: async () => { throw new Error("simulated email failure"); } };
    const result = await runBusiness(item, [], { dataDir, reportsDir: join(root, "reports"),
      now: new Date("2026-08-17T12:00:00Z"), emailConfig: { enabled: true }, emailDelivery: failing });
    expect(result.status).toBe("FAILED");
    expect((await readBusinessState(join(dataDir, item.id, "state.json"), item.id)).lastSuccessfulRun).toBeNull();
  });

  test("successful run updates lastSuccessfulRun", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-success-"));
    const dataDir = join(root, "data");
    const now = new Date("2026-08-17T12:00:00Z");
    expect((await runBusiness(item, [review(item)], { dataDir, reportsDir: join(root, "reports"), now })).status).toBe("SUCCESS");
    expect((await readBusinessState(join(dataDir, item.id, "state.json"), item.id)).lastSuccessfulRun).toBe(now.toISOString());
  });
});

describe("dates and review identity", () => {
  const captured = new Date("2026-08-17T12:00:00Z");
  test("parses relative and explicit Google dates without discarding display text", () => {
    expect(parseGoogleDisplayedTime("4 days ago", captured)).toEqual({ googleDisplayedTime: "4 days ago", derivedReviewDate: "2026-08-13", dateConfidence: "derived-day" });
    expect(parseGoogleDisplayedTime("a week ago", captured).derivedReviewDate).toBe("2026-08-10");
    expect(parseGoogleDisplayedTime("3 weeks ago", captured).derivedReviewDate).toBe("2026-07-27");
    expect(parseGoogleDisplayedTime("August 12, 2026", captured)).toEqual({ googleDisplayedTime: "August 12, 2026", derivedReviewDate: "2026-08-12", dateConfidence: "exact" });
    expect(parseGoogleDisplayedTime("unavailable", captured).dateConfidence).toBe("unknown");
  });

  test("stable Google review id takes precedence", () => {
    const one: ReviewInput = { businessName: "Example", reviewerName: "A", stars: 5, relativeTime: "today", reviewText: "one", googleReviewId: "stable-123" };
    expect(reviewIdentity(one)).toBe(reviewIdentity({ ...one, reviewText: "edited text", relativeTime: "a week ago" }));
    expect(reviewIdentity(one)).toBe("google:stable-123");
  });

  test("rating-only fallback distinguishes displayed times when no stable id exists", () => {
    const one: ReviewInput = { businessName: "Example", reviewerName: "A", stars: 5, relativeTime: "2 days ago", reviewText: "" };
    expect(fingerprintReview(one)).not.toBe(fingerprintReview({ ...one, relativeTime: "3 days ago" }));
    expect(fingerprintReview(one)).toBe(fingerprintReview({ ...one }));
  });
});
