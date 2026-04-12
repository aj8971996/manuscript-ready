import type { ProseBlock } from '../ir/prose';

/**
 * D3 chapter regex (Session 7, locked; lifted to util in Session 8.5 per D4).
 *
 * Matches a line that *starts with* "chapter" followed by whitespace and
 * either an Arabic numeral, a Roman numeral, or a word-number up to twenty.
 * Anchored with ^ and \b so that "This is chapter one" mid-sentence does
 * not match once the caller has isolated the line and trimmed it.
 *
 * Shared by the TXT parser (line-level detection) and the DOCX parser
 * (heading-text detection after mammoth's Heading 1/2/3 → h1/h2/h3 map).
 * D4 requires "same regex as D3"; centralizing here prevents silent
 * divergence if the recognized word-forms are extended later.
 */
export const CHAPTER_REGEX =
  /^chapter\s+(?:(\d+)|([ivxlcdm]+)|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty))\b/i;

/**
 * Classify a single line as a chapter block, or return null.
 *
 * Precondition (encapsulated, not enforced by callers): input may contain
 * surrounding whitespace; this function trims before matching. Callers pass
 * raw lines or raw heading text without needing to know the regex is
 * line-anchored.
 *
 * Per D3: only Arabic numerals populate `chapter.number`. Roman numerals
 * and word-form numbers are recognized (so "Chapter IV" and "Chapter one"
 * produce a chapter block) but not decoded into a numeric value. This is
 * a deliberate v1 simplification; the formatter emits the chapter block
 * with an unset `number`, which downstream rendering handles.
 */
export function classifyChapter(
  line: string,
): Extract<ProseBlock, { type: 'chapter' }> | null {
  const match = CHAPTER_REGEX.exec(line.trim());
  if (!match) return null;

  const block: Extract<ProseBlock, { type: 'chapter' }> = { type: 'chapter' };

  const arabic = match[1];
  if (arabic !== undefined) {
    const n = Number.parseInt(arabic, 10);
    if (Number.isFinite(n)) block.number = n;
  }
  // Roman (match[2]) and word-form (match[3]) recognized but not decoded.

  return block;
}