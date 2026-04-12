/**
 * Integration smoke test.
 *
 * Purpose: catch "wires disconnected" bugs at the parser/formatter seam --
 * wrong export name, type mismatch, barrel typo, IR shape drift. Unit
 * suites cover content correctness; this suite covers "does the pipeline
 * run end-to-end without throwing and produce non-empty output".
 *
 * Intentionally shallow. Deep round-trip assertions (byte-level layout,
 * word count accuracy, per-block rendering) are deferred tech debt #8.
 *
 * Imports go through the parsers barrel (src/engine/parsers/index.ts) so
 * this test also verifies the barrel's export surface compiles and resolves.
 *
 * FormatterOptions values mirror the existing shunn-short-story formatter
 * test (variant 'modern', emphasisStyle 'italic', endMarker 'hash') --
 * these are the "canonical" defaults across the formatter suite.
 */

import { parseTxt, parseDocx } from '..';
import { formatShunnShortStory } from '../../formatters/shunn-short-story';
import type { FormatterOptions } from '../../formatters';
import { buildDocx } from './fixtures/build-docx';

const FORMATTER_OPTIONS: FormatterOptions = {
  variant: 'modern',
  emphasisStyle: 'italic',
  endMarker: 'hash',
};

describe('parser -> formatter integration smoke', () => {
  it('round-trips a TXT manuscript through parseTxt -> formatShunnShortStory', async () => {
    const sample = [
      'Chapter 1',
      '',
      'The first paragraph with *italic* and **bold** text.',
      '',
      '#',
      '',
      'The second paragraph after a scene break.',
    ].join('\n');

    const parsed = parseTxt(sample, {
      title: 'Smoke Test',
      byline: 'Test Author',
      legalName: 'Test Author',
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('unreachable');
    expect(parsed.manuscript.body.length).toBeGreaterThan(0);

    const result = await formatShunnShortStory(parsed.manuscript, FORMATTER_OPTIONS);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });

  it('round-trips a DOCX manuscript through parseDocx -> formatShunnShortStory', async () => {
    const docxBytes = await buildDocx([
      { type: 'h1', text: 'Chapter 1' },
      { type: 'p', runs: [
        { text: 'The first paragraph with ' },
        { text: 'italic', em: true },
        { text: ' and ' },
        { text: 'bold', strong: true },
        { text: ' text.' },
      ] },
      { type: 'p', runs: [{ text: 'A second paragraph of body content.' }] },
    ]);

    const parsed = await parseDocx(docxBytes, {
      title: 'Smoke Test',
      byline: 'Test Author',
      legalName: 'Test Author',
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('unreachable');
    expect(parsed.manuscript.body.length).toBeGreaterThan(0);

    const result = await formatShunnShortStory(parsed.manuscript, FORMATTER_OPTIONS);
    expect(result.bytes.byteLength).toBeGreaterThan(0);
  });
});