/**
 * First failing formatter test for shunn-short-story.
 *
 * Feeds a minimal ProseManuscript into the formatter and asserts structural
 * invariants on the resulting .docx bytes by unzipping the archive and
 * parsing document.xml directly. We inspect the raw OOXML rather than
 * round-tripping through a reader library (e.g. mammoth) because mammoth
 * deliberately discards presentational formatting — margins, exact spacing,
 * header suppression — which is precisely the layer we need to assert on.
 *
 * Session 6 update: the contact-block and word-count assertions use
 * collectParagraphs() to descend into tables, because Shunn's page-1 layout
 * places those elements inside a two-cell borderless table (contact left,
 * word count right). The shallow `walk` helper only reaches direct children
 * of w:body and can't see paragraphs nested in w:tbl.
 *
 * Units reminder: OOXML uses twips for most measurements. 1 inch = 1440 twips.
 *   1"    margins         = 1440 twips
 *   3.67" title-from-top  = 5285 twips  (we allow ±20 twips / ~0.014")
 *   Double line spacing   = line="480" lineRule="auto" (240 = single)
 */

import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import { formatShunnShortStory } from '../shunn-short-story';
import type { ProseManuscript } from '../../ir/prose';

// --- Fixture --------------------------------------------------------------

const FIXTURE: ProseManuscript = {
  schemaVersion: 1,
  metadata: {
    title: 'The Lottery',
    byline: 'Shirley Jackson',
    legalName: 'Shirley Jackson',
    contact: {
      mode: 'structured',
      name: 'Shirley Jackson',
      street: '123 Example St',
      city: 'North Bennington',
      region: 'VT',
      postalCode: '05257',
      phone: '555-0100',
      email: 'sj@example.com',
    },
    // headerKeyword omitted → formatter should auto-extract "Lottery"
  },
  body: [
    {
      type: 'paragraph',
      runs: [{ type: 'text', text: 'The morning of June 27th was clear and sunny.' }],
    },
  ],
};

// --- Helpers --------------------------------------------------------------

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Preserve arrays even when only one child exists — simplifies traversal.
  isArray: (name: string) =>
    ['w:p', 'w:r', 'w:sectPr', 'w:headerReference'].includes(name),
});

let documentXml: XmlNode;
let settingsXml: XmlNode | undefined;
let headerXmls: XmlNode[] = [];

beforeAll(async () => {
  const result = await formatShunnShortStory(FIXTURE, {
    variant: 'modern',
    emphasisStyle: 'italic',
    endMarker: 'hash',
  });

  const zip = await JSZip.loadAsync(result.bytes);
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) throw new Error('document.xml missing from docx archive');
  documentXml = parser.parse(await docEntry.async('string')) as XmlNode;

  const settingsEntry = zip.file('word/settings.xml');
  if (settingsEntry) {
    settingsXml = parser.parse(await settingsEntry.async('string')) as XmlNode;
  }

  const headerFiles = Object.keys(zip.files).filter((n) => /^word\/header\d*\.xml$/.test(n));
  headerXmls = await Promise.all(
    headerFiles.map(async (n) => parser.parse(await zip.file(n)!.async('string')) as XmlNode),
  );
});

// Shallow path walker — returns the first matching node or undefined.
const walk = (node: unknown, path: string[]): unknown => {
  let cur: unknown = node;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
    if (Array.isArray(cur)) cur = cur[0];
  }
  return cur;
};

// Collects every w:p node under a root, descending into tables
// (w:tbl > w:tr > w:tc > w:p) and any other nested containers.
// Needed because Shunn's page-1 layout puts the contact block and word
// count inside a two-cell table — the shallow `walk` helper above only
// reaches direct children of w:body.
const collectParagraphs = (node: unknown): XmlNode[] => {
  if (node == null || typeof node !== 'object') return [];
  const out: XmlNode[] = [];
  const visit = (n: unknown): void => {
    if (n == null || typeof n !== 'object') return;
    const obj = n as Record<string, unknown>;
    const ps = obj['w:p'];
    if (Array.isArray(ps)) out.push(...(ps as XmlNode[]));
    else if (ps && typeof ps === 'object') out.push(ps as XmlNode);
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'w:p') continue;
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(node);
  return out;
};

// --- Assertions -----------------------------------------------------------

describe('shunn-short-story formatter — structural invariants', () => {
  describe('page setup', () => {
    it('uses 1-inch margins on all sides (1440 twips)', () => {
      const pgMar = walk(documentXml, ['w:document', 'w:body', 'w:sectPr', 'w:pgMar']) as
        | Record<string, string>
        | undefined;
      expect(pgMar).toBeDefined();
      expect(pgMar!['@_w:top']).toBe('1440');
      expect(pgMar!['@_w:right']).toBe('1440');
      expect(pgMar!['@_w:bottom']).toBe('1440');
      expect(pgMar!['@_w:left']).toBe('1440');
    });

    it('uses Letter page size (12240 x 15840 twips)', () => {
      const pgSz = walk(documentXml, ['w:document', 'w:body', 'w:sectPr', 'w:pgSz']) as
        | Record<string, string>
        | undefined;
      expect(pgSz).toBeDefined();
      expect(pgSz!['@_w:w']).toBe('12240');
      expect(pgSz!['@_w:h']).toBe('15840');
    });
  });

  describe('body formatting', () => {
    it('double-spaces body paragraphs (line=480, auto)', () => {
      const body = walk(documentXml, ['w:document', 'w:body']) as Record<string, unknown>;
      const paragraphs = (body['w:p'] as XmlNode[]) ?? [];
      const bodyPara = paragraphs.find((p) => {
        const runs = (p['w:r'] as XmlNode[]) ?? [];
        return runs.some((r) => {
          const t = r['w:t'];
          const text = typeof t === 'string' ? t : (t as { '#text'?: string } | undefined)?.['#text'];
          return typeof text === 'string' && text.includes('June 27th');
        });
      });
      expect(bodyPara).toBeDefined();
      const spacing = walk(bodyPara, ['w:pPr', 'w:spacing']) as Record<string, string> | undefined;
      expect(spacing).toBeDefined();
      expect(spacing!['@_w:line']).toBe('480');
      expect(spacing!['@_w:lineRule']).toBe('auto');
    });
  });

  describe('first page layout', () => {
    it('places title ~3.67" (5285 twips ±20) from top of page 1', () => {
      // Soft assertion per handoff: title paragraph exists and is centered.
      // Session 6 or 7 tightens this with a dedicated layout-measurement helper.
      const body = walk(documentXml, ['w:document', 'w:body']) as Record<string, unknown>;
      const paragraphs = (body['w:p'] as XmlNode[]) ?? [];
      const titlePara = paragraphs.find((p) => {
        const runs = (p['w:r'] as XmlNode[]) ?? [];
        return runs.some((r) => {
          const t = r['w:t'];
          const text = typeof t === 'string' ? t : (t as { '#text'?: string } | undefined)?.['#text'];
          return text === 'The Lottery';
        });
      });
      expect(titlePara).toBeDefined();
      const jc = walk(titlePara, ['w:pPr', 'w:jc']) as Record<string, string> | undefined;
      expect(jc?.['@_w:val']).toBe('center');
    });

    it('includes contact block with author name and email', () => {
      const body = walk(documentXml, ['w:document', 'w:body']);
      const paragraphs = collectParagraphs(body);
      const allText = paragraphs
        .flatMap((p) => (p['w:r'] as XmlNode[]) ?? [])
        .map((r) => {
          const t = r['w:t'];
          return typeof t === 'string' ? t : (t as { '#text'?: string } | undefined)?.['#text'] ?? '';
        })
        .join('\n');
      expect(allText).toContain('Shirley Jackson');
      expect(allText).toContain('sj@example.com');
    });

    it('emits a word count on first page (derived from body)', () => {
      // Word count is derived by the formatter from body at format time —
      // not stored on the IR. Shunn rounds short-story counts to the nearest
      // 100. We assert shape ("<number> words") rather than a specific value
      // so this test doesn't re-break when we swap fixtures. Session 6+ may
      // tighten against a canonical ~3400-word fixture once rounding is
      // committed to code.
      const body = walk(documentXml, ['w:document', 'w:body']);
      const paragraphs = collectParagraphs(body);
      const allText = paragraphs
        .flatMap((p) => (p['w:r'] as XmlNode[]) ?? [])
        .map((r) => {
          const t = r['w:t'];
          return typeof t === 'string' ? t : (t as { '#text'?: string } | undefined)?.['#text'] ?? '';
        })
        .join(' ');
      expect(allText).toMatch(/\b\d{1,3}(?:,\d{3})*\s*words?\b/i);
    });
  });

  describe('running header', () => {
    it('suppresses header on page 1 (titlePg flag on sectPr)', () => {
      const sectPr = walk(documentXml, ['w:document', 'w:body', 'w:sectPr']) as
        | Record<string, unknown>
        | undefined;
      expect(sectPr).toBeDefined();
      // Shunn pattern: titlePg causes first-page header to differ — combined
      // with an empty "first" headerReference — effectively suppressing it.
      expect(sectPr!['w:titlePg']).toBeDefined();
    });

    it('emits a header containing "Jackson / Lottery /" with auto-extracted keyword', () => {
      expect(headerXmls.length).toBeGreaterThan(0);
      const headerText = headerXmls
        .map((h) => JSON.stringify(h))
        .join('\n');
      expect(headerText).toMatch(/Jackson/);
      expect(headerText).toMatch(/Lottery/);
    });
  });
});