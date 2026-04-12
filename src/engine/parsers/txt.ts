import type {
  ProseManuscript,
  ContactBlock,
} from '../ir/prose';

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

export function parseTxt(input: string, hints?: ParseHints): ParseResult {
  void input;
  void hints;
  throw new Error('not implemented');
}