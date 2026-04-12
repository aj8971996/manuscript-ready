/**
 * Warning-key → (severity, message) table.
 *
 * Commit 1 intentionally covers only the keys exercised by the initial
 * three tests:
 *   - parse-error:malformed   (validation-owned, blocker)
 *   - metadata-missing:title  (engine, attention)
 *
 * Commit 2 fills in the rest of the warning-keys contract:
 *   metadata-missing:byline, metadata-missing:legalName, emphasis-mixed-style,
 *   emphasis-nested, unsupported-block:<tag>, mammoth-warning, mammoth-error,
 *   plus parse-error:empty and parse-error:oversize.
 *
 * Keys not found in the table fall through to an info-severity pass-through
 * (commit 2 behavior; not yet needed by tests).
 *
 * Message copy is deliberately plain. UX polish lives at the app layer —
 * validation ships the stable key so consumers can swap copy without
 * re-running validation logic.
 */

import type { Severity } from './types';

export type MessageEntry = {
  severity: Severity;
  message: string;
};

export const MESSAGES: Readonly<Record<string, MessageEntry>> = {
  'parse-error:malformed': {
    severity: 'blocker',
    message: 'The file could not be parsed. It may be corrupted or in an unsupported format.',
  },
  'metadata-missing:title': {
    severity: 'attention',
    message: 'Title is missing. The manuscript header and filename will fall back to defaults.',
  },
};