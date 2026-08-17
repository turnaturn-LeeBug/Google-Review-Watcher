import type { DateConfidence } from "./types.js";

export interface ParsedGoogleDate {
  googleDisplayedTime: string | null;
  derivedReviewDate: string | null;
  dateConfidence: DateConfidence;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);
const subtractUtcDays = (date: Date, days: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - days));

export function parseGoogleDisplayedTime(value: string | null | undefined, capturedAt = new Date()): ParsedGoogleDate {
  const displayed = value?.trim() || null;
  if (!displayed) return { googleDisplayedTime: null, derivedReviewDate: null, dateConfidence: "unknown" };
  let match = displayed.match(/^(\d+)\s+days?\s+ago$/i);
  if (match) return { googleDisplayedTime: displayed, derivedReviewDate: isoDay(subtractUtcDays(capturedAt, Number(match[1]))), dateConfidence: "derived-day" };
  if (/^a\s+week\s+ago$/i.test(displayed))
    return { googleDisplayedTime: displayed, derivedReviewDate: isoDay(subtractUtcDays(capturedAt, 7)), dateConfidence: "derived-week" };
  match = displayed.match(/^(\d+)\s+weeks?\s+ago$/i);
  if (match) return { googleDisplayedTime: displayed, derivedReviewDate: isoDay(subtractUtcDays(capturedAt, Number(match[1]) * 7)), dateConfidence: "derived-week" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(displayed)) {
    const parsed = new Date(`${displayed}T00:00:00Z`);
    if (!Number.isNaN(parsed.valueOf())) return { googleDisplayedTime: displayed, derivedReviewDate: isoDay(parsed), dateConfidence: "exact" };
  }
  const explicit = displayed.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (explicit) {
    const suppliedYear = explicit[3] ? Number(explicit[3]) : capturedAt.getUTCFullYear();
    let parsed = new Date(`${explicit[1]} ${explicit[2]}, ${suppliedYear} 00:00:00 GMT`);
    if (!explicit[3] && parsed.valueOf() > capturedAt.valueOf()) parsed = new Date(`${explicit[1]} ${explicit[2]}, ${suppliedYear - 1} 00:00:00 GMT`);
    if (!Number.isNaN(parsed.valueOf())) return { googleDisplayedTime: displayed, derivedReviewDate: isoDay(parsed), dateConfidence: "exact" };
  }
  return { googleDisplayedTime: displayed, derivedReviewDate: null, dateConfidence: "unknown" };
}
