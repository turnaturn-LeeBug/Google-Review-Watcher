import { describe, expect, test } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { confirmationLabels, conversationCopy, detectConversationIntent, detectConversationLanguage,
  setupChoiceToConfig, versionStatus } from "../src/conversation.js";
import { persistSetup } from "../src/setup.js";

describe("Chinese conversational UI", () => {
  test("detects Chinese setup intents", () => {
    expect(detectConversationIntent("设置 Review Watcher")).toBe("setup");
    expect(detectConversationIntent("配置 Review Watcher")).toBe("setup");
  });
  test("detects Chinese settings intent", () => expect(detectConversationIntent("查看 Review Watcher 设置")).toBe("settings"));
  test("detects Chinese check intent", () => expect(detectConversationIntent("检查我的评论")).toBe("check"));
  test("detects Chinese version intents", () => {
    expect(detectConversationIntent("检查 Review Watcher 版本")).toBe("version");
    expect(detectConversationIntent("Review Watcher 是最新版吗")).toBe("version");
  });
  test("detects Chinese update intent", () => expect(detectConversationIntent("更新 Review Watcher")).toBe("update"));
  test("provides exact Chinese confirmation text", () => {
    expect(conversationCopy.zh.saveConfirmation).toBe("确认保存还是修改？");
    expect(conversationCopy.zh.updateConfirmation).toBe("是否现在更新？");
    expect(confirmationLabels("zh")).toContain("Google 权限：只读");
    expect(versionStatus("zh", true)).toBe("有可用更新");
  });
  test("English behavior remains unchanged", () => {
    expect(detectConversationIntent("Set up Review Watcher")).toBe("setup");
    expect(detectConversationIntent("Review Watcher settings")).toBe("settings");
    expect(detectConversationIntent("Check my reviews")).toBe("check");
    expect(conversationCopy.en.updateConfirmation).toBe("Update now?");
  });
  test("config values are language-neutral", () => {
    expect(setupChoiceToConfig("zh", "startDate", "从今天开始")).toBe("today");
    expect(setupChoiceToConfig("zh", "interval", "每 3 天")).toBe(3);
    expect(setupChoiceToConfig("en", "startDate", "Today")).toBe("today");
    expect(setupChoiceToConfig("en", "interval", "Every 3 days")).toBe(3);
  });
  test("switching language does not alter stored settings", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-watcher-language-")); const path = join(root, "business.json");
    await persistSetup(path, { businessName: "Example Business", googleUrl: "https://maps.google.com/example",
      startDate: "2026-08-17", minimumIntervalDays: 3, email: { enabled: false } }, true);
    const before = await readFile(path, "utf8");
    expect(detectConversationLanguage("设置 Review Watcher")).toBe("zh");
    expect(detectConversationLanguage("Review Watcher settings", "zh")).toBe("en");
    expect(await readFile(path, "utf8")).toBe(before);
    expect(Object.keys(JSON.parse(before).businesses[0])).not.toContain("语言");
  });
});
