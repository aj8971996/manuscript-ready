import { DERIVABLE_KEYS, reconcileWarnings } from '../reconcile-warnings';
import type {
  ContactBlock,
  Metadata,
  ProseBlock,
  ProseManuscript,
} from '../../../engine/ir/prose';

const MINIMAL_CONTACT: ContactBlock = {
  mode: 'structured',
  name: '',
  street: '',
  city: '',
  region: '',
  postalCode: '',
  email: '',
};

function makeMetadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    title: 'A Title',
    byline: 'A Byline',
    legalName: 'A Legal Name',
    contact: MINIMAL_CONTACT,
    ...overrides,
  };
}

// Build a single-paragraph body with `n` whitespace-separated tokens.
// Drives category-from-wordcount predicate cases without hand-crafting
// multi-thousand-word fixtures.
function bodyOfWordCount(n: number): ProseBlock[] {
  if (n === 0) return [];
  const text = Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  return [{ type: 'paragraph', runs: [{ type: 'text', text }] }];
}

function makeManuscript(
  metadataOverrides: Partial<Metadata> = {},
  body: ProseBlock[] = [],
): ProseManuscript {
  return {
    schemaVersion: 1,
    metadata: makeMetadata(metadataOverrides),
    body,
  };
}

describe('reconcileWarnings', () => {
  // Locks the exported tuple shape. A reorder here silently changes the
  // output ordering of fresh derivable keys, so this guard is cheap.
  it('DERIVABLE_KEYS is exactly the four known recomputable keys in locked order', () => {
    expect([...DERIVABLE_KEYS]).toEqual([
      'metadata-missing:title',
      'metadata-missing:byline',
      'metadata-missing:legalName',
      'category-wordcount-mismatch',
    ]);
  });

  it('returns [] for empty oldWarnings + fully-populated IR with matching category', () => {
    const ms = makeManuscript({}, bodyOfWordCount(1000));
    const result = reconcileWarnings([], ms, 'short-story');
    expect(result).toEqual([]);
  });

  it('DOCX first-save: empty oldWarnings + empty metadata + empty body emits the three metadata-missing keys in DERIVABLE_KEYS order', () => {
    // Empty body -> 0 words -> categoryFromWordCount returns 'short-story',
    // which matches newCategory, so no mismatch key fires. Locks #55 behavior.
    const ms = makeManuscript(
      { title: '', byline: '', legalName: '' },
      [],
    );
    const result = reconcileWarnings([], ms, 'short-story');
    expect(result).toEqual([
      'metadata-missing:title',
      'metadata-missing:byline',
      'metadata-missing:legalName',
    ]);
  });

  it('drops stale metadata-missing:title when IR now has the title', () => {
    const ms = makeManuscript(
      { title: 'Now Has A Title' },
      bodyOfWordCount(500),
    );
    const result = reconcileWarnings(['metadata-missing:title'], ms, 'short-story');
    expect(result).toEqual([]);
  });

  it('drops stale category-wordcount-mismatch when wordcount now matches newCategory', () => {
    // 500 words -> short-story band; newCategory matches.
    const ms = makeManuscript({}, bodyOfWordCount(500));
    const result = reconcileWarnings(
      ['category-wordcount-mismatch'],
      ms,
      'short-story',
    );
    expect(result).toEqual([]);
  });

  it('emits fresh category-wordcount-mismatch when wordcount disagrees with newCategory', () => {
    // 8000 words -> novelette band; newCategory short-story -> mismatch.
    const ms = makeManuscript({}, bodyOfWordCount(8000));
    const result = reconcileWarnings([], ms, 'short-story');
    expect(result).toEqual(['category-wordcount-mismatch']);
  });

  it('preserves non-derivable keys verbatim in first-seen order', () => {
    const ms = makeManuscript({}, bodyOfWordCount(500));
    const input = [
      'unsupported-block:table',
      'mammoth-warning',
      'some-unknown-key',
    ];
    const result = reconcileWarnings(input, ms, 'short-story');
    expect(result).toEqual(input);
  });

  it('collapses duplicate derivable keys to a single key in output', () => {
    const ms = makeManuscript({ title: '' }, bodyOfWordCount(500));
    const result = reconcileWarnings(
      ['metadata-missing:title', 'metadata-missing:title'],
      ms,
      'short-story',
    );
    expect(result).toEqual(['metadata-missing:title']);
  });

  it('end-to-end: preserves non-derivable first in input order, then appends fresh derivable in DERIVABLE_KEYS order', () => {
    // Input has stale metadata-missing:title (derivable -> drop).
    // Input has non-derivable unsupported-block:table + mammoth-warning (preserve).
    // IR now has title, so no fresh metadata-missing keys.
    // 8000 words with newCategory short-story -> fresh mismatch.
    const ms = makeManuscript(
      { title: 'Now Has A Title' },
      bodyOfWordCount(8000),
    );
    const input = [
      'unsupported-block:table',
      'metadata-missing:title',
      'mammoth-warning',
    ];
    const result = reconcileWarnings(input, ms, 'short-story');
    expect(result).toEqual([
      'unsupported-block:table',
      'mammoth-warning',
      'category-wordcount-mismatch',
    ]);
  });
});