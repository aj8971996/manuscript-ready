# Changelog

All notable changes to ManuscriptReady are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-18

First testable build. Covers import, library, detail, metadata editing, and review-and-export flows for fiction manuscripts in Shunn short-story format, persisted locally with no network dependency.

### Added

- **Manuscript import from `.docx` and `.txt`.** Pick a file via the document picker or paste text directly. The import flow parses content, counts words, detects scene and chapter breaks, derives a category from word count, and persists the result alongside any parser warnings for later review. (`7b7e29f`, `64df02d`, `53a47e8`, `07d894d`)
- **Library of imported manuscripts.** Backed by a local SQLite store. Hydrates on mount and renders a row for every saved manuscript; shows an empty state otherwise. Nothing ever leaves the device. (`95c87b0`, `7cfacbf`, `177a57d`, `a90ecc2`)
- **Manuscript detail screen.** Tap a library row to open the full view, loaded via a pure load-by-id path that keeps the screen itself free of side effects. (`7372063`, `ff8ea2c`)
- **Metadata editor with tabbed identity and contact layout.** Identity tab covers author name, legal name, and byline. Contact tab accepts either structured fields (address, phone, email) with format validation, or freetext as a fallback. Saves reconcile parser warnings against the updated manuscript state so nothing is lost on round-trip. (`18654fa`, `65b2260`, `414097d`, `665f983`, `9bdc24a`)
- **Review and export screen.** Severity-grouped issue list — blocker, attention, info — with a bottom-sheet issue-detail view. Ready for export when there are no blockers. (`24a24c8`, `1a8e194`, `23279ba`)
- **UI primitive library and Screen wrapper.** Seven reusable components — Card, Pill, Button (with fullWidth variant), EmptyState, SectionHeader, ManuscriptRow, SeveritySection — on top of a Screen wrapper built on `react-native-safe-area-context`. (`8363bd6`, `4f0ee83`)

### Changed

- **Replaced the DOCX reader with an fflate-based implementation.** The original mammoth-backed reader relied on Node APIs unavailable in the Hermes runtime on device. The replacement reads DOCX files directly as ZIP archives and tokenizes the embedded HTML without Node shims. (`c39e84a`)
- **Refreshed app branding.** New launcher icon and new cold-start splash screen, both decomposed from a transparent-background master and wired to mode-specific backgrounds (`#1e3a6f` dark, `#B8C4D9` light) for flicker-free cold-start transitions. (`40dff6e`, `8de0f64`)
- **Cross-screen design pass.** Consistency pass across Library, Detail, Review & Export, Import, and Metadata screens: unified spacing, typography, and disabled-state treatment; Library footer Import button promoted to primary. (`28ef689`, `bbdcca4`, `39378ff`)
- **Android package id and launcher name locked.** Canonical identifiers set ahead of Play Store submission. (`f0ba692`)

### Fixed

- **Hermes runtime compatibility for DOCX parsing.** Alongside the reader swap above, a targeted Buffer polyfill keeps remaining legacy code paths from crashing on device. (`2341ef9`)
- **NativeWind navigation-context race on dark-mode class.** Dropped the dynamic dark-mode class derivation that occasionally threw during navigation transitions; theme resolution now happens upstream of the component tree. (`1aa3606`)

### Removed

- **Mammoth and its Hermes workarounds.** The fflate-based reader made the original workarounds dead weight; both are gone. (`ac17bfd`)

[0.2.0]: https://github.com/OWNER/manuscript-ready/releases/tag/v0.2.0