# Changelog

## v0.2.1

### Added

- Added conversational version checking
- Added conversational stable updates with stable-only release detection
- Added dirty-tree protection and user-data preservation
- Added explicit confirmation before an update changes versions
- Added `UPDATE_WITH_CODEX.md` for Codex-guided updates
- Added full post-update build, test, plugin, and skill validation
- Added a Chinese conversational interface
- Added Chinese setup, settings, and review-check workflows
- Added Chinese version-check and update workflows
- Added automatic conversation-language following
- Added English and Chinese intent support without separate configuration schemas

## v0.2.0

### Added

- Conversational setup wizard
- Multi-business monitoring
- Configurable review start date
- Configurable minimum check interval
- Improved Google review identity handling
- Derived review date support
- Optional SMTP XLSX delivery
- `sendWhenNoNewReviews`
- Transaction-safe state updates
- Added Codex-guided installation instructions via `INSTALL_WITH_CODEX.md`.

### Changed

- Stable Google review IDs are preferred when available
- Business state is isolated per business
- Normal setup no longer requires manual JSON editing
- Google displayed timestamps are preserved separately from derived dates

### Security

- SMTP credentials remain environment-only
- Google interactions remain strictly read-only
- Private configuration, state, reviews, reports, cookies, sessions, and `.env` remain ignored

## v0.2.0-rc.1

- Conversational setup wizard
- Multi-business monitoring
- Configurable start date
- Configurable minimum interval
- Improved Google review identity
- Derived date handling
- Optional SMTP email reports
- Transaction-safe state updates

## v0.1.1

- Packaged the complete Codex plugin and Review Watcher skill inside the repository
- Added a fictional public review fixture and XLSX validation workflow
- Documented installation, privacy, read-only Google access, and rating-only fingerprint limitations
- Hardened ignores for local configuration, real review inputs, state, reports, cookies, and sessions
