/**
 * Validation entry point.
 *
 * Read-only consumer of ParseResult. Does not import from anywhere under
 * src/engine except via the parsers barrel and the IR types — engine
 * internals are off-limits per the purity rule.
 *
 * Processing order for each warning key from parseResult.warnings:
 *   1. If the key starts with UNSUPPORTED_BLOCK_PREFIX, extract the tag
 *      into detail and emit an attention issue. Each distinct tag becomes
 *      its own issue (engine already dedupes per-tag).
 *   2. Otherwise, look up the key in MESSAGES. If found, emit an issue
 *      with that entry's severity and message.
 *   3. Otherwise, pass through as UNKNOWN_KEY_MESSAGE (info severity).
 *
 * Dedup: mammoth-warning and mammoth-error are explicitly not deduped at
 * the engine. Validation collapses repeats of the same key to one issue.
 * Dedup is keyed on the exact warning string, so 'unsupported-block:ul'
 * and 'unsupported-block:ol' remain distinct. Parse errors naturally
 * produce only one issue so dedup doesn't apply to them.
 *
 * Status derivation: any blocker or attention issue flips status to
 * 'attention'; otherwise 'ready'. Info-only reports are 'ready'.
 */

import type { ParseResult } from '../engine/parsers';
import {
  MESSAGES,
  UNKNOWN_KEY_MESSAGE,
  UNSUPPORTED_BLOCK_MESSAGE,
  UNSUPPORTED_BLOCK_PREFIX,
} from './messages';
import type { ValidationIssue, ValidationReport } from './types';

export type ValidateInput = {
  parseResult: ParseResult;
};

export function validate(input: ValidateInput): ValidationReport {
  const { parseResult } = input;

  if (!parseResult.ok) {
    const key = `parse-error:${parseResult.error.kind}`;
    const entry = MESSAGES[key] ?? {
      severity: 'blocker' as const,
      message: 'The file could not be parsed.',
    };
    const issues: ValidationIssue[] = [
      { key, severity: entry.severity, message: entry.message },
    ];
    return { status: 'attention', issues };
  }

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const warningKey of parseResult.warnings) {
    if (seen.has(warningKey)) continue;
    seen.add(warningKey);

    if (warningKey.startsWith(UNSUPPORTED_BLOCK_PREFIX)) {
      const tag = warningKey.slice(UNSUPPORTED_BLOCK_PREFIX.length);
      issues.push({
        key: warningKey,
        severity: UNSUPPORTED_BLOCK_MESSAGE.severity,
        message: UNSUPPORTED_BLOCK_MESSAGE.message,
        detail: tag,
      });
      continue;
    }

    const entry = MESSAGES[warningKey] ?? UNKNOWN_KEY_MESSAGE;
    issues.push({
      key: warningKey,
      severity: entry.severity,
      message: entry.message,
    });
  }

  const status = issues.some(
    (i) => i.severity === 'blocker' || i.severity === 'attention',
  )
    ? 'attention'
    : 'ready';

  return { status, issues };
}