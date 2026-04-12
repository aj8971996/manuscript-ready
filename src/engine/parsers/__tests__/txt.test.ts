import { parseTxt, type ParseHints, type ParseResult } from '../txt';
import type { ProseManuscript, ProseBlock, Run } from '../../ir/prose';

/** Type guard narrowing ParseResult to the success case for assertion ergonomics. */
function expectOk(
  result: ParseResult,
): asserts result is Extract<ParseResult, { ok: true }> {
  if (!result.ok) {
    throw new Error(
      `expected ok ParseResult, got error: ${result.error.kind} - ${result.error.message}`,
    );
  }
}

const BASE_HINTS: ParseHints = {
  title: 'Test Story',
  byline: 'Test Author',
  legalName: 'Legal Name',
};

describe('parseTxt', () => {
  describe('ParseResult shape', () => {
    test('returns ok:true with manuscript and warnings for valid input', () => {
      const result = parseTxt('A single paragraph.', BASE_HINTS);
      expectOk(result);
      expect(result.manuscript.schemaVersion).toBe(1);
      expect(Array.isArray(result.manuscript.body)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    test('returns ok:false with kind:empty for empty input', () => {
      const result = parseTxt('', BASE_HINTS);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('empty');
      }
    });

    test('returns ok:false with kind:empty for whitespace-only input', () => {
      const result = parseTxt('   \n\n\t\n   ', BASE_HINTS);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('empty');
      }
    });
  });

  describe('metadata hints', () => {
    test('applies title, byline, and legalName from hints', () => {
      const result = parseTxt('Body paragraph.', BASE_HINTS);
      expectOk(result);
      expect(result.manuscript.metadata.title).toBe('Test Story');
      expect(result.manuscript.metadata.byline).toBe('Test Author');
      expect(result.manuscript.metadata.legalName).toBe('Legal Name');
    });

    test('defaults missing metadata to empty strings with a warning (D6)', () => {
      const result = parseTxt('Body paragraph.');
      expectOk(result);
      expect(result.manuscript.metadata.title).toBe('');
      expect(result.manuscript.metadata.byline).toBe('');
      expect(result.manuscript.metadata.legalName).toBe('');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('applies headerKeyword from hints when provided', () => {
      const result = parseTxt('Body.', { ...BASE_HINTS, headerKeyword: 'CUSTOM' });
      expectOk(result);
      expect(result.manuscript.metadata.headerKeyword).toBe('CUSTOM');
    });
  });

  describe('contact defaults (D7)', () => {
    test('defaults to freetext "Contact information not provided" when no hint given', () => {
      const result = parseTxt('Body.', BASE_HINTS);
      expectOk(result);
      expect(result.manuscript.metadata.contact).toEqual({
        mode: 'freetext',
        text: 'Contact information not provided',
      });
    });

    test('uses structured contact from hints when provided', () => {
      const result = parseTxt('Body.', {
        ...BASE_HINTS,
        contact: {
          mode: 'structured',
          name: 'A',
          street: 'B',
          city: 'C',
          region: 'D',
          postalCode: 'E',
          email: 'a@b.c',
        },
      });
      expectOk(result);
      expect(result.manuscript.metadata.contact.mode).toBe('structured');
    });
  });

  describe('paragraph splitting', () => {
    test('splits paragraphs on blank lines', () => {
      const result = parseTxt(
        'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
        BASE_HINTS,
      );
      expectOk(result);
      const paragraphs = result.manuscript.body.filter(
        (b): b is Extract<ProseBlock, { type: 'paragraph' }> => b.type === 'paragraph',
      );
      expect(paragraphs).toHaveLength(3);
    });

    test('treats runs of blank lines as a single separator', () => {
      const result = parseTxt('First.\n\n\n\nSecond.', BASE_HINTS);
      expectOk(result);
      const paragraphs = result.manuscript.body.filter((b) => b.type === 'paragraph');
      expect(paragraphs).toHaveLength(2);
    });

    test('joins soft line breaks within a paragraph into a single text run', () => {
      const result = parseTxt('Line one\nline two\nline three.', BASE_HINTS);
      expectOk(result);
      const paragraphs = result.manuscript.body.filter(
        (b): b is Extract<ProseBlock, { type: 'paragraph' }> => b.type === 'paragraph',
      );
      expect(paragraphs).toHaveLength(1);
      const runs = paragraphs[0]!.runs;
      const joined = runs.map((r) => r.text).join('');
      expect(joined).toContain('Line one');
      expect(joined).toContain('line two');
      expect(joined).toContain('line three');
    });
  });

  describe('scene breaks (D2 markers)', () => {
    test.each([['#'], ['***'], ['* * *'], ['~~~']])(
      'recognizes %p as a sceneBreak block',
      (marker) => {
        const result = parseTxt(`Para one.\n\n${marker}\n\nPara two.`, BASE_HINTS);
        expectOk(result);
        const sceneBreaks = result.manuscript.body.filter((b) => b.type === 'sceneBreak');
        expect(sceneBreaks).toHaveLength(1);
      },
    );

    test('does not treat scene-break-like text inside a paragraph as a block', () => {
      const result = parseTxt('A paragraph with *** inside it.', BASE_HINTS);
      expectOk(result);
      const sceneBreaks = result.manuscript.body.filter((b) => b.type === 'sceneBreak');
      expect(sceneBreaks).toHaveLength(0);
    });
  });

  describe('chapter detection (D3)', () => {
    test.each([
      ['Chapter 1', 1],
      ['Chapter 12', 12],
      ['chapter 3', 3],
      ['CHAPTER 7', 7],
    ])('recognizes numeric form %p', (line, expectedNumber) => {
      const result = parseTxt(`${line}\n\nBody.`, BASE_HINTS);
      expectOk(result);
      const chapters = result.manuscript.body.filter(
        (b): b is Extract<ProseBlock, { type: 'chapter' }> => b.type === 'chapter',
      );
      expect(chapters).toHaveLength(1);
      expect(chapters[0]!.number).toBe(expectedNumber);
    });

    test.each([['Chapter I'], ['Chapter IV'], ['Chapter XII']])(
      'recognizes Roman numeral form %p',
      (line) => {
        const result = parseTxt(`${line}\n\nBody.`, BASE_HINTS);
        expectOk(result);
        const chapters = result.manuscript.body.filter((b) => b.type === 'chapter');
        expect(chapters).toHaveLength(1);
      },
    );

    test.each([
      ['Chapter One'],
      ['Chapter Five'],
      ['Chapter Twenty'],
    ])('recognizes word-number form %p (capped at twenty)', (line) => {
      const result = parseTxt(`${line}\n\nBody.`, BASE_HINTS);
      expectOk(result);
      const chapters = result.manuscript.body.filter((b) => b.type === 'chapter');
      expect(chapters).toHaveLength(1);
    });

    test('does NOT recognize word-numbers past twenty (D3 cap)', () => {
      const result = parseTxt('Chapter Thirty\n\nBody.', BASE_HINTS);
      expectOk(result);
      const chapters = result.manuscript.body.filter((b) => b.type === 'chapter');
      expect(chapters).toHaveLength(0);
    });

    test('does not treat "Chapter" mid-sentence as a chapter heading', () => {
      const result = parseTxt('This is chapter one of a long saga.', BASE_HINTS);
      expectOk(result);
      const chapters = result.manuscript.body.filter((b) => b.type === 'chapter');
      expect(chapters).toHaveLength(0);
    });
  });

  describe('emphasis markers (D5)', () => {
    function flattenRuns(blocks: ProseBlock[]): Run[] {
      const out: Run[] = [];
      for (const b of blocks) {
        if (b.type === 'paragraph') out.push(...b.runs);
      }
      return out;
    }

    test('parses *italic* as emphasis', () => {
      const result = parseTxt('Plain then *italic* then plain.', BASE_HINTS);
      expectOk(result);
      const runs = flattenRuns(result.manuscript.body);
      const emphases = runs.filter((r) => r.type === 'emphasis');
      expect(emphases).toHaveLength(1);
      expect(emphases[0]!.text).toBe('italic');
    });

    test('parses _italic_ as emphasis', () => {
      const result = parseTxt('Plain _italic_ plain.', BASE_HINTS);
      expectOk(result);
      const runs = flattenRuns(result.manuscript.body);
      const emphases = runs.filter((r) => r.type === 'emphasis');
      expect(emphases).toHaveLength(1);
      expect(emphases[0]!.text).toBe('italic');
    });

    test('parses **bold** as emphasis (D5 collapses bold to emphasis)', () => {
      const result = parseTxt('Plain **bold** plain.', BASE_HINTS);
      expectOk(result);
      const runs = flattenRuns(result.manuscript.body);
      const emphases = runs.filter((r) => r.type === 'emphasis');
      expect(emphases).toHaveLength(1);
      expect(emphases[0]!.text).toBe('bold');
    });

    test('emits a warning for nested emphasis and collapses to one level', () => {
      const result = parseTxt('Plain **_nested_** plain.', BASE_HINTS);
      expectOk(result);
      const runs = flattenRuns(result.manuscript.body);
      const emphases = runs.filter((r) => r.type === 'emphasis');
      expect(emphases.length).toBeGreaterThanOrEqual(1);
      expect(
        result.warnings.some((w) => /nest/i.test(w)),
      ).toBe(true);
    });
  });
});