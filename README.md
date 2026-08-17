# Review Watcher

Review Watcher is an independent open-source Codex plugin that guides Codex through a read-only Google Business review check, fingerprints collected reviews locally, and writes an XLSX report containing only reviews it has not seen before.

Review Watcher is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Google.

## Requirements

- Codex with a supported browser capability
- Node.js 20 or newer
- pnpm 10 or newer

## Installation

```bash
git clone <your-review-watcher-repository-url>
cd Review-Watcher
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

## Codex plugin and skill setup

The complete plugin is contained in this repository. Its manifest is `.codex-plugin/plugin.json`, and its reusable skill is `skills/review-watcher/SKILL.md`. No sibling directory is required at runtime.

For a local marketplace, place the whole repository at `<marketplace-root>/plugins/review-watcher`, add a matching local plugin entry to `<marketplace-root>/marketplace.json`, register that marketplace with `codex plugin marketplace add <marketplace-root>`, and install with `codex plugin add review-watcher@<marketplace-name>`. Start a new Codex task after installation so the skill is discovered.

For skill-only setup, copy the complete `skills/review-watcher` directory into your Codex skills directory. Keep this repository available because the skill invokes its CLI for fingerprinting, state, and XLSX export.

## Configure a business

```powershell
Copy-Item config/business.example.json config/business.json
```

Edit the local, gitignored file:

```json
{
  "businessName": "Your Business",
  "googleUrl": "https://www.google.com/maps/place/your-business"
}
```

No business is hard-coded. Keep real business configuration local.

## Try the sanitized sample fixture

`fixtures/sample-reviews.json` contains fictional business, reviewer, and review data suitable for public validation. From a fresh checkout, run:

```bash
pnpm review:process fixtures/sample-reviews.json
pnpm review:status
pnpm review:process fixtures/sample-reviews.json
```

The first processing run reports `3 new reviews` and creates `reports/example-lantern-cafe-reviews-YYYY-MM-DD.xlsx`. The second processing run reports exactly `0 new reviews` and does not create another report. The generated state and report remain local and are ignored by Git.

## Run a review check

Ask Codex: “Use Review Watcher to check my configured business for new reviews.” The skill instructs Codex to open the configured page, open Reviews, select Newest, preserve original review text, and save normalized records to a local JSON file. It then runs:

```bash
pnpm review:process <reviews-json>
pnpm review:status
```

Input must be an array of records with `businessName`, `reviewerName`, `stars`, `relativeTime`, and `reviewText`; `source` and `capturedAt` are optional. Only one business is accepted per run.

Reports are written to `reports/<business-slug>-reviews-YYYY-MM-DD.xlsx`. They contain Review Date (blank unless reliably available), Google Relative Time, Reviewer Name, Star Rating, Review Text, Fingerprint, Captured At, and Source. A run with no unseen reviews prints exactly `0 new reviews` and creates no report.

## Deduplication

Review Watcher computes SHA-256 over normalized business identity, reviewer name, star rating, and review text. Whitespace and casing are normalized. Relative time and capture time are excluded because Google’s “4 days ago” can later become “a week ago.” Within-run duplicates are also removed.

Seen fingerprints are stored in the inspectable `data/seen-reviews.json`. State is written through a temporary file and renamed only after successful XLSX export, so a failed export cannot replace the previous state.

## Privacy and read-only policy

- Google interaction is strictly read-only. Review Watcher must never reply, like, report, post, edit, delete, or change business information.
- The plugin does not require a Google API key, cloud database, cookies, or saved Google account data.
- Local business configuration, real review inputs, fingerprint state, reports, cookies, authentication data, browser profiles, and session data are gitignored.
- Never commit secrets, cookies, account data, private configuration, or generated reports.
- If Google presents a CAPTCHA, login wall, unsupported structure, or unreliable page, collection stops rather than inventing data.

## Limitations

- Google’s interface and accessibility labels can change, so browser collection is guided rather than a brittle scraper.
- Google may rate-limit access or require consent/sign-in depending on region and session.
- Review dates remain blank when Google only provides a relative time that cannot be reliably converted.
- Fingerprints cannot distinguish two reviews that have the same business, reviewer, stars, and text.
- Rating-only reviews use an empty review-text component. Two rating-only reviews from the same reviewer for the same business with the same star rating therefore produce the same fingerprint, even if Google displays different dates.
- v0.1.1 has no scheduler, email, GUI, multi-business dashboard, replies, or cloud storage.

## Troubleshooting

- **No `config/business.json`:** copy the example and provide a real Google URL.
- **Browser blocked:** resolve consent/sign-in in the selected browser; stop on CAPTCHA.
- **Invalid input:** ensure the JSON root is an array, stars are `1`–`5` or `null`, and all required strings exist.
- **Unexpected duplicates:** run `pnpm review:status` and inspect `data/seen-reviews.json`.
- **Start over:** `pnpm review:reset` permanently discards local fingerprint history; use it intentionally.

## Uninstall

Remove the plugin with `codex plugin remove review-watcher`, remove its local marketplace entry if you created one, and delete the cloned repository. Delete `data/` and `reports/` only if you also want to remove local state and reports.

## Development

```bash
pnpm build
pnpm test
```

The project is licensed under the [MIT License](LICENSE).
