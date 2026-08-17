---
name: review-watcher
description: Collect current Google Business or Google Maps reviews through the available browser, detect unseen reviews with local state, and export only new reviews to XLSX. Use when a user asks to check, collect, monitor, deduplicate, or report on Google reviews for a configured business URL.
---

# Review Watcher

Perform a strictly read-only Google review check and hand normalized records to the bundled CLI.

## Preconditions

1. Read `config/business.json`; if absent, ask the user to copy `config/business.example.json` and supply `businessName` and `googleUrl`.
2. Validate that `googleUrl` uses HTTPS and points to a Google Business or Maps page.
3. Use the available browser capability and its required setup instructions. Never use a connector that cannot expose the visible Google Reviews interface.

## Collect reviews

1. Open the configured URL.
2. Open the visible Reviews interface.
3. Choose the Newest sort order and verify it is active when the UI exposes sorting.
4. Read from newest downward. Scroll only as needed.
5. For each visible review capture `reviewerName`, integer `stars` (or `null` only when unavailable), Google's displayed relative or absolute time, and the full original review text.
6. Expand truncated text with a read-only “More” control when available. If Google displays a translation and exposes “See original,” use the original text when practical.
7. Preserve text verbatim. Do not translate, summarize, infer, or fabricate it.
8. Stop at a reliable incremental boundary: two or more consecutive already-seen fingerprints, or the end of the accessible review list. On a first run, collect the user-requested amount; if none is specified, collect at least the newest 10 accessible reviews.

Never reply, like, report, edit, delete, post, change business information, or perform any other Google write action. If a login wall, CAPTCHA, unsupported structure, or browser limitation prevents reliable collection, stop and report the exact blocker.

## Normalize and process

Create a local gitignored JSON array with this shape:

```json
[{"businessName":"Configured name","source":"google","reviewerName":"Name","stars":5,"relativeTime":"2 days ago","reviewText":"Original text","capturedAt":"2026-01-01T00:00:00.000Z"}]
```

Use one business per file. Then run:

```bash
pnpm review:process <local-reviews.json>
```

The CLI computes SHA-256 fingerprints from normalized business name, reviewer name, stars, and review text. It intentionally excludes time fields, exports only unseen reviews, and commits local state only after XLSX export succeeds. Report the new-review count and report path. If the CLI prints `0 new reviews`, do not create another report.

Use `pnpm review:status` to inspect the count of persisted fingerprints. Treat `pnpm review:reset` as destructive and run it only when the user explicitly asks to discard deduplication history.
