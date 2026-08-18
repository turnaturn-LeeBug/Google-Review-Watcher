# Install Review Watcher with Codex

This document is intended for **Codex**.

If a user gives you this file and asks you to install Review Watcher, perform the installation yourself.

Do not ask the user to manually run commands unless you encounter a real permission, authentication, or environment blocker.

Repository:

`https://github.com/turnaturn-LeeBug/Google-Review-Watcher.git`

Recommended version:

`v0.2.0-rc.1`

Review Watcher is an independent open-source Codex plugin for monitoring new Google business reviews and exporting incremental XLSX reports.

---

## Goal

Install Review Watcher locally, validate it, make the Codex plugin/skill available, and then offer to run the conversational setup wizard.

A successful installation must leave the user able to say:

- `Set up Review Watcher`
- `Review Watcher settings`
- `Add another business`
- `Check my reviews`

---

# 1. Safety Rules

Before making changes:

- Do not overwrite an existing Review Watcher installation without inspecting it first.
- Do not delete user configuration, state, reports, or credentials.
- Do not modify Google accounts or Google Business data.
- Do not request Google passwords.
- Do not commit or upload private configuration.
- Never store SMTP passwords in tracked configuration.
- Prefer the latest stable or explicitly requested Review Watcher version.
- If this document specifies an RC version and a newer stable release exists, explain that before switching versions.

Google access used by Review Watcher must remain read-only.

---

# 2. Check Prerequisites

Verify that the machine has:

- Git
- Node.js
- pnpm
- Codex with plugin/skill support

Check versions using the local shell.

Recommended minimum behavior:

```bash
git --version
node --version
pnpm --version
```

If `pnpm` is unavailable but Node.js includes Corepack, try:

```bash
corepack enable
```

Then verify `pnpm` again.

If a required prerequisite cannot be installed safely without user permission, explain the blocker.

---

# 3. Choose Installation Location

Prefer a normal user-owned development/tools directory.

Examples:

Windows:

```text
%USERPROFILE%\Tools\Review-Watcher
```

or:

```text
D:\Projects\Review-Watcher
```

macOS/Linux:

```text
~/Tools/Review-Watcher
```

Do not install into a protected system directory.

If an existing Review Watcher repository is found:

1. inspect it;
2. run `git status`;
3. preserve local work;
4. do not reset or overwrite uncommitted changes.

---

# 4. Clone Review Watcher

If Review Watcher is not already installed:

```bash
git clone https://github.com/turnaturn-LeeBug/Google-Review-Watcher.git
cd Google-Review-Watcher
```

Fetch tags:

```bash
git fetch --tags
```

For this installation guide, prefer:

```bash
git checkout v0.2.0-rc.1
```

If the requested tag is unavailable, stop and report that clearly.

Do not silently install a different version.

---

# 5. Install Dependencies

From the repository root:

```bash
pnpm install --frozen-lockfile
```

If frozen installation fails because the lockfile and package metadata are inconsistent, report the problem.

Do not automatically rewrite the lockfile during a normal public installation.

---

# 6. Build and Test

Run:

```bash
pnpm build
pnpm test
```

Installation is not considered successful unless both pass.

Expected test behavior for v0.2.0-rc.1:

- all automated tests pass;
- fingerprint and stable-ID behavior pass;
- multi-business logic passes;
- eligibility logic passes;
- date parsing passes;
- setup persistence tests pass;
- email/state-safety tests pass.

Do not claim PASS if tests fail.

---

# 7. Validate the Plugin and Skill

Verify that the repository contains:

```text
.codex-plugin/plugin.json
```

and:

```text
skills/review-watcher/SKILL.md
```

Use the available official Codex plugin and skill validators if present in the environment.

Both validations must pass.

If Codex provides a supported plugin installation/discovery mechanism, use it.

Do not invent an undocumented installation command.

If no explicit registration is required and Codex can discover the repository plugin/skill directly, document the discovered path and continue.

---

# 8. Verify Public Sample Workflow

Use only the fictional sample data:

```text
fixtures/sample-reviews.json
```

Run the documented processing command from the README.

Verify:

First run:

```text
3 new reviews
```

or the current documented sample count.

Verify that an XLSX report is generated.

Run the same fixture again.

Expected:

```text
0 new reviews
```

Do not use real private reviews for installation validation.

---

# 9. Check Security and Private Files

Confirm that the repository does not track:

- `.env`
- SMTP passwords
- Google credentials
- cookies
- browser sessions
- real business configurations
- private reports
- real review datasets

Confirm that local/private paths remain gitignored.

Do not print secrets into the chat or logs.

---

# 10. SMTP Setup

Review Watcher email delivery is optional.

Do not block installation if the user does not want email.

If the user wants email reports, explain that SMTP credentials must be supplied through local environment variables.

Expected variables:

```text
REVIEW_WATCHER_SMTP_HOST
REVIEW_WATCHER_SMTP_PORT
REVIEW_WATCHER_SMTP_USER
REVIEW_WATCHER_SMTP_PASSWORD
REVIEW_WATCHER_SMTP_FROM
```

Use `.env.example` only as a template.

Never put real credentials into:

- `business.json`
- example configuration
- Git-tracked files
- README
- source code

Do not ask the user to paste a password into a public file.

---

# 11. Start Conversational Setup

After installation and validation succeed, tell the user that Review Watcher is ready.

Then offer to start configuration.

The primary user flow is conversational.

When the user says:

`Set up Review Watcher`

guide them through:

1. Google Business / Maps URL
2. Read-only business identity verification
3. Start date
4. Review-check interval
5. Email recipients or Skip
6. Configuration summary
7. Explicit Confirm / Edit
8. Persist configuration only after confirmation

The user should not need to manually edit JSON for normal setup.

---

# 12. Setup Questions

Use this sequence.

## Business URL

Ask:

`Please paste the Google Business or Google Maps URL you want Review Watcher to monitor.`

Open it read-only.

When possible, show:

- Business name
- Visible address

Ask the user to confirm the business.

Do not guess if ambiguous.

---

## Start Date

Ask:

`When should Review Watcher begin collecting reviews?`

Offer:

- Today
- Last 7 days
- Choose a date

For a custom date, persist:

```text
YYYY-MM-DD
```

---

## Check Interval

Ask:

`How often should Review Watcher check for new reviews?`

Offer:

- Daily
- Every 3 days
- Every 7 days
- Custom

Persist the value as:

```text
minimumIntervalDays
```

The custom value must be a positive whole number.

---

## Email

Ask:

`Where should Review Watcher send the XLSX report?`

Allow:

- one recipient
- multiple recipients
- Skip for now

Email remains optional.

---

## Confirmation

Before writing configuration, show:

```text
Review Watcher Setup

Business:
<business name>

Google URL:
<url>

Start collecting:
<date>

Check interval:
Every <N> days

Email:
<recipients or disabled>

Google access:
Read only
```

Then ask:

`Confirm or Edit?`

Do not persist an unconfirmed configuration.

---

# 13. Post-Install Commands / Intents

After setup, the user should be able to use natural-language intents such as:

```text
Check my reviews
```

```text
Review Watcher settings
```

```text
Add another business
```

If only one enabled business exists, `Check my reviews` should use it.

If multiple enabled businesses exist, ask whether to:

- check all;
- select one.

Respect each business's eligibility interval.

---

# 14. Installation Success Criteria

Return installation status as:

```text
REVIEW_WATCHER_INSTALL_PASS
```

only if all required items succeed:

- repository cloned or existing installation safely reused;
- intended version checked out;
- dependencies installed;
- build passed;
- tests passed;
- plugin manifest found;
- skill found;
- plugin validation passed when validator is available;
- skill validation passed when validator is available;
- public sample workflow passed;
- second sample run returned zero new reviews;
- no secrets were introduced.

Otherwise return:

```text
REVIEW_WATCHER_INSTALL_PARTIAL
```

or:

```text
REVIEW_WATCHER_INSTALL_FAIL
```

Do not hide failures.

---

# 15. Final Installation Report

Return:

## STATUS

PASS / PARTIAL / FAIL

## VERSION

Installed Review Watcher version.

## INSTALL PATH

Local repository path.

## GIT

Branch/tag and HEAD.

## DEPENDENCIES

Git / Node / pnpm versions.

## BUILD

PASS / FAIL.

## TESTS

Passed test count.

## PLUGIN

Manifest path and validation status.

## SKILL

Skill path and validation status.

## SAMPLE FIRST RUN

New-review count.

## SAMPLE SECOND RUN

Must be zero for PASS.

## XLSX

Generated sample XLSX path.

## SECURITY

Whether private data or secrets were detected.

## EMAIL

Configured / Not configured.

## SETUP

Ready / Completed / Not completed.

## NEXT ACTION

Normally:

`Set up Review Watcher`

Do not begin monitoring a real business until the user completes and confirms setup.