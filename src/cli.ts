#!/usr/bin/env node
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { processReviewFile } from "./process.js";
import { readState } from "./state.js";

const [command, argument] = process.argv.slice(2);
try {
  if (command === "process") {
    if (!argument) throw new Error("Usage: pnpm review:process <reviews-json>");
    const result = await processReviewFile(argument);
    console.log(`${result.newCount} new reviews`);
    if (result.reportPath) console.log(`Report: ${result.reportPath}`);
  } else if (command === "status") {
    const state = await readState(resolve("data/seen-reviews.json"));
    console.log(`${state.fingerprints.length} seen reviews`);
    console.log(`Last updated: ${state.updatedAt ?? "never"}`);
  } else if (command === "reset") {
    await rm(resolve("data/seen-reviews.json"), { force: true });
    console.log("Review state reset");
  } else throw new Error("Usage: pnpm review:process <reviews-json> | pnpm review:status | pnpm review:reset");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
