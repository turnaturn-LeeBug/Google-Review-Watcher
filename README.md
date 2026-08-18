# Review Watcher

Review Watcher is an independent open-source Codex plugin that performs read-only Google Business review checks, tracks unseen reviews per business, enforces configurable minimum intervals, and exports new reviews to XLSX.

Review Watcher is not related to Altus or RelayMinders. It is not affiliated with, endorsed by, or sponsored by Google.

Current development version: `0.2.0-dev`. This is not a tagged public release.

## Quick Start

After installing the plugin, normal setup is conversational. Tell Codex:

```text
Set up Review Watcher
```

Codex verifies the Google listing read-only, asks for a collection start date, interval, and optional report recipients, displays a complete summary, and saves only after you answer Confirm. Other supported intents are:

```text
Review Watcher settings
Add another business
Check my reviews
```

Settings edits change only the selected field. When several businesses are enabled, `Check my reviews` asks whether to check all or select one.

## Requirements and installation

- Codex with a supported browser capability
- Node.js 20 or newer
- pnpm 10 or newer

```bash
git clone <your-review-watcher-repository-url>
cd Review-Watcher
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

The complete plugin is contained in this repository: `.codex-plugin/plugin.json` is the manifest and `skills/review-watcher/SKILL.md` is the reusable skill. For a local marketplace, place the whole repository at `<marketplace-root>/plugins/review-watcher`, add a matching local marketplace entry, register the marketplace, and install `review-watcher@<marketplace-name>`. Start a new Codex task after installation.

## Advanced manual configuration

Copy `config/business.example.json` to the gitignored `config/business.json` and edit it:

```json
{
  "businesses": [
    {
      "id": "example-business",
      "businessName": "Example Business",
      "googleUrl": "https://www.google.com/maps/place/example",
      "startDate": "2026-08-17",
      "minimumIntervalDays": 3,
      "enabled": true
    }
  ],
  "email": {
    "enabled": false
  }
}
```

Each business needs a unique, stable lowercase kebab-case `id`. State lives under `data/businesses/<id>/state.json`, and reports live under `reports/<id>/`. `minimumIntervalDays` defaults to 3. An omitted `enabled` value defaults to true.

`startDate` is the inclusive historical collection boundary. Reviews with a known derived date before it are excluded. The conversational setup command persists configuration atomically and requires explicit confirmation:

```bash
pnpm review:configure -- show
```

The v0.1.1 single-business shape remains readable and is normalized to the id `default-business` unless an `id` is supplied.

## Eligibility and checks

Review Watcher does not implement fixed clock-time scheduling. It determines eligibility when a command starts:

```bash
pnpm review:eligibility
pnpm review:status
pnpm review:check
pnpm review:check --business example-business
```

When elapsed time is less than `minimumIntervalDays`, the result is `SKIPPED_NOT_ELIGIBLE`. Equality is eligible. `lastSuccessfulRun` changes only after browser collection, processing, XLSX creation, and enabled email delivery all succeed.

Codex first checks eligibility, then performs the browser collection described by the skill. Save each business's records in a separate gitignored file, normally `tmp/<business-id>-reviews.local.json`. Process a selected business explicitly when needed:

```bash
pnpm review:check --business example-business --reviews tmp/example-business-reviews.local.json
```

`pnpm review:check` processes all enabled businesses using their default local input paths. A failure is reported per business and does not change another business's state.

The original v0.1.1 processing command remains available:

```bash
pnpm review:process fixtures/sample-reviews.json
```

## Review dates

Review Watcher always preserves Google's displayed value as `googleDisplayedTime` and retains `relativeTime` for compatibility. It additionally records `derivedReviewDate` and `dateConfidence`.

Supported inputs include `N days ago`, `a week ago`, `N weeks ago`, ISO dates, and common explicit month/day dates. Relative dates are derived from `capturedAt` and marked `derived-day` or `derived-week`; explicit dates are marked `exact`; unparsed dates are `unknown`. Derived dates never replace Google's original text.

## Review identity and deduplication

When browser-visible DOM data exposes a stable Google review identifier, the skill captures `googleReviewId`, and Review Watcher prefers `google:<id>` as the review identity. The browser workflow must not invent IDs or use transient list positions.

Without a stable review ID, Review Watcher uses a SHA-256 fingerprint based on normalized business, reviewer, stars, and review text. Non-empty review text retains v0.1.1 behavior and excludes changing time fields. For rating-only reviews, the fallback also includes reviewer profile URL and Google's displayed time when available to reduce avoidable collisions.

The rating-only fallback is necessarily imperfect: two rating-only reviews with the same business, reviewer, stars, profile, and displayed time can still collide; the displayed time can also change and cause an already-seen rating-only review to appear new. Stable Google review IDs avoid both problems when available.

## XLSX reports

Reports contain only new reviews and are written independently to `reports/<business-id>/<business-slug>-reviews-YYYY-MM-DD.xlsx`. Columns retain the v0.1.1 fields and add derived date, confidence, Google review ID, and review identity. Reports include a bold header, wrapped review text, frozen header, filter, and readable widths.

## SMTP email delivery

Email remains disabled by default. Enable SMTP per business using only non-secret settings:

```json
"email": {
  "enabled": true,
  "provider": "smtp",
  "recipients": ["reports@example.com"],
  "sendWhenNoNewReviews": false
}
```

Copy `.env.example` values into your local environment or secret manager:

```text
REVIEW_WATCHER_SMTP_HOST
REVIEW_WATCHER_SMTP_PORT
REVIEW_WATCHER_SMTP_USER
REVIEW_WATCHER_SMTP_PASSWORD
REVIEW_WATCHER_SMTP_FROM
```

Never put SMTP credentials in `config/business.json`. A successful email includes the new-review count, average rating, count by star rating, report filename, and XLSX attachment. `sendWhenNoNewReviews` defaults to false; when true, a zero-review summary is sent without an attachment.

SMTP is transactional with state: a send failure reports `FAILED` and does not advance identities or `lastSuccessfulRun`. The already-created local XLSX may remain for diagnosis and retry.

## State safety and privacy

- Google interaction is strictly read-only. Never reply, react, report, post, edit, delete, or change business information.
- Each business state file is local, inspectable, duplicate-resistant, and atomically replaced.
- State is committed only after the complete business run succeeds.
- A failure in one business cannot overwrite another business's state.
- Local configuration, real review inputs, state, reports, cookies, authentication data, sessions, browser profiles, and environment files are gitignored.
- No Google API key, Google account data, cloud database, or saved cookies are required.
- Stop rather than fabricate when Google presents a CAPTCHA, login wall, unsupported structure, or unreliable browser state.

## Sanitized fixture

`fixtures/sample-reviews.json` contains fictional public test data. It continues to work with the compatibility command:

```bash
pnpm review:process fixtures/sample-reviews.json
pnpm review:process fixtures/sample-reviews.json
```

The first clean run reports 3 new reviews; the second reports exactly 0 new reviews.

## Migrating from v0.1.1

1. Keep the existing repository and install with the unchanged lockfile.
2. Replace the local single-business config with the `businesses` array when convenient. Legacy config remains readable.
3. Give every business a permanent id; changing an id creates a separate state namespace.
4. v0.2 state is stored per business under `data/businesses/`. For a single legacy business, the CLI can read `data/seen-reviews.json` and initialize compatible identity and last-run values.
5. Continue using `review:process` for the exact v0.1.1 workflow, or move to `review:eligibility` and `review:check` for intervals and multi-business state.
6. Do not copy or commit old reports, real input JSON, local config, cookies, or browser sessions.

## Known limitations

- Google UI and DOM attributes can change; a stable review ID is not guaranteed to be exposed.
- Rating-only fallback identity remains imperfect without a stable Google review ID.
- Relative-date derivation is calendar-day approximation in UTC and is clearly marked as derived.
- The CLI coordinates local inputs produced by Codex's browser workflow; it is not a standalone Google scraper.
- SMTP availability, authentication policy, message limits, and attachment limits depend on the operator's provider.
- There is no GUI, fixed-time scheduler, cloud database, or Google write capability.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Licensed under the [MIT License](LICENSE).
