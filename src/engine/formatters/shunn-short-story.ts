/**
 * Shunn short-story formatter.
 *
 * Emits a .docx conforming to William Shunn's modern short-story manuscript
 * format: Letter, 1" margins, double-spaced body, contact block top-left,
 * word count top-right, title ~3.67" from the top, running header on
 * page 2+ of the form `Lastname / Keyword / <page>`.
 *
 * v5 (tech debt #3 closed): output path is Packer.toBlob → ArrayBuffer →
 * Uint8Array. Blob is what expo-sharing wants at the app-shell seam, and
 * Packer.toBlob is documented in the docx library. The FormatterResult.bytes
 * contract (Uint8Array) is unchanged, so every downstream caller and test
 * is stable across the swap. Jest (node 18+) has global Blob; no polyfill.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

import type {
  ContactBlock,
  Metadata,
  ProseBlock,
  ProseManuscript,
  Run,
} from '../ir/prose';
import { countWords } from '../util/word-count';
import type { FormatterOptions, FormatterResult } from './index';

// --- Constants ------------------------------------------------------------

const TWIPS_PER_INCH = 1440;
const PAGE_WIDTH_TWIPS = 12240; // 8.5"
const PAGE_HEIGHT_TWIPS = 15840; // 11"
const MARGIN_TWIPS = TWIPS_PER_INCH; // 1"
const TEXT_AREA_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - MARGIN_TWIPS * 2; // 9360
const HALF_TEXT_WIDTH_TWIPS = Math.floor(TEXT_AREA_WIDTH_TWIPS / 2); // 4680
const TITLE_TOP_TWIPS = 5285; // ~3.67" from page top (Shunn target)
const FIRST_LINE_INDENT_TWIPS = 720; // 0.5"
const SINGLE_LINE_TWIPS = 240;
const DOUBLE_LINE = 480;
const FONT_MODERN = 'Times New Roman';
const FONT_CLASSIC = 'Courier New';
const FONT_SIZE_HALF_POINTS = 24; // 12pt

// --- Entry point ----------------------------------------------------------

export async function formatShunnShortStory(
  manuscript: ProseManuscript,
  options: FormatterOptions,
): Promise<FormatterResult> {
  const warnings: string[] = [];
  const font = options.variant === 'classic' ? FONT_CLASSIC : FONT_MODERN;

  const lastname = extractLastname(manuscript.metadata.legalName);
  const keyword = resolveHeaderKeyword(manuscript.metadata, warnings);
  const wordCount = roundToHundred(countWords(manuscript.body));

  const contactParagraphs = buildContactParagraphs(
    manuscript.metadata.contact,
    font,
    warnings,
  );
  const wordCountParagraph = buildWordCountParagraph(wordCount, font);
  const topRowTable = buildTopRowTable(contactParagraphs, [wordCountParagraph]);
  const titlePara = buildTitleParagraph(
    manuscript.metadata.title,
    font,
    contactParagraphs.length,
  );
  const bylinePara = buildBylineParagraph(manuscript.metadata.byline, font);
  const bodyParas = manuscript.body.flatMap((b) => renderBlock(b, font, options));
  const endMarkerParas = buildEndMarker(options.endMarker, font, manuscript.body);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font, size: FONT_SIZE_HALF_POINTS } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS },
            margin: {
              top: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
            },
          },
          titlePage: true,
        },
        headers: {
          default: buildRunningHeader(lastname, keyword, font),
          first: new Header({ children: [new Paragraph({ children: [] })] }),
        },
        children: [
          topRowTable,
          titlePara,
          bylinePara,
          ...bodyParas,
          ...endMarkerParas,
        ],
      },
    ],
  });

  // v5 (tech debt #3 closed): Packer.toBlob → ArrayBuffer → Uint8Array.
  // RN-ready: expo-sharing consumes Blob directly at the app layer, but the
  // engine boundary still returns Uint8Array for test parity and to keep
  // the formatter output format-agnostic.
  const blob = await Packer.toBlob(doc);
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return {
    bytes,
    suggestedFilename: buildFilename(lastname, manuscript.metadata.title),
    warnings,
  };
}

// --- Helpers: names, keywords, counts -------------------------------------

function extractLastname(legalName: string): string {
  const tokens = legalName.trim().split(/\s+/).filter(Boolean);
  return tokens.length === 0 ? '' : (tokens[tokens.length - 1] ?? '');
}

function resolveHeaderKeyword(metadata: Metadata, warnings: string[]): string {
  const override = metadata.headerKeyword?.trim();
  if (override && override.length > 0) return override;

  const extracted = extractHeaderKeyword(metadata.title);
  if (extracted.length === 0) {
    warnings.push(
      'Header keyword could not be extracted from title; header will omit the keyword slot.',
    );
  }
  return extracted;
}

function extractHeaderKeyword(title: string): string {
  const collapsed = title.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return '';
  const tokens = collapsed.split(' ');
  const first = tokens[0] ?? '';
  if (/^(a|an|the)$/i.test(first)) {
    return tokens.slice(1).join(' ').trim();
  }
  return collapsed;
}

function roundToHundred(n: number): number {
  return Math.round(n / 100) * 100;
}

// --- Helpers: contact block ----------------------------------------------

function buildContactParagraphs(
  contact: ContactBlock,
  font: string,
  warnings: string[],
): Paragraph[] {
  if (contact.mode === 'freetext') {
    warnings.push(
      'Contact block is freetext; structured mode is recommended for parseability.',
    );
    return contact.text
      .split(/\r?\n/)
      .map((line) => singleSpacedLine(line, font, AlignmentType.LEFT));
  }

  const lines: string[] = [];
  lines.push(contact.name);
  lines.push(contact.street);
  const cityLine = [contact.city, contact.region, contact.postalCode]
    .filter((s) => s && s.length > 0)
    .join(', ')
    .replace(/, (\S+)$/, ' $1'); // "City, ST 12345"
  lines.push(cityLine);
  if (contact.country) lines.push(contact.country);
  if (contact.phone) lines.push(contact.phone);
  lines.push(contact.email);
  if (contact.pronouns) lines.push(contact.pronouns);

  return lines.map((line) => singleSpacedLine(line, font, AlignmentType.LEFT));
}

function singleSpacedLine(
  text: string,
  font: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
): Paragraph {
  return new Paragraph({
    alignment,
    spacing: { line: SINGLE_LINE_TWIPS, lineRule: 'auto' },
    children: [new TextRun({ text, font, size: FONT_SIZE_HALF_POINTS })],
  });
}

// --- Helpers: word count --------------------------------------------------

function buildWordCountParagraph(wordCount: number, font: string): Paragraph {
  const label = wordCount === 1 ? 'word' : 'words';
  const formatted = wordCount.toLocaleString('en-US');
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { line: SINGLE_LINE_TWIPS, lineRule: 'auto' },
    children: [
      new TextRun({
        text: `${formatted} ${label}`,
        font,
        size: FONT_SIZE_HALF_POINTS,
      }),
    ],
  });
}

// --- Helpers: top-row table ----------------------------------------------

function buildTopRowTable(
  leftParagraphs: Paragraph[],
  rightParagraphs: Paragraph[],
): Table {
  const borderNone = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = {
    top: borderNone,
    bottom: borderNone,
    left: borderNone,
    right: borderNone,
  };

  return new Table({
    width: { size: TEXT_AREA_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      ...noBorders,
      insideHorizontal: borderNone,
      insideVertical: borderNone,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: HALF_TEXT_WIDTH_TWIPS, type: WidthType.DXA },
            borders: noBorders,
            children: leftParagraphs,
          }),
          new TableCell({
            width: { size: HALF_TEXT_WIDTH_TWIPS, type: WidthType.DXA },
            borders: noBorders,
            children: rightParagraphs,
          }),
        ],
      }),
    ],
  });
}

// --- Helpers: title / byline ---------------------------------------------

function buildTitleParagraph(
  title: string,
  font: string,
  contactLineCount: number,
): Paragraph {
  const estimatedTableHeight = contactLineCount * SINGLE_LINE_TWIPS;
  const spacingBefore = Math.max(
    0,
    TITLE_TOP_TWIPS - MARGIN_TWIPS - estimatedTableHeight,
  );

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: spacingBefore,
      line: DOUBLE_LINE,
      lineRule: 'auto',
    },
    children: [
      new TextRun({ text: title, font, size: FONT_SIZE_HALF_POINTS }),
    ],
  });
}

function buildBylineParagraph(byline: string, font: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: DOUBLE_LINE, lineRule: 'auto' },
    children: [
      new TextRun({ text: `by ${byline}`, font, size: FONT_SIZE_HALF_POINTS }),
    ],
  });
}

// --- Helpers: body rendering ---------------------------------------------

function renderBlock(
  block: ProseBlock,
  font: string,
  options: FormatterOptions,
): Paragraph[] {
  switch (block.type) {
    case 'paragraph':
      return [renderParagraph(block.runs, font, options)];
    case 'sceneBreak':
      return [renderCentered('#', font)];
    case 'chapter':
      return [renderChapter(block.title, block.number, font)];
    case 'theEnd':
      return [renderCentered('The End', font)];
  }
}

function renderParagraph(
  runs: Run[],
  font: string,
  options: FormatterOptions,
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: DOUBLE_LINE, lineRule: 'auto' },
    indent: { firstLine: FIRST_LINE_INDENT_TWIPS },
    children: runs.map((r) => renderRun(r, font, options)),
  });
}

function renderRun(
  run: Run,
  font: string,
  options: FormatterOptions,
): TextRun {
  if (run.type === 'text') {
    return new TextRun({ text: run.text, font, size: FONT_SIZE_HALF_POINTS });
  }
  const emphasisProps =
    options.emphasisStyle === 'underline'
      ? { underline: {} }
      : { italics: true };
  return new TextRun({
    text: run.text,
    font,
    size: FONT_SIZE_HALF_POINTS,
    ...emphasisProps,
  });
}

function renderCentered(text: string, font: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { line: DOUBLE_LINE, lineRule: 'auto' },
    children: [new TextRun({ text, font, size: FONT_SIZE_HALF_POINTS })],
  });
}

function renderChapter(
  title: string | undefined,
  number: number | undefined,
  font: string,
): Paragraph {
  const label =
    title && title.length > 0
      ? title
      : number !== undefined
        ? `Chapter ${number}`
        : 'Chapter';
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
    spacing: { before: SINGLE_LINE_TWIPS * 4, line: DOUBLE_LINE, lineRule: 'auto' },
    children: [new TextRun({ text: label, font, size: FONT_SIZE_HALF_POINTS })],
  });
}

// --- Helpers: end marker --------------------------------------------------

function buildEndMarker(
  marker: FormatterOptions['endMarker'],
  font: string,
  body: ProseBlock[],
): Paragraph[] {
  const bodyAlreadyEnds = body.some((b) => b.type === 'theEnd');
  if (bodyAlreadyEnds || marker === 'none') return [];

  switch (marker) {
    case 'hash':
      return [renderCentered('#', font)];
    case 'the-end-title':
      return [renderCentered('The End', font)];
    case 'the-end-caps':
      return [renderCentered('THE END', font)];
  }
}

// --- Helpers: filename ---------------------------------------------------

function buildFilename(lastname: string, title: string): string {
  const last = lastname.trim().length > 0 ? lastname.trim() : 'Manuscript';
  const slug = title
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const titlePart = slug.length > 0 ? `_${slug}` : '';
  return `${last}${titlePart}.docx`;
}

// --- Helpers: running header ---------------------------------------------

function buildRunningHeader(
  lastname: string,
  keyword: string,
  font: string,
): Header {
  const left = lastname.length > 0 ? lastname : 'Author';
  const middle = keyword.length > 0 ? ` / ${keyword}` : '';

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: SINGLE_LINE_TWIPS, lineRule: 'auto' },
        children: [
          new TextRun({
            text: `${left}${middle} / `,
            font,
            size: FONT_SIZE_HALF_POINTS,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font,
            size: FONT_SIZE_HALF_POINTS,
          }),
        ],
      }),
    ],
  });
}