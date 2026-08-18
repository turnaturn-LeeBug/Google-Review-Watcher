import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BusinessConfig, EmailConfig, ReviewWatcherConfig } from "./types.js";

const defaultEmail = (): EmailConfig => ({ enabled: false });

export function validateEmailConfig(value: EmailConfig | undefined): EmailConfig | undefined {
  if (!value) return undefined;
  if (typeof value.enabled !== "boolean") throw new Error("Email configuration requires an enabled boolean.");
  const recipients = value.recipients ?? [];
  if (!Array.isArray(recipients) || recipients.some((item) => typeof item !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))
    throw new Error("Email recipients must be valid email addresses.");
  if (value.enabled && value.provider !== "smtp") throw new Error("Enabled email requires provider smtp.");
  return { enabled: value.enabled, provider: value.provider, recipients: [...new Set(recipients.map((item) => item.toLowerCase()))],
    sendWhenNoNewReviews: value.sendWhenNoNewReviews ?? false };
}

function normalizeBusiness(value: unknown, index: number): BusinessConfig {
  const item = value as Partial<BusinessConfig>;
  if (!item || typeof item.businessName !== "string" || !item.businessName.trim() ||
      typeof item.googleUrl !== "string" || !item.googleUrl.startsWith("https://"))
    throw new Error(`Invalid business configuration at index ${index}.`);
  const id = item.id?.trim();
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    throw new Error(`Business at index ${index} requires a stable lowercase kebab-case id.`);
  const minimumIntervalDays = item.minimumIntervalDays ?? 3;
  if (!Number.isInteger(minimumIntervalDays) || minimumIntervalDays <= 0)
    throw new Error(`Business ${id} has an invalid minimumIntervalDays.`);
  if (item.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.startDate)) throw new Error(`Business ${id} has an invalid startDate.`);
  return { id, businessName: item.businessName.trim(), googleUrl: item.googleUrl,
    startDate: item.startDate, minimumIntervalDays, enabled: item.enabled ?? true, email: validateEmailConfig(item.email) };
}

export function parseConfig(value: unknown): ReviewWatcherConfig {
  const root = value as { businesses?: unknown[]; email?: EmailConfig; businessName?: string; googleUrl?: string; id?: string; minimumIntervalDays?: number; enabled?: boolean };
  let values: unknown[];
  if (Array.isArray(root?.businesses)) values = root.businesses;
  else if (root && typeof root.businessName === "string" && typeof root.googleUrl === "string") {
    values = [{ id: root.id ?? "default-business", businessName: root.businessName, googleUrl: root.googleUrl,
      minimumIntervalDays: root.minimumIntervalDays, enabled: root.enabled }];
  } else throw new Error("Configuration must contain a businesses array or a legacy single-business object.");
  const businesses = values.map(normalizeBusiness);
  if (!businesses.length) throw new Error("Configuration must contain at least one business.");
  if (new Set(businesses.map((item) => item.id)).size !== businesses.length) throw new Error("Business ids must be unique.");
  const email = validateEmailConfig(root.email ?? defaultEmail())!;
  return { businesses, email };
}

export async function readConfig(path = "config/business.json"): Promise<ReviewWatcherConfig> {
  return parseConfig(JSON.parse(await readFile(resolve(path), "utf8")) as unknown);
}

export async function writeConfigAtomic(path: string, config: ReviewWatcherConfig): Promise<void> {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(parseConfig(config), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, target);
}
