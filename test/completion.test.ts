import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SMTPServer } from "smtp-server";
import { readBusinessState } from "../src/business-state.js";
import { normalizeBusinessReviews, runBusiness } from "../src/check.js";
import { readConfig } from "../src/config.js";
import { SmtpEmailDelivery, type MailTransport, type SmtpEnvironment } from "../src/email.js";
import { createSetupDraft, editBusinessSettings, persistSetup, resolveStartDate, validateGoogleUrl, validateIntervalDays } from "../src/setup.js";
import type { BusinessConfig, EmailConfig, ReviewInput } from "../src/types.js";

const now = new Date("2026-08-17T12:00:00Z");
const smtpEnv: SmtpEnvironment = { REVIEW_WATCHER_SMTP_HOST: "smtp.example.test", REVIEW_WATCHER_SMTP_PORT: "587",
  REVIEW_WATCHER_SMTP_USER: "sender@example.test", REVIEW_WATCHER_SMTP_PASSWORD: "test-secret",
  REVIEW_WATCHER_SMTP_FROM: "sender@example.test" };
const draft = (name = "Example Lantern Cafe") => createSetupDraft({ businessName: name,
  googleUrl: "https://www.google.com/maps/place/example", startDate: "last-7-days", minimumIntervalDays: 3,
  email: { enabled: false } }, now);

describe("conversational setup persistence", () => {
  test("creates setup config only after confirmation", async () => {
    const root = await mkdtemp(join(tmpdir(), "rw-setup-")); const path = join(root, "business.json");
    await expect(persistSetup(path, draft(), false)).rejects.toThrow(/confirmation/i);
    await expect(readFile(path, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const saved = await persistSetup(path, draft(), true);
    expect(saved.id).toBe("example-lantern-cafe");
    expect((await readConfig(path)).businesses[0].startDate).toBe("2026-08-10");
  });

  test("rejects invalid Google URL", () => expect(() => validateGoogleUrl("https://example.com/maps")).toThrow(/Google/));

  test("resolves start-date options and validates explicit dates", () => {
    expect(resolveStartDate("today", now)).toBe("2026-08-17");
    expect(resolveStartDate("last-7-days", now)).toBe("2026-08-10");
    expect(resolveStartDate("2026-08-01", now)).toBe("2026-08-01");
    expect(() => resolveStartDate("2026-02-30", now)).toThrow(/valid date/i);
  });

  test("requires a positive integer custom interval", () => {
    expect(validateIntervalDays(9)).toBe(9);
    expect(() => validateIntervalDays(0)).toThrow(/positive/);
    expect(() => validateIntervalDays(1.5)).toThrow(/whole/);
  });

  test("validates email addresses without storing credentials", () => {
    expect(() => createSetupDraft({ ...draft(), startDate: "today", email: {
      enabled: true, provider: "smtp", recipients: ["not-an-email"] } }, now)).toThrow(/email address/i);
  });

  test("adding a second business preserves the first", async () => {
    const root = await mkdtemp(join(tmpdir(), "rw-multi-")); const path = join(root, "business.json");
    await persistSetup(path, draft("First Cafe"), true); await persistSetup(path, draft("Second Cafe"), true);
    expect((await readConfig(path)).businesses.map((item) => item.businessName)).toEqual(["First Cafe", "Second Cafe"]);
  });

  test("settings edit modifies only the requested field", async () => {
    const root = await mkdtemp(join(tmpdir(), "rw-edit-")); const path = join(root, "business.json");
    const saved = await persistSetup(path, draft(), true); const before = (await readConfig(path)).businesses[0];
    await editBusinessSettings(path, saved.id, { minimumIntervalDays: 7 });
    const after = (await readConfig(path)).businesses[0];
    expect(after).toEqual({ ...before, minimumIntervalDays: 7 });
  });

  test("initial processing respects the configured start-date boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "rw-boundary-"));
    const item: BusinessConfig = { id: "boundary", businessName: "Boundary Cafe",
      googleUrl: "https://www.google.com/maps/place/example", startDate: "2026-08-10", minimumIntervalDays: 3, enabled: true };
    const reviews: ReviewInput[] = ["2026-08-09", "2026-08-10"].map((relativeTime, index) => ({ businessId: item.id,
      businessName: item.businessName, reviewerName: `Reviewer ${index}`, stars: 5, relativeTime, reviewText: `Review ${index}` }));
    const result = await runBusiness(item, reviews, { dataDir: join(root, "data"), reportsDir: join(root, "reports"), now });
    expect(result.status).toBe("SUCCESS"); expect(result.newCount).toBe(1);
  });
});

describe("SMTP delivery", () => {
  const business: BusinessConfig = { id: "smtp-business", businessName: "SMTP Business",
    googleUrl: "https://www.google.com/maps/place/example", startDate: "2026-08-01", minimumIntervalDays: 3, enabled: true };
  const input: ReviewInput = { businessId: business.id, businessName: business.businessName, reviewerName: "Example Reviewer",
    stars: 5, relativeTime: "2 days ago", reviewText: "Fictional review" };
  const config: EmailConfig = { enabled: true, provider: "smtp", recipients: ["reader@example.test"] };

  test("SMTP success sends summary and XLSX attachment", async () => {
    const messages: Record<string, unknown>[] = []; const transport: MailTransport = { sendMail: async (message) => { messages.push(message); } };
    const records = normalizeBusinessReviews(business, [input], now);
    await new SmtpEmailDelivery(smtpEnv, transport).deliver({ business, config, records, reportPath: "C:\\reports\\sample.xlsx", runDate: now });
    expect(messages).toHaveLength(1); expect(messages[0].subject).toBe("SMTP Business Google Review Report - 2026-08-17");
    expect(messages[0].text).toContain("Average rating: 5.00"); expect(messages[0].attachments).toHaveLength(1);
  });

  test("SMTP provider completes a real local protocol delivery", async () => {
    let received = "";
    const server = new SMTPServer({ disabledCommands: ["STARTTLS"],
      onAuth(_auth, _session, callback) { callback(null, { user: "test" }); },
      onData(stream, _session, callback) { stream.on("data", (chunk) => { received += chunk.toString(); }); stream.on("end", callback); } });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    try {
      const address = server.server.address(); if (!address || typeof address === "string") throw new Error("SMTP test server did not bind.");
      await new SmtpEmailDelivery({ ...smtpEnv, REVIEW_WATCHER_SMTP_HOST: "127.0.0.1", REVIEW_WATCHER_SMTP_PORT: String(address.port) })
        .deliver({ business, config: { ...config, sendWhenNoNewReviews: true }, records: [], reportPath: null, runDate: now });
      expect(received).toContain("Subject: SMTP Business Google Review Report - 2026-08-17");
      expect(received).toContain("New reviews: 0");
    } finally { await new Promise<void>((resolve) => server.close(resolve)); }
  });

  test("SMTP failure is reported", async () => {
    const transport: MailTransport = { sendMail: async () => { throw new Error("smtp unavailable"); } };
    await expect(new SmtpEmailDelivery(smtpEnv, transport).deliver({ business, config,
      records: normalizeBusinessReviews(business, [input], now), reportPath: "sample.xlsx", runDate: now })).rejects.toThrow("smtp unavailable");
  });

  test("SMTP failure does not update lastSuccessfulRun", async () => {
    const root = await mkdtemp(join(tmpdir(), "rw-smtp-state-"));
    const transport: MailTransport = { sendMail: async () => { throw new Error("smtp unavailable"); } };
    const result = await runBusiness({ ...business, email: config }, [input], { dataDir: join(root, "data"), reportsDir: join(root, "reports"),
      now, emailDelivery: new SmtpEmailDelivery(smtpEnv, transport) });
    expect(result.status).toBe("FAILED");
    expect((await readBusinessState(join(root, "data", business.id, "state.json"), business.id)).lastSuccessfulRun).toBeNull();
  });

  test("sendWhenNoNewReviews false skips SMTP", async () => {
    let sends = 0; const transport: MailTransport = { sendMail: async () => { sends += 1; } };
    await new SmtpEmailDelivery(smtpEnv, transport).deliver({ business, config, records: [], reportPath: null, runDate: now });
    expect(sends).toBe(0);
  });

  test("sendWhenNoNewReviews true sends SMTP summary", async () => {
    let sends = 0; const transport: MailTransport = { sendMail: async () => { sends += 1; } };
    await new SmtpEmailDelivery(smtpEnv, transport).deliver({ business, config: { ...config, sendWhenNoNewReviews: true },
      records: [], reportPath: null, runDate: now });
    expect(sends).toBe(1);
  });
});
