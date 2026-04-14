/**
 * DOCX parser.
 *
 * Pipeline: size/empty pre-checks -> readDocxToHtml (fflate-based, Hermes-
 * compatible) -> tokenize -> block-fold to ProseBlock[]. Never throws across
 * the engine boundary; failures surface as ParseResult.ok=false with
 * ParserError.kind in {'empty','oversize','malformed'}.
 *
 * Replacement parser (post-v9): mammoth was removed in favor of an in-house
 * DOCX reader built on fflate. The switch was forced by a Hermes wall —
 * mammoth's jszip dependency hangs synchronously on device — documented in
 * handoff v9 and closed in v10. The HTML boundary downstream is preserved,
 * so the tokenizer and fold logic below are unchanged from the mammoth era.
 *
 * Warning keys preserved from the mammoth era: 'mammoth-warning' and
 * 'mammoth-error'. The names are stale but the validation layer's test
 * matrix asserts these strings; renaming requires a cross-cutting edit that
 * is explicitly out of scope for this session (validation purity rule).
 * Rename is deferred tech debt, tracked in handoff v10.
 *
 * Heading emphasis: the reader can emit <em>/<strong> inside h1/h2/h3. The
 * IR's chapter.title is a plain string, so emphasis inside headings is
 * silently flattened to text with no warning (Session 8.75 decision).
 *
 * Option B (Session 8.75): an h1/h2/h3 whose text does not match
 * CHAPTER_REGEX becomes {type:'chapter', title} with number absent.
 * Prologue/epilogue/named-part headings flow through this path.
 *
 * v5: emits 'category-wordcount-mismatch' once per manuscript when
 * hints.category disagrees with the detected SFWA band.
 *
 * Tech debt #6 (closed, v10): the Node Buffer dependency is gone. The
 * reader accepts Uint8Array directly; no cast, no polyfill needed on RN.
 */

import type { Metadata, ContactBlock, ProseBlock, Run } from '../ir/prose';
import { classifyChapter } from '../util/chapter-detect';
import { categoryFromWordCount } from '../util/category-from-wordcount';
import { countWords } from '../util/word-count';
import { tokenize, type Token } from './docx-html-tokenizer';
import { readDocxToHtml } from './docx-reader';
import type { ParseHints, ParseResult } from './types';

export type { ParseHints, ParseResult, ParserError } from './types';

const MAX_BYTES = 50 * 1024 * 1024; // D9

const DEFAULT_CONTACT: ContactBlock = {
  mode: 'freetext',
  text: 'Contact information not provided',
};

export async function parseDocx(
  input: Uint8Array,
  hints?: ParseHints,
): Promise<ParseResult> {
  if (input.byteLength === 0) {
    return {
      ok: false,
      error: { kind: 'empty', message: 'Input contains zero bytes.' },
    };
  }
  if (input.byteLength > MAX_BYTES) {
    return {
      ok: false,
      error: { kind: 'oversize', message: `Input exceeds ${MAX_BYTES} bytes (D9).` },
    };
  }

  let html: string;
  let readerWarnings: ReadonlyArray<string>;
  try {
    const result = readDocxToHtml(input);
    html = result.html;
    readerWarnings = result.warnings;
  } catch (cause) {
    return {
      ok: false,
      error: { kind: 'malformed', message: 'Failed to parse DOCX content.', cause },
    };
  }
  console.warn('[docx-bc] html length:', html.length);
  console.warn('[docx-bc] first 500:', html.slice(0, 500));
  console.warn('[docx-bc] reader warnings:', readerWarnings.join(','));

  const warnings: string[] = [...readerWarnings];
  const tokens = tokenize(html);
  const body = foldTokensToBlocks(tokens, warnings);
  const metadata = buildMetadata(hints);

  // v5: single-call-site category mismatch check. One per manuscript is
  // trivially satisfied here because this sits outside any loop — do not
  // move this into a loop without adding a `warned` flag.
  maybeWarnCategoryMismatch(body, hints, warnings);

  return {
    ok: true,
    manuscript: { schemaVersion: 1, metadata, body },
    warnings,
  };
}

function buildMetadata(hints: ParseHints | undefined): Metadata {
  const metadata: Metadata = {
    title: hints?.title ?? '',
    byline: hints?.byline ?? '',
    legalName: hints?.legalName ?? '',
    contact: hints?.contact ?? DEFAULT_CONTACT,
  };
  if (hints?.headerKeyword !== undefined) {
    metadata.headerKeyword = hints.headerKeyword;
  }
  return metadata;
}

function maybeWarnCategoryMismatch(
  body: ProseBlock[],
  hints: ParseHints | undefined,
  warnings: string[],
): void {
  if (!hints?.category) return;
  const detected = categoryFromWordCount(countWords(body));
  if (detected !== hints.category) {
    warnings.push('category-wordcount-mismatch');
  }
}

/**
 * Token fold: consumes Token[] from the tokenizer, emits ProseBlock[].
 *
 * Emphasis model: two overlapping flags (em, strong). When text accumulates
 * while either flag is on, it becomes an emphasis run. When text accumulates
 * while BOTH flags are on, fire 'emphasis-mixed-style' once per manuscript.
 */
function foldTokensToBlocks(tokens: Token[], warnings: string[]): ProseBlock[] {
  const blocks: ProseBlock[] = [];

  let currentBlock: 'p' | 'h1' | 'h2' | 'h3' | null = null;
  let paragraphRuns: Run[] = [];
  let headingText = '';
  let emActive = false;
  let strongActive = false;
  let buffer = '';
  let mixedWarned = false;
  const unsupportedWarned = new Set<string>();

  const flushBuffer = (): void => {
    if (buffer.length === 0) return;
    if (currentBlock === 'p') {
      const isEmphasis = emActive || strongActive;
      paragraphRuns.push(
        isEmphasis
          ? { type: 'emphasis', text: buffer }
          : { type: 'text', text: buffer },
      );
    } else if (currentBlock !== null) {
      headingText += buffer;
    }
    buffer = '';
  };

  const closeBlock = (): void => {
    flushBuffer();
    if (currentBlock === 'p') {
      if (paragraphRuns.length > 0) {
        blocks.push({ type: 'paragraph', runs: paragraphRuns });
      }
    } else if (currentBlock !== null) {
      const trimmed = headingText.trim();
      if (trimmed.length > 0) {
        const chapter = classifyChapter(trimmed);
        if (chapter !== null) {
          blocks.push(chapter);
        } else {
          blocks.push({ type: 'chapter', title: trimmed });
        }
      }
    }
    currentBlock = null;
    paragraphRuns = [];
    headingText = '';
    emActive = false;
    strongActive = false;
  };

  for (const token of tokens) {
    switch (token.kind) {
      case 'blockOpen':
        if (currentBlock !== null) closeBlock(); // defensive
        currentBlock = token.tag;
        break;

      case 'blockClose':
        if (currentBlock === token.tag) closeBlock();
        break;

      case 'emphasisOpen':
        flushBuffer();
        if (token.style === 'em') emActive = true;
        else strongActive = true;
        break;

      case 'emphasisClose':
        if (buffer.length > 0 && emActive && strongActive && !mixedWarned) {
          warnings.push('emphasis-mixed-style');
          mixedWarned = true;
        }
        flushBuffer();
        if (token.style === 'em') emActive = false;
        else strongActive = false;
        break;

      case 'text':
        if (emActive && strongActive && token.text.length > 0 && !mixedWarned) {
          warnings.push('emphasis-mixed-style');
          mixedWarned = true;
        }
        buffer += token.text;
        break;

      case 'unsupportedBlock': {
        if (!unsupportedWarned.has(token.tag)) {
          warnings.push(`unsupported-block:${token.tag}`);
          unsupportedWarned.add(token.tag);
        }
        break;
      }
    }
  }

  if (currentBlock !== null) closeBlock();

  return blocks;
}