/**
 * Scene-break detection for prose parsers.
 *
 * Locked markers (Session 7, decision D2): a line whose trimmed content,
 * with inner whitespace collapsed to single spaces, equals one of:
 *   "#", "***", "* * *" (collapses to "***"), "~~~"
 * No blank-line-gap heuristic.
 */
export function isSceneBreakLine(line: string): boolean {
  throw new Error('not implemented');
}