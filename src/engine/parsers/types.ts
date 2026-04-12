/**
 * Shared parser types at the parsers-module boundary.
 *
 * Both parseTxt (parsers/txt.ts) and parseDocx (parsers/docx.ts) produce
 * ParseResult and consume ParseHints. Kept here rather than inside one
 * parser so neither imports from the other. The parsers barrel (Commit 9)
 * re-exports these alongside the parser functions.
 *
 * ParserError.kind is the closed set {'oversize','malformed','empty'} per D1;
 * no new kinds without updating D1 in the handoff first. ParserError.cause
 * is `unknown` (not `Error`) because mammoth rejections are promise
 * rejections whose rejection value is not guaranteed to be an Error instance.
 */

import type { ContactBlock, ProseManuscript } from '../ir/prose';

export type ParseHints = {
  title?: string;
  byline?: string;
  legalName?: string;
  contact?: ContactBlock;
  headerKeyword?: string;
};

export type ParserError = {
  kind: 'oversize' | 'malformed' | 'empty';
  message: string;
  cause?: unknown;
};

export type ParseResult =
  | { ok: true; manuscript: ProseManuscript; warnings: string[] }
  | { ok: false; error: ParserError };