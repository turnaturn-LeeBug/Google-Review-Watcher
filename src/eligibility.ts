import type { BusinessConfig, BusinessState, EligibilityResult } from "./types.js";

const DAY_MS = 86_400_000;

export function getEligibility(business: BusinessConfig, state: BusinessState, now = new Date()): EligibilityResult {
  if (!business.enabled) return { businessId: business.id, status: "DISABLED", lastSuccessfulRun: state.lastSuccessfulRun,
    nextEligibleAt: null, minimumIntervalDays: business.minimumIntervalDays };
  if (!state.lastSuccessfulRun) return { businessId: business.id, status: "ELIGIBLE", lastSuccessfulRun: null,
    nextEligibleAt: null, minimumIntervalDays: business.minimumIntervalDays };
  const last = new Date(state.lastSuccessfulRun);
  if (Number.isNaN(last.valueOf())) throw new Error(`Invalid lastSuccessfulRun for ${business.id}.`);
  const next = new Date(last.valueOf() + business.minimumIntervalDays * DAY_MS);
  return { businessId: business.id, status: now.valueOf() >= next.valueOf() ? "ELIGIBLE" : "SKIPPED_NOT_ELIGIBLE",
    lastSuccessfulRun: state.lastSuccessfulRun, nextEligibleAt: next.toISOString(), minimumIntervalDays: business.minimumIntervalDays };
}
