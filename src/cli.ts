#!/usr/bin/env node
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { readBusinessState } from "./business-state.js";
import { runBusiness } from "./check.js";
import { readConfig } from "./config.js";
import { getEligibility } from "./eligibility.js";
import { processReviewFile } from "./process.js";
import { createSetupDraft, editBusinessSettings, persistSetup } from "./setup.js";
import { checkVersion, updateReviewWatcher } from "./update.js";
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
  } else if (command === "version") {
    const result = await checkVersion(process.cwd());
    console.log(`Installed: ${result.installed}`);
    console.log(`Latest stable: ${result.latestStable}`);
    console.log(`Status: ${result.status === "UP_TO_DATE" ? "Up to date" : result.status === "UPDATE_AVAILABLE" ? "Update available" : "Installed version is newer than latest stable"}`);
  } else if (command === "update") {
    const result = await updateReviewWatcher(process.cwd(), args.includes("--confirm"));
    if (result.status === "ALREADY_UP_TO_DATE") console.log("Review Watcher is already up to date.");
    else if (result.status === "CONFIRMATION_REQUIRED") {
      console.log(`Current version: ${result.previousVersion}`); console.log(`Available version: ${result.targetVersion}`);
      console.log("Local settings: Will be preserved\nReview history: Will be preserved\nReports: Will be preserved\nSMTP environment: Will be preserved");
      console.log("Update now?");
    } else {
      console.log("Review Watcher updated successfully."); console.log(`Previous version: ${result.previousVersion}`);
      console.log(`Current version: ${result.currentVersion}`); console.log("Business settings: Preserved\nReview history: Preserved\nReports: Preserved\nEmail settings: Preserved");
      console.log(`Validation stages: ${result.stages.join(", ")}`); console.log("Start a new Codex task if the updated plugin is not immediately rediscovered.");
    }
  } else if (command === "config") {
    const action = args[1]; const path = option("--config") ?? "config/business.json";
    if (action === "show") console.log(JSON.stringify(await readConfig(path), null, 2));
    else if (action === "add") {
      const businessName = option("--name"); const googleUrl = option("--url"); const startDate = option("--start-date");
      const interval = Number(option("--interval")); const recipients = option("--email")?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
      if (!businessName || !googleUrl || !startDate) throw new Error("Config add requires --name, --url, --start-date, and --interval.");
      const draft = createSetupDraft({ businessName, googleUrl, startDate, minimumIntervalDays: interval,
        email: recipients.length ? { enabled: true, provider: "smtp", recipients,
          sendWhenNoNewReviews: args.includes("--send-when-empty") } : { enabled: false } });
      const saved = await persistSetup(path, draft, args.includes("--confirm")); console.log(`Saved ${saved.id}`);
    } else if (action === "edit") {
      const id = option("--business"); if (!id) throw new Error("Config edit requires --business id.");
      const recipients = option("--email");
      const edited = await editBusinessSettings(path, id, {
        googleUrl: option("--url"), startDate: option("--start-date"),
        minimumIntervalDays: option("--interval") === undefined ? undefined : Number(option("--interval")),
        enabled: args.includes("--enable") ? true : args.includes("--disable") ? false : undefined,
        email: recipients === undefined ? undefined : recipients === "disabled" ? { enabled: false } : {
          enabled: true, provider: "smtp", recipients: recipients.split(",").map((item) => item.trim()).filter(Boolean),
          sendWhenNoNewReviews: args.includes("--send-when-empty") }
      });
      console.log(`Updated ${edited.id}`);
    } else throw new Error("Usage: pnpm review:configure -- show|add|edit ...");
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
  } else throw new Error("Usage: pnpm review:process <reviews-json> | pnpm review:version | pnpm review:update [--confirm] | pnpm review:configure -- show|add|edit | pnpm review:check [--business id] [--reviews path] | pnpm review:status | pnpm review:eligibility | pnpm review:reset");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
