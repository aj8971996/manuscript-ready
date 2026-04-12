/**
 * DOCX parser.
 *
 * Pipeline per D1/D9/D10: size/empty pre-checks -> mammoth.convertToHtml ->
 * tokenize (Commit 6 tokenizer) -> block-fold to ProseBlock[]. Never throws
 * across the engine boundary; failures surface as ParseResult.ok=false with
 * ParserError.kind in {'empty','oversize','malformed'}.
 *
 * D10 correction (Session 8.75): the handoff's externalFileAccess:false is
 * not a real mammoth option -- mammoth reads only from the provided buffer
 * and does not fetch external resources, so the flag would have been a no-op.
 * Replaced with includeDefaultStyleMap:true (real and required so Heading
 * 1/2/3 continues to map to h1/h2/h3 per D4).
 *
 * Heading emphasis: mammoth can emit <em>/<strong> inside h1/h2/h3. The IR's
 * chapter.title is a plain string, so emphasis inside headings is silently
 * flattened to text with no warning (Session 8.75 decision).
 *
 * Mammoth messages: each message emits one stable key ('mammoth-warning' or
 * 'mammoth-error'), not deduped. Human prose is dropped per the warning-keys
 * contract. Dedup, if desired, is the validation layer's concern.
 *
 * Option B (Session 8.75): an h1/h2/h3 whose text does not match
 * CHAPTER_REGEX becomes {type:'chapter', title} with number absent.
 * Prologue/epilogue/named-part headings flow through this path.
 */

import mammoth from 'mammoth';
import type { Metadata, ContactBlock, ProseBlock, Run } from '../ir/prose';
import { classifyChapter } from '../util/chapter-detect';
import { tokenize, type Token } from './docx-html-tokenizer';
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

  // TODO(rn): Buffer.from(input) -- swap to ArrayBuffer path when wiring to RN
  // (deferred tech debt #6). Buffer is a node-only API; the engine runs under
  // node env in tests where this is fine.
  const buffer = Buffer.from(input);

  let html: string;
  let mammothMessages: ReadonlyArray<{ type: string; message: string }>;
  try {
    const result = await mammoth.convertToHtml(
      { buffer },
      { includeDefaultStyleMap: true },
    );
    html = result.value;
    mammothMessages = result.messages as ReadonlyArray<{
      type: string;
      message: string;
    }>;
  } catch (cause) {
    return {
      ok: false,
      error: { kind: 'malformed', message: 'Failed to parse DOCX content.', cause },
    };
  }

  const warnings: string[] = foldMammothMessages(mammothMessages);
  const tokens = tokenize(html);
  const body = foldTokensToBlocks(tokens, warnings);
  const metadata = buildMetadata(hints);

  return {
    ok: true,
    manuscript: { schemaVersion: 1, metadata, body },
    warnings,
  };
}

function foldMammothMessages(
  messages: ReadonlyArray<{ type: string; message: string }>,
): string[] {
  const out: string[] = [];
  for (const msg of messages) {
    if (msg.type === 'warning') out.push('mammoth-warning');
    else if (msg.type === 'error') out.push('mammoth-error');
    // Unknown types pass silently; adding new keys requires updating
    // the warning-keys contract in the handoff first.
  }
  return out;
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

/**
 * Token fold: consumes Token[] from the tokenizer, emits ProseBlock[].
 *
 * Emphasis model: two overlapping flags (em, strong). When text accumulates
 * while either flag is on, it becomes an emphasis run. When text accumulates
 * while BOTH flags are on, fire 'emphasis-mixed-style' once per manuscript.
 * Structural, not nesting-based -- mammoth may emit <em><strong>x</strong></em>,
 * <strong><em>x</em></strong>, or overlapping sibling spans; all three surface
 * as "text appeared while em && strong".
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