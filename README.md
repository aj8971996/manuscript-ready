# ManuscriptReady

Mobile-first utility that takes a fiction writer's draft (`.docx`, `.txt`, or pasted text) and exports it in industry-standard manuscript formats. Enter your metadata once, export a submission-ready `.docx` and PDF.

**Status:** closed testing on Google Play (Android). v0.2.0 covers import, library, metadata editing, and review of Shunn short-story format. See [CHANGELOG](./CHANGELOG.md).

## Why

Unpublished and early-career writers draft wherever they draft (Google Docs, Word, Scrivener, notes apps) and then have to wrestle their work into "Shunn format" or similar before submitting to magazines and agents. ManuscriptReady does the wrestling in one tap, on the device they already have in their pocket.

## Principles

1. **No data theft.** Manuscripts never leave the device. All parsing, formatting, and export happen client-side. No uploads, no cloud, no telemetry on content.
2. **Honest monetization.** Revenue comes from AdMob banners on non-editor screens, one optional rewarded ad, and a single one-time ~$4.99 IAP to remove ads. No subscriptions, no accounts, no data brokering.
3. **Real value to a specific niche.** Every feature answers "does this help a writer submit more easily?"
4. **Test on real hardware.** Every change is verified on a physical device before it's considered working.
5. **Maintainable and observable from day one.** Clean structure, strict TypeScript, linting, layer-purity enforcement, and version control are enforced from the first commit, not bolted on later.

## Features (v0.2.0)

- **Import** from `.docx`, `.txt`, or pasted text. Scene and chapter detection, word-count-based category inference, parser warnings surfaced for review.
- **Library** of imported manuscripts, persisted locally via SQLite. Nothing leaves the device.
- **Metadata editor** with tabbed identity and contact layout. Identity: author, legal name, byline. Contact: structured (address, phone, email) with format validation, or freetext fallback.
- **Review and export.** Severity-grouped issue list (blocker / attention / info) with a bottom-sheet issue-detail view. Export gated on zero blockers.
- **Shunn short-story formatter.** First supported format.

## Roadmap

- Shunn novel format
- Longer-form categories: stage play, screenplay, television, musical

## Tech Stack

- Expo (managed React Native), New Architecture, prebuild flow with dev client for on-device iteration
- TypeScript strict mode
- State: `zustand` slices
- Navigation: Expo Router
- UI: NativeWind (Tailwind), Feather icons, `@gorhom/bottom-sheet`
- Persistence: `expo-sqlite`
- DOCX: `fflate` (ZIP reader) for Hermes runtime compatibility
- Testing: Jest, four project buckets (see below)
- Linting / formatting: ESLint (flat config via `eslint-config-expo`) + Prettier

## Project layout

The codebase separates concerns by purity layer, with each layer's tests admitting only files from that layer:

- `src/engine/` — format parsers, detectors, formatters. Pure functions, no React, no I/O.
- `src/validation/` — manuscript validation rules and severity mapping. Pure.
- `src/app-lib/` — app-layer pure logic: state slices, adapters, mapping layers, format validators. No React rendering.
- `app/` and `src/app-lib/ui/` — React Native screens and primitive components.

See [`docs/adr/`](./docs/adr/) for architecture decision records.

## Development

```
npm install
npx expo prebuild --platform android --clean   # first-time, or after native config changes
npx expo run:android                           # build and install to a connected device
npm run typecheck                              # TypeScript, no emit
npm run lint                                   # ESLint
npm run format                                 # Prettier (writes)
```

## Testing

Four buckets, aligned with the purity layers above:

```
npm run test:engine       # parsers, formatters, detectors
npm run test:validation   # severity mapping, validation rules
npm run test:app-pure     # pure app-layer logic
npm run test:app-rn       # React Native components under jest-expo
```

Tested on: Samsung Galaxy S25 Ultra (Android 16, One UI 8).

## License

MIT, see [LICENSE](./LICENSE).