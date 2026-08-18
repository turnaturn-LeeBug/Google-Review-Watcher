---
name: review-watcher
description: Conversationally set up, update, and manage one or more Google Business review monitors, check configured listings read-only through the browser, enforce per-business intervals, email optional XLSX reports, and show settings, eligibility, or installed/latest stable versions. Use for intents including "Set up Review Watcher", "Review Watcher settings", "Add another business", "Check my reviews", "Check Review Watcher version", and "Update Review Watcher", including natural update-check variants.
---

# Review Watcher

Perform conversational configuration and strictly read-only Google review checks. Keep configuration local and never request email or Google passwords.

## Check version

For `Check Review Watcher version`, `Is Review Watcher up to date?`, or `Check for Review Watcher updates`:

1. Determine the repository root containing this skill and inspect the current package, plugin manifest, Git commit/tag, branch, remote, and source status.
2. Run `pnpm review:version` from that root. It checks public stable tags at `https://github.com/turnaturn-LeeBug/Google-Review-Watcher` without selecting prereleases.
3. Report Installed, Latest stable, and Up to date or Update available. Never treat RC, beta, alpha, or another prerelease as latest stable unless the user explicitly requests prereleases.

## Update safely

For `Update Review Watcher`, `Update this plugin`, or `Update Review Watcher to the latest stable version`:

1. Run `pnpm review:update` without confirmation. This inspects the installation path, Git validity, version, branch/tag, remote, source status, and latest public stable tag.
2. Stop on tracked or unignored source changes. Never reset, stash, overwrite, force checkout, delete, or automatically roll back. Ignored configuration, state, reports, `.env`, SMTP settings, and browser/session data do not block an update and must remain untouched.
3. If already current, report `Review Watcher is already up to date.` and do not reinstall.
4. Otherwise show current and available versions plus that settings, review history, reports, and SMTP environment will be preserved. Ask exactly: `Update now?`
5. Only after explicit confirmation run `pnpm review:update -- --confirm`. Stop at the first failed fetch, tag verification, checkout, install, build, test, audit, plugin validation, skill validation, or version check. Report the exact stage and current checked-out version; never claim success after failure.
6. On success report old/new versions and preservation results. Tell the user: `Start a new Codex task if the updated plugin is not immediately rediscovered.`

Use only the fixed public repository URL for release discovery and tag fetches. Never print SMTP passwords or send credentials to GitHub. Updating Review Watcher must not access or modify Google.

## Set up or add a business

For `Set up Review Watcher` or `Add another business`, ask one step at a time:

1. Ask exactly: `Please paste the Google Business or Google Maps URL you want to monitor.` Validate it as an HTTPS Google URL. Open it with the available browser read-only. Show the visible business name and address, then ask the user to confirm the identity. Do not continue when ambiguous or unconfirmed.
2. Ask: `When should Review Watcher begin collecting reviews?` Offer Today, Last 7 days, or Choose a date. Validate a chosen date and retain an ISO `YYYY-MM-DD` boundary.
3. Ask: `How often should Review Watcher check for new reviews?` Offer Daily, Every 3 days, Every 7 days, or Custom. Convert to positive-integer `minimumIntervalDays`.
4. Ask: `Where should Review Watcher send the XLSX report?` Accept one address, comma-separated addresses, or Skip for now. Validate basic email syntax. Explain that SMTP credentials come only from environment variables.
5. Show Business, Google URL, start date, interval, recipients or disabled, and `Google access: Read only`. Ask exactly: `Confirm or Edit?`
6. Do not write configuration until the user explicitly confirms. After confirmation, call `pnpm review:configure -- add --name <name> --url <url> --start-date <date> --interval <days> [--email <comma-separated>] --confirm`. Quote arguments for the active shell. Adding a business must preserve all existing businesses; the CLI assigns a stable unique id.

## Show or edit settings

For `Review Watcher settings`, run `pnpm review:configure -- show` and summarize each business without exposing environment variables. Ask which single field to change. Use `pnpm review:configure -- edit --business <id>` with only the selected `--url`, `--start-date`, `--interval`, `--email`, `--enable`, or `--disable` option. Use `--email disabled` to turn email off. Do not rerun full setup for a one-field change.

## Check intent

For `Check my reviews`, inspect settings and eligibility. If one enabled business exists, check it. If several exist, ask whether to check all or select one. Respect eligibility and never browse a skipped or disabled business.

## Select eligible businesses

1. Read `config/business.json`; if absent, offer the conversational setup flow above.
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
7. On initial setup, ignore reviews whose derived date is older than `startDate`; unknown dates may be retained rather than guessed. Stop at two consecutive known identities or the end of the accessible list. On a first run, collect the requested amount or at least the newest 10 accessible reviews within the boundary.

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

SMTP is the supported optional provider. Its host, port, user, password, and From address must come from `REVIEW_WATCHER_SMTP_*` environment variables, never configuration. Never claim email was sent unless the delivery stage succeeds.
