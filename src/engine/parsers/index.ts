/**
 * Parsers barrel -- the blessed import surface for the parsers module.
 *
 * Consumers (app code, validation layer, integration tests) import from
 * here rather than reaching into individual parser files. The per-file
 * type re-exports in parsers/txt.ts and parsers/docx.ts remain as
 * secondary paths and are intentionally not removed; both paths work.
 */

export { parseTxt } from './txt';
export { parseDocx } from './docx';
export type { ParseHints, ParseResult, ParserError } from './types';