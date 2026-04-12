/**
 * Validation layer — commits 1 + 2.
 *
 * Commit 1 (first three tests): pinned the core shape — ready/attention
 * status, issue structure, parse-error handling, single-warning lookup.
 *
 * Commit 2 (remaining tests): locks down the full severity table, dedup
 * rules, prefix matching for unsupported-block:<tag>, and unknown-key
 * pass-through as info.
 *
 * Severity table (from the warning-keys contract in the handoff):
 *   parse-error:empty / :oversize / :malformed  → blocker
 *   metadata-missing:title / :byline / :legalName → attention
 *   unsupported-block:<tag>                     → attention (tag in detail)
 *   mammoth-error                               → attention
 *   emphasis-mixed-style / emphasis-nested      → info
 *   mammoth-warning                             → info
 *   <unknown key>                               → info (pass-through)
 *
 * Dedup: mammoth-warning and mammoth-error are NOT deduped at the engine
 * (per their entry in the warning-keys contract). Validation collapses
 * repeats to one issue per key.
 *
 * unsupported-block: the engine already dedupes per-tag, so validation
 * preserves each distinct tag as a distinct issue without extra dedup.
 */

import { validate } from '../validate';
import type { ParseResult } from '../../engine/parsers';
import type { ProseManuscript } from '../../engine/ir/prose';

const STUB_MANUSCRIPT: ProseManuscript = {
  schemaVersion: 1,
  metadata: {
    title: 'Stub',
    byline: 'Stub Author',
    legalName: 'Stub Author',
    contact: { mode: 'freetext', text: 'Contact information not provided' },
  },
  body: [
    { type: 'paragraph', runs: [{ type: 'text', text: 'Body.' }] },
  ],
};

const okWith = (warnings: string[]): ParseResult => ({
  ok: true,
  manuscript: STUB_MANUSCRIPT,
  warnings,
});

describe('validate — core shape (commit 1)', () => {
  it('returns status "ready" with no issues when parse succeeded and warnings is empty', () => {
    const report = validate({ parseResult: okWith([]) });
    expect(report.status).toBe('ready');
    expect(report.issues).toEqual([]);
  });

  it('returns status "attention" with one blocker issue when parse failed', () => {
    const parseResult: ParseResult = {
      ok: false,
      error: { kind: 'malformed', message: 'Failed to parse DOCX content.' },
    };
    const report = validate({ parseResult });
    expect(report.status).toBe('attention');
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue.severity).toBe('blocker');
    expect(issue.key).toBe('parse-error:malformed');
    expect(typeof issue.message).toBe('string');
    expect(issue.message.length).toBeGreaterThan(0);
  });

  it('maps a metadata-missing:title warning to a single attention issue', () => {
    const report = validate({ parseResult: okWith(['metadata-missing:title']) });
    expect(report.status).toBe('attention');
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue.key).toBe('metadata-missing:title');
    expect(issue.severity).toBe('attention');
    expect(typeof issue.message).toBe('string');
    expect(issue.message.length).toBeGreaterThan(0);
  });
});

describe('validate — full severity table (commit 2)', () => {
  it.each([
    ['empty', 'blocker'],
    ['oversize', 'blocker'],
    ['malformed', 'blocker'],
  ] as const)('maps parse error kind %s to severity %s', (kind, severity) => {
    const parseResult: ParseResult = {
      ok: false,
      error: { kind, message: `stub ${kind} message` },
    };
    const report = validate({ parseResult });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]!.severity).toBe(severity);
    expect(report.issues[0]!.key).toBe(`parse-error:${kind}`);
  });

  it.each([
    ['metadata-missing:title', 'attention'],
    ['metadata-missing:byline', 'attention'],
    ['metadata-missing:legalName', 'attention'],
    ['mammoth-error', 'attention'],
    ['emphasis-mixed-style', 'info'],
    ['emphasis-nested', 'info'],
    ['mammoth-warning', 'info'],
  ])('maps warning key %s to severity %s', (key, severity) => {
    const report = validate({ parseResult: okWith([key]) });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]!.key).toBe(key);
    expect(report.issues[0]!.severity).toBe(severity);
  });
});

describe('validate — unsupported-block prefix matching (commit 2)', () => {
  it('maps a single unsupported-block:<tag> key to an attention issue with tag in detail', () => {
    const report = validate({ parseResult: okWith(['unsupported-block:ul']) });
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue.key).toBe('unsupported-block:ul');
    expect(issue.severity).toBe('attention');
    expect(issue.detail).toBe('ul');
    expect(issue.message.length).toBeGreaterThan(0);
  });

  it('preserves distinct unsupported-block tags as distinct issues', () => {
    const report = validate({
      parseResult: okWith([
        'unsupported-block:ul',
        'unsupported-block:ol',
        'unsupported-block:table',
      ]),
    });
    expect(report.issues).toHaveLength(3);
    const details = report.issues.map((i) => i.detail).sort();
    expect(details).toEqual(['ol', 'table', 'ul']);
    for (const issue of report.issues) {
      expect(issue.severity).toBe('attention');
    }
  });
});

describe('validate — dedup (commit 2)', () => {
  it('collapses repeated mammoth-warning keys into a single info issue', () => {
    const report = validate({
      parseResult: okWith(['mammoth-warning', 'mammoth-warning', 'mammoth-warning']),
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]!.key).toBe('mammoth-warning');
    expect(report.issues[0]!.severity).toBe('info');
  });

  it('collapses repeated mammoth-error keys into a single attention issue', () => {
    const report = validate({
      parseResult: okWith(['mammoth-error', 'mammoth-error']),
    });
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]!.key).toBe('mammoth-error');
    expect(report.issues[0]!.severity).toBe('attention');
  });
});

describe('validate — unknown keys and status derivation (commit 2)', () => {
  it('passes unknown keys through as info-severity issues with a generic message', () => {
    const report = validate({ parseResult: okWith(['some-future-key']) });
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue.key).toBe('some-future-key');
    expect(issue.severity).toBe('info');
    expect(issue.message.length).toBeGreaterThan(0);
  });

  it('keeps status "ready" when all issues are info-only', () => {
    const report = validate({
      parseResult: okWith(['emphasis-mixed-style', 'mammoth-warning']),
    });
    expect(report.status).toBe('ready');
    expect(report.issues).toHaveLength(2);
  });

  it('flips status to "attention" when any issue is attention or blocker', () => {
    const report = validate({
      parseResult: okWith([
        'mammoth-warning',
        'metadata-missing:title',
        'emphasis-nested',
      ]),
    });
    expect(report.status).toBe('attention');
    expect(report.issues).toHaveLength(3);
  });
});