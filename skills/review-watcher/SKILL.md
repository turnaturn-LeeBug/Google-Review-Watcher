---
name: review-watcher
description: Check one or more configured Google Business or Google Maps listings through the available browser, enforce per-business minimum intervals, detect unseen reviews, and export new reviews to independent XLSX reports. Use when a user asks to check, monitor, deduplicate, schedule eligibility for, or report on configured Google reviews.
---

# Review Watcher

Perform strictly read-only Google review checks and hand normalized records to the bundled CLI.

## Select eligible businesses

1. Read `config/business.json`; if absent, ask the user to copy `config/business.example.json` and configure the `businesses` array.
2. Run `pnpm review:eligibility` before opening Google.
3. Check only enabled businesses reported as `ELIGIBLE`. Do not browse for a business reported as `SKIPPED_NOT_ELIGIBLE` or `DISABLED`.
4. For a user-selected business, use its stable `id` with `pnpm review:check --business <id>`.

## Collect reviews

For each eligible business independently:

1. Open its configured HTTPS Google Business or Maps URL.
2. Open Reviews and choose Newest. Verify that Newest is active.
3. Read newest downward and capture reviewer name, integer stars or `null`, Google's original displayed time, original review text, and reviewer profile URL when visible.
4. Inspect read-only DOM attributes for a stable Google review identifier such as an explicit review-id data attribute. Capture it as `googleReviewId` only when the page exposes a stable value tied to that review; never invent or derive one from list position.
5. Expand truncated text with a read-only More control. Prefer original text when Google exposes See original.
6. Preserve text and displayed time verbatim. Do not translate, summarize, infer, or fabricate.
7. Stop at two consecutive known identities or the end of the accessible list. On a first run, collect the requested amount or at least the newest 10 accessible reviews.

Never reply, react, like, report, edit, delete, post, change business information, or perform any Google write action. Stop and report a login wall, CAPTCHA, unsupported structure, or browser limitation. Continue other configured businesses after one business fails.

## Process a business

Save each business to a separate gitignored file such as `tmp/<business-id>-reviews.local.json`:

```json
[{"businessId":"example-business","businessName":"Example Business","source":"google","reviewerName":"Name","stars":5,"googleDisplayedTime":"2 days ago","relativeTime":"2 days ago","googleReviewId":null,"reviewText":"Original text","capturedAt":"2026-01-01T00:00:00.000Z"}]
```

Then run:

```bash
pnpm review:check --business <business-id> --reviews tmp/<business-id>-reviews.local.json
```

Run `pnpm review:check` after preparing the default `tmp/<business-id>-reviews.local.json` file for every eligible enabled business. Use `pnpm review:status` for per-business state.

The CLI prefers `googleReviewId` for identity. Without it, it uses a SHA-256 fallback. Rating-only fallbacks include reviewer profile and displayed time when available, but remain imperfect. The CLI writes state only after report creation and optional email delivery both succeed. Report `SUCCESS`, `SKIPPED_NOT_ELIGIBLE`, or the exact failure per business.

Keep email disabled unless a delivery provider implementing the repository interface has been configured. Never claim email was sent when no provider exists.
