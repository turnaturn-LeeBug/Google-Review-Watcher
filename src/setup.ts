import { readFile } from "node:fs/promises";
import { parseConfig, validateEmailConfig, writeConfigAtomic } from "./config.js";
import type { BusinessConfig, EmailConfig, ReviewWatcherConfig } from "./types.js";

export type StartDateChoice = "today" | "last-7-days" | string;
export interface SetupDraft {
  businessName: string;
  googleUrl: string;
  startDate: string;
  minimumIntervalDays: number;
  email: EmailConfig;
  enabled?: boolean;
}
export type BusinessSettingsPatch = Partial<Pick<BusinessConfig, "googleUrl" | "startDate" | "minimumIntervalDays" | "email" | "enabled">>;

export function validateGoogleUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("A valid Google Business or Google Maps URL is required."); }
  const host = url.hostname.toLowerCase();
  const googleHost = host === "g.page" || host === "maps.app.goo.gl" || host === "goo.gl" || host === "google.com" || host.endsWith(".google.com") || /^google\.[a-z.]+$/.test(host) || host.endsWith(".google.co.uk");
  if (url.protocol !== "https:" || !googleHost) throw new Error("A valid HTTPS Google Business or Google Maps URL is required.");
  return url.toString();
}

export function resolveStartDate(choice: StartDateChoice, now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (choice === "today") return day.toISOString().slice(0, 10);
  if (choice === "last-7-days") { day.setUTCDate(day.getUTCDate() - 7); return day.toISOString().slice(0, 10); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(choice)) throw new Error("Start date must be Today, Last 7 days, or a valid YYYY-MM-DD date.");
  const parsed = new Date(`${choice}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== choice) throw new Error("Start date must be a valid date.");
  return choice;
}

export function validateIntervalDays(value: number): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error("Check interval must be a positive whole number of days.");
  return value;
}

export function createSetupDraft(input: Omit<SetupDraft, "googleUrl" | "startDate" | "minimumIntervalDays" | "email"> & {
  googleUrl: string; startDate: StartDateChoice; minimumIntervalDays: number; email?: EmailConfig;
}, now = new Date()): SetupDraft {
  if (!input.businessName.trim()) throw new Error("Business name is required.");
  return { businessName: input.businessName.trim(), googleUrl: validateGoogleUrl(input.googleUrl),
    startDate: resolveStartDate(input.startDate, now), minimumIntervalDays: validateIntervalDays(input.minimumIntervalDays),
    email: validateEmailConfig(input.email ?? { enabled: false })!, enabled: input.enabled ?? true };
}

const slug = (value: string): string => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "business";

function uniqueId(name: string, businesses: BusinessConfig[]): string {
  const base = slug(name); const used = new Set(businesses.map((item) => item.id));
  if (!used.has(base)) return base;
  let suffix = 2; while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function readOrEmpty(path: string): Promise<ReviewWatcherConfig> {
  try { return parseConfig(JSON.parse(await readFile(path, "utf8")) as unknown); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { businesses: [], email: { enabled: false } }; throw error; }
}

export async function persistSetup(path: string, draft: SetupDraft, confirmed: boolean): Promise<BusinessConfig> {
  if (!confirmed) throw new Error("Explicit confirmation is required before saving Review Watcher configuration.");
  const existing = await readOrEmpty(path);
  const business: BusinessConfig = { id: uniqueId(draft.businessName, existing.businesses), businessName: draft.businessName,
    googleUrl: draft.googleUrl, startDate: draft.startDate, minimumIntervalDays: draft.minimumIntervalDays,
    enabled: draft.enabled ?? true, email: draft.email };
  await writeConfigAtomic(path, { ...existing, businesses: [...existing.businesses, business] });
  return business;
}

export async function editBusinessSettings(path: string, id: string, patch: BusinessSettingsPatch): Promise<BusinessConfig> {
  const existing = await readOrEmpty(path); const index = existing.businesses.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Unknown business id: ${id}`);
  const current = existing.businesses[index];
  const edited: BusinessConfig = { ...current, ...patch,
    googleUrl: patch.googleUrl === undefined ? current.googleUrl : validateGoogleUrl(patch.googleUrl),
    startDate: patch.startDate === undefined ? current.startDate : resolveStartDate(patch.startDate),
    minimumIntervalDays: patch.minimumIntervalDays === undefined ? current.minimumIntervalDays : validateIntervalDays(patch.minimumIntervalDays),
    email: patch.email === undefined ? current.email : validateEmailConfig(patch.email) };
  existing.businesses[index] = edited; await writeConfigAtomic(path, existing); return edited;
}
