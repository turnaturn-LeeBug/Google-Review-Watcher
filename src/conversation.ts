export type ConversationLanguage = "en" | "zh";
export type ConversationIntent = "setup" | "settings" | "add-business" | "check" | "version" | "update" | "unknown";

const chineseIntents: Array<[ConversationIntent, RegExp]> = [
  ["settings", /查看\s*Review Watcher\s*设置/i],
  ["add-business", /添加另一个商家/],
  ["check", /检查我的评论/],
  ["version", /检查\s*Review Watcher\s*版本|Review Watcher\s*是最新版吗/i],
  ["update", /更新\s*Review Watcher/i],
  ["setup", /设置\s*Review Watcher|配置\s*Review Watcher/i]
];

const englishIntents: Array<[ConversationIntent, RegExp]> = [
  ["settings", /\breview watcher settings\b/i],
  ["add-business", /\badd another business\b/i],
  ["check", /\bcheck my reviews\b/i],
  ["version", /\bcheck review watcher version\b|\bis review watcher up to date\??|\bcheck for review watcher updates\b/i],
  ["update", /\bupdate review watcher\b|\bupdate this plugin\b/i],
  ["setup", /\bset up review watcher\b|\bconfigure review watcher\b/i]
];

export function detectConversationLanguage(message: string, current: ConversationLanguage = "en"): ConversationLanguage {
  if (/\p{Script=Han}/u.test(message)) return "zh";
  if (/[A-Za-z]/.test(message)) return "en";
  return current;
}

export function detectConversationIntent(message: string): ConversationIntent {
  for (const [intent, pattern] of [...chineseIntents, ...englishIntents]) if (pattern.test(message)) return intent;
  return "unknown";
}

export const conversationCopy = {
  en: {
    googleUrl: "Please paste the Google Business or Google Maps URL you want to monitor.",
    businessConfirmation: "Is this the correct business?",
    startDate: "When should Review Watcher begin collecting reviews?",
    startDateOptions: ["Today", "Last 7 days", "Choose a date"],
    interval: "How often should Review Watcher check for new reviews?",
    intervalOptions: ["Daily", "Every 3 days", "Every 7 days", "Custom"],
    email: "Where should Review Watcher send the XLSX report?",
    emailOptions: ["Enter email", "Skip for now"],
    saveConfirmation: "Confirm or Edit?",
    checkOptions: ["Check all", "Select a business"],
    updateConfirmation: "Update now?"
  },
  zh: {
    googleUrl: "请粘贴你想监控的 Google 商家或 Google Maps 链接。",
    businessConfirmation: "这是正确的商家吗？",
    startDate: "你希望从什么时候开始收集评论？",
    startDateOptions: ["从今天开始", "最近 7 天", "选择日期"],
    interval: "你希望多久检查一次新评论？",
    intervalOptions: ["每天", "每 3 天", "每 7 天", "自定义"],
    email: "你希望把 XLSX 报告发送到哪个邮箱？",
    emailOptions: ["输入邮箱", "暂时跳过"],
    saveConfirmation: "确认保存还是修改？",
    checkOptions: ["检查全部", "选择一个商家"],
    updateConfirmation: "是否现在更新？"
  }
} as const;

export function setupChoiceToConfig(language: ConversationLanguage, category: "startDate" | "interval", choice: string): string | number {
  const normalized = choice.trim().toLowerCase();
  if (category === "startDate") {
    if ((language === "zh" && choice === "从今天开始") || normalized === "today") return "today";
    if ((language === "zh" && choice === "最近 7 天") || normalized === "last 7 days") return "last-7-days";
    return choice;
  }
  if ((language === "zh" && choice === "每天") || normalized === "daily") return 1;
  if ((language === "zh" && choice === "每 3 天") || normalized === "every 3 days") return 3;
  if ((language === "zh" && choice === "每 7 天") || normalized === "every 7 days") return 7;
  const days = Number(choice); return Number.isInteger(days) && days > 0 ? days : choice;
}

export function confirmationLabels(language: ConversationLanguage): readonly string[] {
  return language === "zh"
    ? ["商家", "Google 链接", "开始收集日期", "检查频率", "Email", "Google 权限：只读"]
    : ["Business", "Google URL", "Start date", "Check interval", "Email", "Google access: Read only"];
}

export function versionStatus(language: ConversationLanguage, updateAvailable: boolean): string {
  if (language === "zh") return updateAvailable ? "有可用更新" : "已经是最新版";
  return updateAvailable ? "Update available" : "Up to date";
}
