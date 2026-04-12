/**
 * DOCX HTML Tokenizer
 *
 * Consumes the narrow HTML fragment produced by mammoth.convertToHtml with its
 * default style map: <p>, <h1>-<h3>, <em>, <strong>, <br>, plus occasional
 * <ul>/<ol>/<li>/<table>/<a> that we do not support in v1.
 *
 * Pure function: (html: string) => Token[]. No warnings channel; unsupported
 * constructs surface as `unsupportedBlock` tokens and the docx parser folds
 * them into warnings using stable machine-readable keys.
 *
 * See SESSION_8_5_HANDOFF.md and the follow-up design pass for rationale on
 * token shape, <br> handling, entity decoding, and attribute skipping.
 */

export type Token =
  | { kind: 'blockOpen'; tag: 'p' | 'h1' | 'h2' | 'h3' }
  | { kind: 'blockClose'; tag: 'p' | 'h1' | 'h2' | 'h3' }
  | { kind: 'emphasisOpen'; style: 'em' | 'strong' }
  | { kind: 'emphasisClose'; style: 'em' | 'strong' }
  | { kind: 'text'; text: string }
  | { kind: 'unsupportedBlock'; tag: string };

export function tokenize(_html: string): Token[] {
  throw new Error('not implemented');
}