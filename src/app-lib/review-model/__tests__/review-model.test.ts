import { buildReviewModel, groupIssuesBySeverity } from '../review-model';
import type { PersistedManuscriptRow } from '../../persistence/types';
import type { ValidationIssue } from '../../../validation/types';

const MINIMAL_IR_JSON = JSON.stringify({ metadata: {}, body: [] });

function makeRow(overrides: Partial<PersistedManuscriptRow> = {}): PersistedManuscriptRow {
  return {
    id: 'm-1',
    schemaVersion: 1,
    title: 'Untitled',
    category: 'short-story',
    createdAt: 0,
    irJson: MINIMAL_IR_JSON,
    warnings: [],
    ...overrides,
  };
}

function issue(severity: ValidationIssue['severity'], key: string): ValidationIssue {
  return { key, severity, message: `msg for ${key}` };
}

describe('groupIssuesBySeverity', () => {
  it('returns three empty buckets for an empty input', () => {
    const result = groupIssuesBySeverity([]);
    expect(result.blockers).toEqual([]);
    expect(result.attentions).toEqual([]);
    expect(result.infos).toEqual([]);
  });

  it('routes each severity to its own bucket', () => {
    const issues = [
      issue('blocker', 'b1'),
      issue('attention', 'a1'),
      issue('info', 'i1'),
    ];
    const result = groupIssuesBySeverity(issues);
    expect(result.blockers).toEqual([issues[0]]);
    expect(result.attentions).toEqual([issues[1]]);
    expect(result.infos).toEqual([issues[2]]);
  });

  it('preserves relative order within each bucket', () => {
    const issues = [
      issue('attention', 'a1'),
      issue('info', 'i1'),
      issue('attention', 'a2'),
      issue('blocker', 'b1'),
      issue('info', 'i2'),
      issue('blocker', 'b2'),
    ];
    const result = groupIssuesBySeverity(issues);
    expect(result.blockers.map((i) => i.key)).toEqual(['b1', 'b2']);
    expect(result.attentions.map((i) => i.key)).toEqual(['a1', 'a2']);
    expect(result.infos.map((i) => i.key)).toEqual(['i1', 'i2']);
  });
});

describe('buildReviewModel', () => {
  it('returns ready status with empty buckets when warnings is empty', () => {
    const model = buildReviewModel(makeRow({ warnings: [] }));
    expect(model.status).toBe('ready');
    expect(model.blockers).toEqual([]);
    expect(model.attentions).toEqual([]);
    expect(model.infos).toEqual([]);
  });

  it('routes a single attention-severity warning into the attentions bucket and flips status', () => {
    const model = buildReviewModel(makeRow({ warnings: ['metadata-missing:title'] }));
    expect(model.status).toBe('attention');
    expect(model.blockers).toEqual([]);
    expect(model.attentions).toEqual([
      expect.objectContaining({
        key: 'metadata-missing:title',
        severity: 'attention',
      }),
    ]);
    expect(model.infos).toEqual([]);
  });

  it('groups mixed-severity warnings into their respective buckets with passthrough status', () => {
    const model = buildReviewModel(
      makeRow({ warnings: ['metadata-missing:title', 'emphasis-nested'] }),
    );
    expect(model.status).toBe('attention');
    expect(model.attentions.map((i) => i.key)).toEqual(['metadata-missing:title']);
    expect(model.infos.map((i) => i.key)).toEqual(['emphasis-nested']);
  });

  it('keeps status ready when all warnings are info-severity only', () => {
    const model = buildReviewModel(
      makeRow({ warnings: ['emphasis-nested', 'emphasis-mixed-style'] }),
    );
    expect(model.status).toBe('ready');
    expect(model.attentions).toEqual([]);
    expect(model.infos).toHaveLength(2);
  });

  it('throws when irJson is not valid JSON', () => {
    expect(() => buildReviewModel(makeRow({ irJson: '{not-json' }))).toThrow();
  });
});