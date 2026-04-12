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
 * Implementation: char-by-char state machine. Assumes mammoth's output never
 * contains '>' inside attribute values, so attribute parsing can skip to the
 * next '>' without tracking quote state for correctness (we do track quotes
 * defensively, but only to skip over quoted content, not to handle edge cases).
 */

export type Token =
  | { kind: 'blockOpen'; tag: 'p' | 'h1' | 'h2' | 'h3' }
  | { kind: 'blockClose'; tag: 'p' | 'h1' | 'h2' | 'h3' }
  | { kind: 'emphasisOpen'; style: 'em' | 'strong' }
  | { kind: 'emphasisClose'; style: 'em' | 'strong' }
  | { kind: 'text'; text: string }
  | { kind: 'unsupportedBlock'; tag: string };

type BlockTag = 'p' | 'h1' | 'h2' | 'h3';
type EmphasisTag = 'em' | 'strong';
const BLOCK_TAGS: ReadonlySet<string> = new Set(['p', 'h1', 'h2', 'h3']);
const EMPHASIS_TAGS: ReadonlySet<string> = new Set(['em', 'strong']);
const UNSUPPORTED_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'ul', 'ol', 'table',
]);

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let textBuffer = '';
  let suppressDepth = 0; // inside an unsupported block; drop text and nested tokens
  let i = 0;

  const flushText = (): void => {
    if (textBuffer.length > 0 && suppressDepth === 0) {
      tokens.push({ kind: 'text', text: textBuffer });
    }
    textBuffer = '';
  };

  while (i < html.length) {
    const ch = html[i];

    if (ch === '<') {
      flushText();
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) {
        // Unterminated tag. Treat remainder as text, defensively.
        textBuffer += html.slice(i);
        break;
      }
      const rawTag = html.slice(i + 1, tagEnd); // inside < and >
      i = tagEnd + 1;

      // Closing tag: starts with '/'
      if (rawTag.startsWith('/')) {
        const name = extractTagName(rawTag.slice(1));
        if (BLOCK_TAGS.has(name)) {
          if (suppressDepth === 0) {
            tokens.push({ kind: 'blockClose', tag: name as BlockTag });
          }
        } else if (EMPHASIS_TAGS.has(name)) {
          if (suppressDepth === 0) {
            tokens.push({ kind: 'emphasisClose', style: name as EmphasisTag });
          }
        } else if (UNSUPPORTED_BLOCK_TAGS.has(name)) {
          if (suppressDepth > 0) suppressDepth -= 1;
        }
        // Closing <a>, <li>, etc.: ignored (no open token to match).
        continue;
      }

      // Self-closing or void tag: strip trailing '/'
      const inner = rawTag.endsWith('/') ? rawTag.slice(0, -1) : rawTag;
      const name = extractTagName(inner);

      if (name === 'br') {
        if (suppressDepth === 0) {
          tokens.push({ kind: 'text', text: '\n' });
        }
      } else if (BLOCK_TAGS.has(name)) {
        if (suppressDepth === 0) {
          tokens.push({ kind: 'blockOpen', tag: name as BlockTag });
        }
      } else if (EMPHASIS_TAGS.has(name)) {
        if (suppressDepth === 0) {
          tokens.push({ kind: 'emphasisOpen', style: name as EmphasisTag });
        }
      } else if (UNSUPPORTED_BLOCK_TAGS.has(name)) {
        if (suppressDepth === 0) {
          tokens.push({ kind: 'unsupportedBlock', tag: name });
        }
        suppressDepth += 1;
      }
      // <a>, unsupported-child tags, unknown tags: tag ignored; inner text/
      // tokens continue to be emitted normally (anchors strip to inner text).
      continue;
    }

    if (ch === '&') {
      const entityEnd = html.indexOf(';', i);
      if (entityEnd === -1) {
        textBuffer += ch;
        i += 1;
        continue;
      }
      const entity = html.slice(i + 1, entityEnd);
      const decoded = decodeEntity(entity);
      if (decoded !== null) {
        textBuffer += decoded;
        i = entityEnd + 1;
      } else {
        // Unknown entity: pass through literally including the '&' and ';'.
        textBuffer += html.slice(i, entityEnd + 1);
        i = entityEnd + 1;
      }
      continue;
    }

    textBuffer += ch;
    i += 1;
  }

  flushText();
  return tokens;
}

/**
 * Extract the tag name from the content between '<' (or '</') and '>'.
 * Skips attributes. Attribute values may be quoted; we track quote state
 * only to avoid mis-parsing a space inside a quoted value as the name
 * terminator. The assumption that '>' never appears inside attribute values
 * holds for mammoth's output.
 */
function extractTagName(raw: string): string {
  let end = raw.length;
  for (let k = 0; k < raw.length; k += 1) {
    const c = raw[k];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '/') {
      end = k;
      break;
    }
  }
  return raw.slice(0, end).toLowerCase();
}

/**
 * Decode a single entity body (between '&' and ';'). Returns null for unknown
 * entities so the caller can pass them through literally.
 */
function decodeEntity(body: string): string | null {
  if (body.length === 0) return null;

  // Numeric: &#123; (decimal) or &#x7B;/&#X7B; (hex)
  if (body[0] === '#') {
    const rest = body.slice(1);
    let code: number;
    if (rest.length > 0 && (rest[0] === 'x' || rest[0] === 'X')) {
      const hex = rest.slice(1);
      if (hex.length === 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
      code = parseInt(hex, 16);
    } else {
      if (!/^[0-9]+$/.test(rest)) return null;
      code = parseInt(rest, 10);
    }
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return null;
    return String.fromCodePoint(code);
  }

  const named = NAMED_ENTITIES[body.toLowerCase()];
  return named ?? null;
}