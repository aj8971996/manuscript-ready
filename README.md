# ManuscriptReady

Mobile-first utility that takes a fiction writer's draft (`.docx`, `.txt`, or pasted text) and exports it in industry-standard manuscript formats. Enter your metadata once, export a submission-ready `.docx` and PDF.

**Status:** pre-alpha. Environment setup complete, no product code yet.

## Why

Unpublished and early-career fiction writers draft wherever they draft (Google Docs, Word, Scrivener, notes apps) and then have to wrestle their work into "Shunn format" or similar before submitting to magazines and agents. ManuscriptReady does the wrestling in one tap, on the device they already have in their pocket.

## Principles

1. **No data theft.** Manuscripts never leave the device. All parsing, formatting, and export happen client-side. No uploads, no cloud, no telemetry on content.
2. **Honest monetization.** Revenue comes from AdMob banners on non-editor screens, one optional rewarded ad, and a single one-time ~$4.99 IAP to remove ads. No subscriptions, no accounts, no data brokering.
3. **Real value to a specific niche.** Every feature answers "does this help a writer submit more easily?"
4. **Test on real hardware.** Every change is verified on a physical device before it's considered working.
5. **Maintainable and observable from day one.** Clean structure, strict TypeScript, linting, and version control are enforced from the first commit, not bolted on later.

## Formats (planned)

- **v1:** Shunn short story, Shunn novel
- **Later:** stage play, screenplay, television, musical

## Tech Stack

- Expo (managed React Native), SDK 55, New Architecture
- TypeScript (strict)
- ESLint (flat config via `eslint-config-expo`) + Prettier
- EAS Build + EAS Submit for Play Store delivery
- Planned libraries: `docx`, `mammoth`, `expo-document-picker`, `expo-file-system`, `expo-sharing`, `react-native-google-mobile-ads`

## Development

\`\`\`bash
npm install
npm run start      # Metro dev server, scan QR with Expo Go
npm run lint       # ESLint
npm run format     # Prettier (writes)
npm run typecheck  # TypeScript, no emit
\`\`\`

Tested on: Samsung Galaxy S25 Ultra (Android 16, One UI 8) via Expo Go.

## License

MIT, see [LICENSE](./LICENSE).