# Update Review Watcher with Codex

These instructions are for Codex. A user should be able to provide this file and say: `Update Review Watcher for me.` Do not require the user to run Git, PowerShell, or reinstall commands manually.

## Check the installed version

1. Locate the installed Review Watcher repository by finding its `.codex-plugin/plugin.json` and `skills/review-watcher/SKILL.md`.
2. Read `package.json` and the plugin manifest. Their versions must match.
3. Inspect the current Git commit, exact tag when present, branch, and sanitized remote.
4. From the repository root run `pnpm review:version`. It checks the public repository `https://github.com/turnaturn-LeeBug/Google-Review-Watcher` and returns the installed and latest stable versions.
5. Ignore RC, beta, alpha, and other prerelease tags unless the user explicitly requests prereleases. If the stable release check is unavailable, report the blocker rather than guessing.

## Safe update preflight

Run `pnpm review:update` without confirmation. Inspect the installation path, repository validity, installed version, branch/tag, remote, and Git status.

If tracked or unignored source changes exist, stop. Do not reset, stash, overwrite, force checkout, or continue. Explain that local source modifications need review.

Ignored user data does not make the source tree dirty. Preserve and never delete or reset:

- `config/business.json` and `config/*.local.json`
- `data/` and all review history/state
- `reports/` and `tmp/`
- `.env` and local SMTP configuration
- cookies, browser profiles, and session data stored outside Git

Do not print environment values or send credentials to GitHub. The updater uses the fixed public repository URL for release discovery and tag fetches. It never accesses or modifies Google.

## Confirmation

If the installed version already matches the latest stable release, report `Review Watcher is already up to date.` and do not reinstall.

If an update is available, show:

```text
Current version: <current>
Available version: <latest stable>
Local settings: Will be preserved
Review history: Will be preserved
Reports: Will be preserved
SMTP environment: Will be preserved
```

Ask exactly: `Update now?` Do not change versions until the user explicitly confirms.

## Apply the confirmed update

After confirmation run:

```text
pnpm review:update -- --confirm
```

The update must:

1. Fetch public tags.
2. Verify the exact target stable tag exists.
3. Check out that tag without force, reset, stash, or deletion.
4. Run `pnpm install --frozen-lockfile`.
5. Run `pnpm build`.
6. Run `pnpm test`.
7. Run `pnpm audit --audit-level moderate`.
8. Run the official Codex plugin and skill validators when available.
9. Confirm `package.json` and `.codex-plugin/plugin.json` both match the target version.

Stop at the first failed stage. Report the exact error and, when practical, the currently checked-out version. Do not claim success and do not attempt destructive automatic rollback. User configuration, state, reports, and environment settings must remain intact.

## Successful result

Report the previous version, current version, preservation status, build, tests, plugin validation, and skill validation. End with:

`Start a new Codex task if the updated plugin is not immediately rediscovered.`
