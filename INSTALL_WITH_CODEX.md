# Install Review Watcher with Codex

These instructions are for Codex. The user should be able to provide this file and say: `Install Review Watcher for me.`

Install the stable `v0.2.1` release safely. Report every command result and stop on a real blocker; never fabricate installation, validation, or discovery success.

## 1. Inspect before changing anything

1. Confirm that Git, Node.js, pnpm, and Codex are available:

   ```text
   git --version
   node --version
   pnpm --version
   codex --version
   ```

   Require Node.js 20 or newer and pnpm 10 or newer. If Codex is the desktop app and its CLI is unavailable, confirm that the app supports local plugins and skills instead of treating the missing CLI command as success.
2. Choose an installation directory appropriate for the user's Codex environment. Before cloning, resolve the exact target path and inspect it.
3. If Review Watcher already exists, do not overwrite, reset, delete, or replace it. Inspect its Git status, version, remote, and local artifacts first. Preserve `config/business.json`, `config/*.local.json`, `data/`, `reports/`, `tmp/`, `.env`, cookies, sessions, and browser data. Prefer a fresh adjacent clone for validation, and ask before migrating or replacing an existing installation.

## 2. Clone and select the exact stable release

Clone the public repository into the inspected empty target directory:

```text
git clone https://github.com/turnaturn-LeeBug/Google-Review-Watcher.git
cd Google-Review-Watcher
git fetch --tags --force
git show-ref --verify refs/tags/v0.2.1
git checkout --detach v0.2.1
git describe --tags --exact-match
```

The final command must report `v0.2.1`. Do not silently install another branch, tag, prerelease, or version if `v0.2.1` is missing or cannot be verified. Report the blocker and stop.

## 3. Install and validate

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm audit --audit-level moderate
```

Require every command to pass. Confirm that these release files exist inside the cloned repository:

```text
.codex-plugin/plugin.json
skills/review-watcher/SKILL.md
fixtures/sample-reviews.json
```

Read `package.json` and `.codex-plugin/plugin.json`; both versions must be exactly `0.2.1`. Confirm the manifest's skills path resolves to `skills/review-watcher/SKILL.md` without leaving the repository.

When the official Codex plugin and skill validators are available in the environment, run them against the repository root and `skills/review-watcher` respectively. Use the official validators rather than inventing substitute checks. If they are unavailable, report that limitation explicitly.

Make the verified repository available through the current Codex local-plugin installation or marketplace workflow for the user's environment. Use Codex's supported plugin management UI or CLI when available, keep the whole repository together, and start a new Codex task after installation so plugin and skill discovery are refreshed. Do not hand-edit an existing marketplace or plugin registry unless the user has approved that environment-specific change.

## 4. Verify the fictional fixture

Only use the public fictional fixture for installation testing. On a fresh validation clone, run:

```text
pnpm review:process fixtures/sample-reviews.json
```

Verify that the first run reports new reviews and creates a non-empty XLSX file under `reports/`. Then run the same command again:

```text
pnpm review:process fixtures/sample-reviews.json
```

The second run must report exactly `0 new reviews`. Do not use or commit a real business configuration, real review input, state, or report for this installation test.

## 5. Security and privacy checks

Before declaring success:

- Confirm no secrets, API keys, SMTP passwords, `.env`, Google account data, cookies, browser sessions, real business configuration, private reviews, or generated reports were introduced into tracked files.
- Never request a Google password. Google interaction must remain strictly read-only: never reply, react, report, post, edit, delete, or change business information.
- Never commit SMTP credentials. Email is optional and remains disabled unless the user chooses it.
- Keep user configuration, state, reports, and other ignored local artifacts intact.

Optional SMTP delivery reads credentials only from the local environment:

```text
REVIEW_WATCHER_SMTP_HOST
REVIEW_WATCHER_SMTP_PORT
REVIEW_WATCHER_SMTP_USER
REVIEW_WATCHER_SMTP_PASSWORD
REVIEW_WATCHER_SMTP_FROM
```

Do not put real values for these variables in tracked files or business configuration.

## 6. Start conversational setup

After installation and discovery succeed, tell the user that normal setup does not require manual JSON editing. Start by asking for the Google Business or Google Maps URL according to the Review Watcher skill, or tell the user they can say:

- `Set up Review Watcher`
- `Review Watcher settings`
- `Add another business`
- `Check my reviews`

Do not persist setup until the user confirms the displayed business identity and final settings summary. If any installation, validation, discovery, security, or setup step is blocked, report the exact blocker instead of claiming success.
