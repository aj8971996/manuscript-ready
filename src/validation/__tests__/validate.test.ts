/**
 * Validation layer — commit 1: core shape.
 *
 * Three tests pin the foundational contract before the full severity table
 * lands in commit 2:
 *   1. A successful parse with no warnings → status 'ready', issues empty.
 *   2. A parser error (ParseResult.ok === false) → status 'attention' with
 *      exactly one blocker issue. Parser errors are validation-owned keys
 *      of the form 'parse-error:<kind>' — they are not engine warning keys
 *      and therefore don't appear in the warning-keys contract in the
 *      handoff. This is the only class of keys validation itself introduces.
 *   3. A single engine warning ('metadata-missing:title') → status
 *      'attention', one attention issue whose key matches the warning.
 *
 * Commit 2 will add: full severity table coverage, dedup of mammoth-warning,
 * multiple unsupported-block:<tag> as distinct issues, mixed-severity status
 * derivation, and unknown-key pass-through as info.
 *
 * Fixtures are hand-built ParseResult values rather than real parser output
 * so the tests stay hermetic — validation's contract is with the shape of
 * ParseResult, not with any particular parser's behavior.
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

describe('validate — core shape (commit 1)', () => {
  it('returns status "ready" with no issues when parse succeeded and warnings is empty', () => {
    const parseResult: ParseResult = {
      ok: true,
      manuscript: STUB_MANUSCRIPT,
      warnings: [],
    };

    const report = validate({ parseResult });

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
    const parseResult: ParseResult = {
      ok: true,
      manuscript: STUB_MANUSCRIPT,
      warnings: ['metadata-missing:title'],
    };

    const report = validate({ parseResult });

    expect(report.status).toBe('attention');
    expect(report.issues).toHaveLength(1);
    const issue = report.issues[0]!;
    expect(issue.key).toBe('metadata-missing:title');
    expect(issue.severity).toBe('attention');
    expect(typeof issue.message).toBe('string');
    expect(issue.message.length).toBeGreaterThan(0);
  });
});