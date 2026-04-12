import type { ProseBlock } from '../ir/prose';

/**
 * Counts words across all paragraph blocks in a manuscript body.
 *
 * - Only `paragraph` blocks contribute; chapter titles, scene breaks, and
 *   the-end markers are excluded. Chapter titles are not prose and would
 *   inflate counts for novels with many short chapters; excluding them
 *   keeps the short-story and novel rules consistent.
 * - Both `text` and `emphasis` runs count — emphasis is still words on
 *   the page.
 * - Tokenization joins run text with a space, trims, then splits on \s+.
 *   The join-with-space guards against runs that don't carry their own
 *   boundary whitespace; redundant spaces collapse in the split step, so
 *   counts stay correct either way.
 * - Rounding (e.g. Shunn's nearest-100 for short stories) is a formatter
 *   concern, not a counting concern. Keep this primitive honest.
 */
export function countWords(body: ProseBlock[]): number {
  let total = 0;
  for (const block of body) {
    if (block.type !== 'paragraph') continue;
    const text = block.runs.map((r) => r.text).join(' ').trim();
    if (text.length === 0) continue;
    total += text.split(/\s+/).length;
  }
  return total;
}