/**
 * Tests for the v5 category-wordcount-mismatch warning on parseTxt.
 *
 * Kept in a separate file from the main txt.test.ts to make the v5 addition
 * reviewable as its own unit. Merge into txt.test.ts on landing if project
 * convention prefers one suite per parser.
 *
 * Fixture strategy: build bodies with a known number of whitespace-separated
 * tokens so countWords() returns a predictable value. `'w '.repeat(n).trim()`
 * produces exactly n words.
 */

import { parseTxt, type ParseHints } from '../txt';

const BASE_HINTS: ParseHints = {
  title: 'T',
  byline: 'B',
  legalName: 'L',
};

const words = (n: number): string => 'w '.repeat(n).trim();

describe('parseTxt — category-wordcount-mismatch (v5)', () => {
  it('does not emit when hints.category is absent', () => {
    const result = parseTxt(words(100), BASE_HINTS);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).not.toContain('category-wordcount-mismatch');
  });

  it('does not emit when hints.category matches detected band', () => {
    // 100 words → short-story
    const result = parseTxt(words(100), {
      ...BASE_HINTS,
      category: 'short-story',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).not.toContain('category-wordcount-mismatch');
  });

  it('emits exactly one warning when declared novel disagrees with a short-story word count', () => {
    const result = parseTxt(words(100), { ...BASE_HINTS, category: 'novel' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const hits = result.warnings.filter(
      (w) => w === 'category-wordcount-mismatch',
    );
    expect(hits).toHaveLength(1);
  });

  it('emits for adjacent-band mismatch (novelette declared, short-story detected)', () => {
    const result = parseTxt(words(100), {
      ...BASE_HINTS,
      category: 'novelette',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).toContain('category-wordcount-mismatch');
  });

  it('emits for upper-band mismatch (short-story declared, novelette detected)', () => {
    // 8_000 words → novelette band
    const result = parseTxt(words(8_000), {
      ...BASE_HINTS,
      category: 'short-story',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).toContain('category-wordcount-mismatch');
  });
});