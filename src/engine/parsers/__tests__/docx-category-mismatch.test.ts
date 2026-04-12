/**
 * Tests for the v5 category-wordcount-mismatch warning on parseDocx.
 *
 * Kept in a separate file from the main docx.test.ts to make the v5 addition
 * reviewable as its own unit. Merge into docx.test.ts on landing if project
 * convention prefers one suite per parser.
 *
 * Fixture strategy: one paragraph of N 'w'-tokens via buildDocx. countWords()
 * joins runs with a space then splits on \s+, so a single run of "w w w ..."
 * yields exactly N words.
 */

import { parseDocx } from '../docx';
import { buildDocx } from './fixtures/build-docx';

const wordParagraphText = (n: number): string => 'w '.repeat(n).trim();

async function docxWithWords(n: number): Promise<Uint8Array> {
  return buildDocx([
    { type: 'p', runs: [{ text: wordParagraphText(n) }] },
  ]);
}

describe('parseDocx — category-wordcount-mismatch (v5)', () => {
  it('does not emit when hints.category is absent', async () => {
    const bytes = await docxWithWords(100);
    const result = await parseDocx(bytes, { title: 'T' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).not.toContain('category-wordcount-mismatch');
  });

  it('does not emit when hints.category matches detected band', async () => {
    const bytes = await docxWithWords(100);
    const result = await parseDocx(bytes, { category: 'short-story' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).not.toContain('category-wordcount-mismatch');
  });

  it('emits exactly one warning when declared novel disagrees with short-story content', async () => {
    const bytes = await docxWithWords(100);
    const result = await parseDocx(bytes, { category: 'novel' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const hits = result.warnings.filter(
      (w) => w === 'category-wordcount-mismatch',
    );
    expect(hits).toHaveLength(1);
  });

  it('emits for upper-band mismatch (short-story declared, novelette detected)', async () => {
    const bytes = await docxWithWords(8_000);
    const result = await parseDocx(bytes, { category: 'short-story' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.warnings).toContain('category-wordcount-mismatch');
  });
});