/**
 * Validation entry point.
 *
 * Read-only consumer of ParseResult. Does not import from anywhere under
 * src/engine except via the parsers barrel and the IR types — engine
 * internals are off-limits per the purity rule.
 *
 * Commit 1 scope: handle the ok:false path (parse errors → blocker issue)
 * and straightforward key lookup for warnings. Status derivation is the
 * "any blocker or attention flips to attention, else ready" rule.
 *
 * Commit 2 will add: dedup (mammoth-warning), pass-through for unknown
 * keys as info, unsupported-block:<tag> prefix matching with tag detail,
 * and the rest of the severity table.
 */

import type { ParseResult } from '../engine/parsers';
import { MESSAGES } from './messages';
import type { ValidationIssue, ValidationReport } from './types';

export type ValidateInput = {
  parseResult: ParseResult;
};

export function validate(input: ValidateInput): ValidationReport {
  const { parseResult } = input;
  const issues: ValidationIssue[] = [];

  if (!parseResult.ok) {
    const key = `parse-error:${parseResult.error.kind}`;
    const entry = MESSAGES[key];
    // Commit 1 tests only exercise 'malformed'. If a kind lands here
    // without a MESSAGES entry, commit 2's pass-through path will cover
    // it; for now we fall back to a blocker with a generic message so
    // the shape of ValidationReport is always well-formed.
    issues.push({
      key,
      severity: entry?.severity ?? 'blocker',
      message: entry?.message ?? 'The file could not be parsed.',
    });
    return { status: 'attention', issues };
  }

  for (const warningKey of parseResult.warnings) {
    const entry = MESSAGES[warningKey];
    if (entry === undefined) {
      // Commit 2 will formalize unknown-key pass-through as info with a
      // generic message. For commit 1 we simply skip so we don't emit
      // surprise attention-severity issues before the full table lands.
      continue;
    }
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