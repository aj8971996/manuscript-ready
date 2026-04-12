/**
 * Warning-key → (severity, message) table.
 *
 * Every stable key from the warning-keys contract in the handoff has a
 * literal entry below, plus the three validation-owned parse-error keys.
 *
 * unsupported-block: the engine emits keys like 'unsupported-block:ul',
 * 'unsupported-block:ol', 'unsupported-block:table'. Rather than listing
 * each tag literally, validate.ts detects the UNSUPPORTED_BLOCK_PREFIX
 * and extracts the tag into ValidationIssue.detail; the single generic
 * message below is reused for every tag. New unsupported tags added at
 * the engine automatically flow through without a messages.ts edit.
 *
 * Unknown keys (not in this table and not matching a known prefix) fall
 * through to UNKNOWN_KEY_MESSAGE in validate.ts as info severity — a
 * forgiving default so engine warning-key additions don't throw before
 * messages.ts catches up. The handoff's warning-keys contract still
 * gates new keys; this is belt-and-suspenders, not a license to skip it.
 */

import type { Severity } from './types';

export type MessageEntry = {
  severity: Severity;
  message: string;
};

export const UNSUPPORTED_BLOCK_PREFIX = 'unsupported-block:';

export const UNSUPPORTED_BLOCK_MESSAGE: MessageEntry = {
  severity: 'attention',
  message: 'An unsupported element was found and skipped. Content inside it was not included.',
};

export const UNKNOWN_KEY_MESSAGE: MessageEntry = {
  severity: 'info',
  message: 'An advisory notice was produced during parsing.',
};

export const MESSAGES: Readonly<Record<string, MessageEntry>> = {
  // Parse errors (validation-owned keys, blocker severity)
  'parse-error:empty': {
    severity: 'blocker',
    message: 'The file is empty.',
  },
  'parse-error:oversize': {
    severity: 'blocker',
    message: 'The file is larger than the supported limit.',
  },
  'parse-error:malformed': {
    severity: 'blocker',
    message: 'The file could not be parsed. It may be corrupted or in an unsupported format.',
  },

  // Metadata missing (attention — formatter degrades gracefully)
  'metadata-missing:title': {
    severity: 'attention',
    message: 'Title is missing. The manuscript header and filename will fall back to defaults.',
  },
  'metadata-missing:byline': {
    severity: 'attention',
    message: 'Byline is missing. The "by <author>" line will render without an author name.',
  },
  'metadata-missing:legalName': {
    severity: 'attention',
    message: 'Legal name is missing. The running header and filename will fall back to defaults.',
  },

  // Category detection (v5, attention — formatter degrades gracefully;
  // writer can change category or accept the mismatch and continue)
  'category-wordcount-mismatch': {
    severity: 'attention',
    message:
      "The declared category doesn't match the manuscript's word count. You can change the category or continue.",
  },

  // Mammoth passthrough
  'mammoth-error': {
    severity: 'attention',
    message: 'The DOCX parser reported an error. Some content may not have been imported correctly.',
  },
  'mammoth-warning': {
    severity: 'info',
    message: 'The DOCX parser produced an advisory notice during import.',
  },

  // Emphasis advisories (info — IR collapses cleanly, output is correct)
  'emphasis-mixed-style': {
    severity: 'info',
    message: 'Overlapping bold and italic were found. They were rendered as a single emphasis style.',
  },
  'emphasis-nested': {
    severity: 'info',
    message: 'Nested emphasis markers were found. They were flattened to a single level of emphasis.',
  },
};