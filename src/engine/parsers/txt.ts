import type {
  Metadata,
  ContactBlock,
  ProseBlock,
  Run,
} from '../ir/prose';
import { isSceneBreakLine } from '../util/scene-detect';
import { classifyChapter } from '../util/chapter-detect';
import type { ParseHints, ParseResult } from './types';

export type { ParseHints, ParseResult, ParserError } from './types';

/** D5 emphasis tokenizer: **bold**, *italic*, _italic_, all → emphasis. */
const EMPHASIS_REGEX = /\*\*([^*]+?)\*\*|\*([^*\n]+?)\*|_([^_\n]+?)_/g;

/** Detects residual markers inside an emphasis span → nested emphasis warning. */
const NESTED_MARKER_REGEX = /\*|_/;

const DEFAULT_CONTACT: ContactBlock = {
  mode: 'freetext',
  text: 'Contact information not provided',
};

export function parseTxt(input: string, hints?: ParseHints): ParseResult {
  const warnings: string[] = [];

  if (input.trim().length === 0) {
    return {
      ok: false,
      error: { kind: 'empty', message: 'Input contains no non-whitespace content.' },
    };
  }

  const metadata = buildMetadata(hints, warnings);
  const body = parseBody(input, warnings);

  return {
    ok: true,
    manuscript: { schemaVersion: 1, metadata, body },
    warnings,
  };
}

function buildMetadata(hints: ParseHints | undefined, warnings: string[]): Metadata {
  const title = hints?.title ?? '';
  const byline = hints?.byline ?? '';
  const legalName = hints?.legalName ?? '';

  if (!hints?.title) warnings.push('Metadata: title not provided; defaulted to empty.');
  if (!hints?.byline) warnings.push('Metadata: byline not provided; defaulted to empty.');
  if (!hints?.legalName) {
    warnings.push('Metadata: legalName not provided; defaulted to empty.');
  }

  const metadata: Metadata = {
    title,
    byline,
    legalName,
    contact: hints?.contact ?? DEFAULT_CONTACT,
  };

  if (hints?.headerKeyword !== undefined) {
    metadata.headerKeyword = hints.headerKeyword;
  }

  return metadata;
}

function parseBody(input: string, warnings: string[]): ProseBlock[] {
  const groups = groupLines(input);
  const blocks: ProseBlock[] = [];
  let nestedWarned = false;

  for (const group of groups) {
    if (group.length === 1) {
      const line = group[0]!;
      if (isSceneBreakLine(line)) {
        blocks.push({ type: 'sceneBreak' });
        continue;
      }
      const chapter = classifyChapter(line);
      if (chapter !== null) {
        blocks.push(chapter);
        continue;
      }
    }

    const joined = group.join(' ');
    const { runs, sawNested } = tokenizeEmphasis(joined);
    if (sawNested && !nestedWarned) {
      warnings.push('Emphasis: nested emphasis detected; collapsed to a single level.');
      nestedWarned = true;
    }
    blocks.push({ type: 'paragraph', runs });
  }

  return blocks;
}

function groupLines(input: string): string[][] {
  const lines = input.split('\n');
  const groups: string[][] = [];
  let current: string[] = [];

  for (const raw of lines) {
    if (raw.trim().length === 0) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(raw);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function tokenizeEmphasis(text: string): { runs: Run[]; sawNested: boolean } {
  const runs: Run[] = [];
  let sawNested = false;
  let lastIndex = 0;

  EMPHASIS_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMPHASIS_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    const inner = match[1] ?? match[2] ?? match[3] ?? '';
    if (NESTED_MARKER_REGEX.test(inner)) {
      sawNested = true;
      runs.push({ type: 'emphasis', text: inner.replace(/[*_]/g, '') });
    } else {
      runs.push({ type: 'emphasis', text: inner });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push({ type: 'text', text: text.slice(lastIndex) });
  }

  if (runs.length === 0) runs.push({ type: 'text', text });

  return { runs, sawNested };
}