import type { ParseHints, ParseResult} from './types';

export type { ParseHints, ParseResult, ParserError } from './types';

/**
 * DOCX parser (Commit 7 stub; Commit 8 implements).
 *
 * Contract per D1/D9/D10:
 *   - Input: Uint8Array, max 50 MB (D9, pre-mammoth byteLength check).
 *   - Output: Promise<ParseResult>. Never throws across the engine boundary.
 *   - Mammoth call: convertToHtml({buffer: Buffer.from(input)}, {externalFileAccess: false}).
 *   - result.messages fold into warnings[] as stable keys:
 *       'mammoth-warning' | 'mammoth-error'  (human text dropped).
 *   - Chapter detection: classifyChapter on h1/h2/h3 text (D4, same regex as D3).
 *   - Emphasis: <em>/<strong> → IR emphasis; co-located → one emphasis run
 *     plus 'emphasis-mixed-style' warning (D5).
 *   - Unsupported blocks: 'unsupported-block:<tag>' keys, deduped per tag.
 *   - ParserError.kind ∈ {'empty','oversize','malformed'}; no new kinds.
 *
 * TODO(rn): Buffer.from(input) — swap to ArrayBuffer path when wiring to RN
 * (deferred tech debt #6 in the handoff).
 */
export function parseDocx(
  _input: Uint8Array,
  _hints?: ParseHints,
): Promise<ParseResult> {
  throw new Error('parseDocx not yet implemented (Commit 7 stub; Commit 8 lands impl)');
}