import { basename } from "node:path";
import nodemailer from "nodemailer";
import type { BusinessConfig, EmailConfig, ReviewRecord } from "./types.js";

export interface EmailDeliveryContext {
  business: BusinessConfig;
  config: EmailConfig;
  reportPath: string | null;
  records: ReviewRecord[];
  runDate: Date;
}

export interface EmailDelivery {
  deliver(context: EmailDeliveryContext): Promise<void>;
}

export interface MailTransport { sendMail(message: Record<string, unknown>): Promise<unknown> }
export interface SmtpEnvironment {
  REVIEW_WATCHER_SMTP_HOST?: string;
  REVIEW_WATCHER_SMTP_PORT?: string;
  REVIEW_WATCHER_SMTP_USER?: string;
  REVIEW_WATCHER_SMTP_PASSWORD?: string;
  REVIEW_WATCHER_SMTP_FROM?: string;
}

function smtpSettings(env: SmtpEnvironment): { host: string; port: number; user: string; password: string; from: string } {
  const host = env.REVIEW_WATCHER_SMTP_HOST?.trim(); const port = Number(env.REVIEW_WATCHER_SMTP_PORT);
  const user = env.REVIEW_WATCHER_SMTP_USER?.trim(); const password = env.REVIEW_WATCHER_SMTP_PASSWORD;
  const from = env.REVIEW_WATCHER_SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535 || !user || !password || !from)
    throw new Error("SMTP email requires REVIEW_WATCHER_SMTP_HOST, PORT, USER, PASSWORD, and FROM environment variables.");
  return { host, port, user, password, from };
}

export class SmtpEmailDelivery implements EmailDelivery {
  constructor(private readonly env: SmtpEnvironment = process.env, private readonly transport?: MailTransport) {}

  async deliver(context: EmailDeliveryContext): Promise<void> {
    if (!context.config.enabled) return;
    if (!context.records.length && !context.config.sendWhenNoNewReviews) return;
    const recipients = context.config.recipients ?? [];
    if (!recipients.length) throw new Error("SMTP email is enabled but no recipients are configured.");
    const settings = smtpSettings(this.env); const counts = new Map<number, number>(); let total = 0; let rated = 0;
    for (const record of context.records) if (record.stars !== null) {
      counts.set(record.stars, (counts.get(record.stars) ?? 0) + 1); total += record.stars; rated += 1;
    }
    const reportName = context.reportPath ? basename(context.reportPath) : "No XLSX generated (zero new reviews)";
    const body = [`New reviews: ${context.records.length}`, `Average rating: ${rated ? (total / rated).toFixed(2) : "N/A"}`,
      "Count by star rating:", [5, 4, 3, 2, 1].map((stars) => `${stars} star: ${counts.get(stars) ?? 0}`).join("\n"),
      `Report: ${reportName}`].join("\n");
    const transport = this.transport ?? nodemailer.createTransport({ host: settings.host, port: settings.port,
      secure: settings.port === 465, auth: { user: settings.user, pass: settings.password } });
    await transport.sendMail({ from: settings.from, to: recipients.join(", "),
      subject: `${context.business.businessName} Google Review Report - ${context.runDate.toISOString().slice(0, 10)}`,
      text: body, attachments: context.reportPath ? [{ filename: reportName, path: context.reportPath }] : [] });
  }
}

export class DisabledEmailDelivery implements EmailDelivery {
  async deliver(context: EmailDeliveryContext): Promise<void> {
    if (context.config.enabled) throw new Error("Email is enabled but no supported delivery provider is configured.");
  }
}

export function createEmailDelivery(config: EmailConfig): EmailDelivery {
  if (!config.enabled) return new DisabledEmailDelivery();
  if (config.provider === "smtp") return new SmtpEmailDelivery();
  return new DisabledEmailDelivery();
}
