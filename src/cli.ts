#!/usr/bin/env node
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { readBusinessState } from "./business-state.js";
import { runBusiness } from "./check.js";
import { readConfig } from "./config.js";
import { getEligibility } from "./eligibility.js";
import { processReviewFile } from "./process.js";
import type { BusinessConfig, BusinessRunResult, ReviewInput } from "./types.js";

const args = process.argv.slice(2);
const command = args[0];
const option = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

async function loadReviewInputs(path: string): Promise<ReviewInput[]> {
  const value = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  if (!Array.isArray(value)) throw new Error(`Review input must be an array: ${path}`);
  return value as ReviewInput[];
}

const statePathFor = (id: string): string => resolve("data/businesses", id, "state.json");

async function checkOne(business: BusinessConfig, configCount: number, emailConfig: { enabled: boolean }, explicitInput?: string): Promise<BusinessRunResult> {
  const legacyPath = configCount === 1 ? resolve("data/seen-reviews.json") : undefined;
  const state = await readBusinessState(statePathFor(business.id), business.id, legacyPath);
  const eligibility = getEligibility(business, state);
  if (eligibility.status !== "ELIGIBLE") return runBusiness(business, [], { legacyStatePath: legacyPath, emailConfig });
  const path = explicitInput ?? resolve("tmp", `${business.id}-reviews.local.json`);
  try {
    return runBusiness(business, await loadReviewInputs(path), { legacyStatePath: legacyPath, emailConfig });
  } catch (error) {
    return { businessId: business.id, status: "FAILED", newCount: 0, reportPath: null,
      lastSuccessfulRun: state.lastSuccessfulRun, error: error instanceof Error ? error.message : String(error) };
  }
}

function printRun(result: BusinessRunResult): void {
  console.log(`${result.businessId}: ${result.status}`);
  if (result.status === "SUCCESS") {
    console.log(`${result.newCount} new reviews`);
    if (result.reportPath) console.log(`Report: ${result.reportPath}`);
  }
  if (result.error) console.log(`Error: ${result.error}`);
}

try {
  if (command === "process") {
    const path = args[1];
    if (!path) throw new Error("Usage: pnpm review:process <reviews-json>");
    const result = await processReviewFile(path);
    console.log(`${result.newCount} new reviews`);
    if (result.reportPath) console.log(`Report: ${result.reportPath}`);
  } else if (command === "check") {
    const config = await readConfig(option("--config"));
    const requested = option("--business");
    const selected = requested ? config.businesses.filter((item) => item.id === requested) : config.businesses.filter((item) => item.enabled);
    if (!selected.length) throw new Error(requested ? `Unknown business id: ${requested}` : "No enabled businesses configured.");
    const results: BusinessRunResult[] = [];
    for (const business of selected) {
      const input = selected.length === 1 ? option("--reviews") : undefined;
      const result = await checkOne(business, config.businesses.length, config.email, input);
      results.push(result);
      printRun(result);
    }
    if (results.some((item) => item.status === "FAILED")) process.exitCode = 1;
  } else if (command === "status" || command === "eligibility") {
    const config = await readConfig(option("--config"));
    for (const business of config.businesses) {
      const legacyPath = config.businesses.length === 1 ? resolve("data/seen-reviews.json") : undefined;
      const state = await readBusinessState(statePathFor(business.id), business.id, legacyPath);
      const eligibility = getEligibility(business, state);
      if (command === "eligibility") console.log(`${business.id}: ${eligibility.status} next=${eligibility.nextEligibleAt ?? "now"}`);
      else console.log(`${business.id}: seen=${state.identities.length} lastSuccessfulRun=${state.lastSuccessfulRun ?? "never"} eligibility=${eligibility.status}`);
    }
  } else if (command === "reset") {
    await rm(resolve("data/seen-reviews.json"), { force: true });
    console.log("Legacy review state reset");
  } else throw new Error("Usage: pnpm review:process <reviews-json> | pnpm review:check [--business id] [--reviews path] | pnpm review:status | pnpm review:eligibility | pnpm review:reset");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
