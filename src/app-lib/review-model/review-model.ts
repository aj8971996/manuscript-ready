/**
 * ReviewModel — UI-shaped projection of a persisted manuscript's
 * validation state.
 *
 * Pipeline: PersistedManuscriptRow → parse irJson → synthesize ParseResult
 * (with persisted warnings, no DOCX re-parse) → validate → group by
 * severity. Commit 14's warnings round-trip is what makes this work
 * without re-reading the original file bytes.
 *
 * The synthesized ParseResult is always { ok: true } because we are
 * reading a row that was successfully parsed and persisted — parse
 * failures on the original DOCX would have prevented insertion.
 * Consequently, blocker-severity issues are unreachable through this
 * pipeline today (every blocker key in messages.ts is a parse-error:*).
 * The grouping helper still has a 'blockers' bucket so the UI can render
 * its three fixed sections (per ADR §4) without special-casing, and the
 * CTA gating logic remains correct if a future warning key is ever
 * promoted to blocker severity. The blocker bucket is exercised by
 * groupIssuesBySeverity tests with synthetic issue arrays.
 *
 * Corrupt stored IR (irJson that fails JSON.parse) is treated as a
 * thrown error, not a synthetic blocker — synthesizing a fake
 * validation key would require touching messages.ts, which is forbidden
 * by the validation purity rule. Consumers (the Review screen) are
 * responsible for catching and rendering a load-failure state.
 *
 * App-layer purity: pure logic, no RN imports, lives in app-pure.
 * Imports validation (allowed: app-layer can read from validation;
 * reverse is forbidden).
 */

import type { ParseResult } from '../../engine/parsers';
import type { ProseManuscript } from '../../engine/ir/prose';
import type { PersistedManuscriptRow } from '../persistence/types';
import { validate } from '../../validation/validate';
import type { ValidationIssue, ValidationReport } from '../../validation/types';

export type ReviewModel = {
  status: ValidationReport['status'];
  blockers: ReadonlyArray<ValidationIssue>;
  attentions: ReadonlyArray<ValidationIssue>;
  infos: ReadonlyArray<ValidationIssue>;
};

/**
 * Pure: split a flat issue list into the three severity buckets,
 * preserving relative order within each bucket.
 *
 * Exposed for testability — buildReviewModel composes this. Direct
 * tests against this entry point are how the blocker bucket gets
 * exercised today (see module doc comment).
 */
export function groupIssuesBySeverity(
  issues: ReadonlyArray<ValidationIssue>,
): {
  blockers: ReadonlyArray<ValidationIssue>;
  attentions: ReadonlyArray<ValidationIssue>;
  infos: ReadonlyArray<ValidationIssue>;
} {
  const blockers: ValidationIssue[] = [];
  const attentions: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];
  for (const issue of issues) {
    if (issue.severity === 'blocker') blockers.push(issue);
    else if (issue.severity === 'attention') attentions.push(issue);
    else infos.push(issue);
  }
  return { blockers, attentions, infos };
}

/**
 * Build the UI-shaped review projection for a persisted manuscript row.
 *
 * Throws if irJson is not valid JSON. Does NOT throw on validation
 * paths; validate always returns a report.
 */
export function buildReviewModel(row: PersistedManuscriptRow): ReviewModel {
  const manuscript = JSON.parse(row.irJson) as ProseManuscript;
  const parseResult: ParseResult = {
    ok: true,
    manuscript,
    warnings: [...row.warnings],
    };
  const report = validate({ parseResult });
  const groups = groupIssuesBySeverity(report.issues);
  return {
    status: report.status,
    blockers: groups.blockers,
    attentions: groups.attentions,
    infos: groups.infos,
  };
}