/**
 * Scene-break detection for prose parsers.
 *
 * Locked markers (Session 7, decision D2): a line whose trimmed content,
 * with inner whitespace collapsed to single spaces, equals one of:
 *   "#", "***", "* * *" (collapses to "***"), "~~~"
 * No blank-line-gap heuristic.
 */

const SCENE_BREAK_MARKERS: ReadonlySet<string> = new Set([
  '#',
  '***',
  '* * *',
  '~~~',
]);

export function isSceneBreakLine(line: string): boolean {
  const normalized = line.trim().replace(/\s+/g, ' ');
  return SCENE_BREAK_MARKERS.has(normalized);
}