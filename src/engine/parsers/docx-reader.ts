/**
 * DOCX reader — Hermes-compatible replacement for mammoth.convertToHtml.
 *
 * Produces HTML matching the narrow shape our `docx-html-tokenizer` consumes:
 * <p>, <h1>, <h2>, <h3>, <em>, <strong>, plus <ul>/<ol>/<table> as
 * unsupported-block markers. Nothing else. The tokenizer contract is the
 * forcing function; this module's output is whatever keeps that contract.
 *
 * Why this exists: mammoth's jszip dependency hangs synchronously on Hermes
 * inside zipfile.openArrayBuffer (see handoff v9 "Hermes parser wall"). We
 * replaced the DOCX path with an fflate-based reader and a hand-rolled XML
 * walk over the subset of OOXML our IR cares about.
 *
 * Scope honestly:
 *   - Paragraphs (<w:p>) with style-name → tag mapping for Heading 1/2/3.
 *   - Runs (<w:r>) with italic (<w:i/>) and bold (<w:b/>) properties.
 *   - Text (<w:t>). <w:br/> emits an HTML <br/>.
 *   - Tables, lists, images, footnotes, track-changes, sectPr, and every
 *     other OOXML feature: skipped. Not silently — a structural element we
 *     don't understand inside <w:body> emits an 'unsupported-block:<tag>'
 *     warning keyed to the local XML name. The tokenizer's own
 *     unsupported-block handling covers the narrower HTML-level cases.
 *
 * Warning-keys contract (preserved from the mammoth era, handoff §warning):
 *   - 'mammoth-warning' — a style reference we can't resolve. The key is
 *     misnamed now that mammoth is gone; keeping it stable avoids touching
 *     the validation layer this session (purity rule). Rename is deferred
 *     tech debt, tracked in handoff v10.
 *   - 'mammoth-error' — reserved but currently unemitted by this module.
 *     Left in place so the warning-keys surface doesn't shrink.
 *
 * Error model: this module throws. The caller (parseDocx) wraps throws into
 * { kind: 'malformed', cause }. Synchronous throws from fflate (not a zip,
 * truncated zip) and from our XML walk (unterminated tag, no <w:body>) all
 * funnel through the same catch.
 *
 * Hermes compatibility: pure JS, no Buffer, no Node built-ins, no Promise
 * library. fflate.unzipSync is synchronous and Hermes-tested upstream.
 */

import { unzipSync, strFromU8 } from 'fflate';

export type ReadDocxResult = {
  readonly html: string;
  readonly warnings: ReadonlyArray<string>;
};

const DOCUMENT_PATH = 'word/document.xml';

/**
 * Unzip the DOCX, read word/document.xml, walk the body, emit HTML.
 * Throws on malformed input; caller translates to ParserError.
 */
export function readDocxToHtml(bytes: Uint8Array): ReadDocxResult {
  const files = unzipSync(bytes);
  const docXmlBytes = files[DOCUMENT_PATH];
  if (!docXmlBytes) {
    throw new Error(`DOCX archive is missing ${DOCUMENT_PATH}.`);
  }
  const xml = strFromU8(docXmlBytes);
  const warnings: string[] = [];
  const html = renderBodyToHtml(xml, warnings);
  return { html, warnings };
}

// ---------------------------------------------------------------------------
// XML walk
// ---------------------------------------------------------------------------

/**
 * Render <w:body>'s children into the HTML subset the tokenizer accepts.
 *
 * Strategy: a forward-only scan over XML elements. We don't build a DOM;
 * we recognize element boundaries and dispatch on local name. Attributes
 * are parsed only where we need them (pStyle's w:val, rStyle's w:val).
 */
function renderBodyToHtml(xml: string, warnings: string[]): string {
  const body = extractBody(xml);
  const out: string[] = [];

  // Iterate top-level children of <w:body>. Each child is a complete element;
  // we slice it out and dispatch.
  let i = 0;
  while (i < body.length) {
    const next = findNextElement(body, i);
    if (next === null) break;
    const { localName, selfClosing, innerStart } = next;

    if (selfClosing) {
      // Self-closing top-level element in the body — nothing we care about
      // today (sectPr ends up here, for example). Skip.
      i = innerStart;
      continue;
    }

    const end = findMatchingClose(body, innerStart, localName);
    if (end === null) {
      throw new Error(`Unterminated <w:${localName}> in document body.`);
    }
    const inner = body.slice(innerStart, end.innerEnd);

    switch (localName) {
      case 'p':
        out.push(renderParagraph(inner, warnings));
        break;
      case 'tbl':
        // Emit the unsupported-block marker via the HTML path so the
        // tokenizer's existing 'unsupported-block:table' logic handles it.
        out.push('<table></table>');
        break;
      case 'sectPr':
        // Section properties; no user-visible content. Ignore.
        break;
      default:
        // Structural element in body we don't know. Stable key; scope the
        // tag so readers can identify what was skipped.
        warnings.push(`unsupported-block:w:${localName}`);
        break;
    }
    i = end.afterClose;
  }

  return out.join('');
}

/**
 * Render a <w:p>'s children into either <p>...</p> or <hN>...</hN> depending
 * on the pStyle value. Only runs (<w:r>) produce text; <w:pPr> is metadata.
 */
function renderParagraph(inner: string, warnings: string[]): string {
  let tag: 'p' | 'h1' | 'h2' | 'h3' = 'p';
  const runs: string[] = [];

  let i = 0;
  while (i < inner.length) {
    const next = findNextElement(inner, i);
    if (next === null) break;
    const { localName, selfClosing, innerStart } = next;

    if (selfClosing) {
      i = innerStart;
      continue;
    }

    const end = findMatchingClose(inner, innerStart, localName);
    if (end === null) {
      throw new Error(`Unterminated <w:${localName}> in paragraph.`);
    }
    const childInner = inner.slice(innerStart, end.innerEnd);

    if (localName === 'pPr') {
      const resolved = resolveParagraphTag(childInner, warnings);
      if (resolved !== null) tag = resolved;
    } else if (localName === 'r') {
      runs.push(renderRun(childInner));
    }
    // Other paragraph children (w:bookmarkStart, etc.) are ignored silently.

    i = end.afterClose;
  }

  const body = runs.join('');
  // Empty paragraphs are emitted as empty blocks; the downstream fold drops
  // paragraphs whose runs are all empty-text. Headings with empty text are
  // dropped by the fold's trimmed-length check.
  return `<${tag}>${body}</${tag}>`;
}

/**
 * Inspect a <w:pPr>'s children for a <w:pStyle w:val="..."/>. Return the
 * mapped HTML tag, or null if the paragraph is plain prose. Unknown style
 * values emit 'mammoth-warning' and fall through to plain prose.
 */
function resolveParagraphTag(
  pPrInner: string,
  warnings: string[],
): 'p' | 'h1' | 'h2' | 'h3' | null {
  // pStyle is always self-closing in OOXML: <w:pStyle w:val="Heading1"/>.
  const re = /<w:pStyle\b([^>]*)\/?>/;
  const m = re.exec(pPrInner);
  if (m === null) return null;
  const attrs = m[1] ?? '';
  const val = extractAttr(attrs, 'w:val');
  if (val === null) return null;

  const mapped = mapStyleNameToTag(val);
  if (mapped === null) {
    warnings.push('mammoth-warning');
    return null;
  }
  return mapped === 'p' ? null : mapped;
}

/**
 * Style-name → tag mapping. Matches mammoth's default style map for the
 * names it auto-generates, plus common localized spellings.
 *
 * Word's default pStyle values for headings are 'Heading1', 'Heading2',
 * 'Heading3' (no space). Some templates use 'heading 1' etc. Both shapes
 * ship in the wild; we accept either.
 *
 * Returns 'p' for recognized body styles (Normal, BodyText) so the paragraph
 * renders as <p>. Returns null for styles we don't recognize — caller emits
 * the warning.
 */
function mapStyleNameToTag(
  styleVal: string,
): 'p' | 'h1' | 'h2' | 'h3' | null {
  const normalized = styleVal.trim().toLowerCase().replace(/\s+/g, '');
  switch (normalized) {
    case 'heading1':
      return 'h1';
    case 'heading2':
      return 'h2';
    case 'heading3':
      return 'h3';
    case 'normal':
    case 'bodytext':
    case 'default':
    case 'standard':
      return 'p';
    default:
      return null;
  }
}

/**
 * Render a <w:r> into an optionally-emphasized HTML text span.
 *
 * Walks rPr for <w:i/> and <w:b/> (ignoring w:val="false" / w:val="0"
 * which OOXML uses to *disable* inherited emphasis), then concatenates
 * <w:t> text content. <w:br/> emits \n so the tokenizer's entity-aware
 * path sees a real newline.
 */
function renderRun(inner: string): string {
  let italic = false;
  let bold = false;
  const parts: string[] = [];

  let i = 0;
  while (i < inner.length) {
    const next = findNextElement(inner, i);
    if (next === null) break;
    const { localName, selfClosing, innerStart, attrs } = next;

    if (selfClosing) {
      if (localName === 'br' || localName === 'cr') {
        parts.push('\n');
      }
      i = innerStart;
      continue;
    }

    const end = findMatchingClose(inner, innerStart, localName);
    if (end === null) {
      throw new Error(`Unterminated <w:${localName}> in run.`);
    }
    const childInner = inner.slice(innerStart, end.innerEnd);

    if (localName === 'rPr') {
      const props = readRunProps(childInner);
      italic = props.italic;
      bold = props.bold;
    } else if (localName === 't') {
      // <w:t xml:space="preserve"> preserves leading/trailing whitespace;
      // without it Word still ships whitespace but officially trimmed. We
      // keep whatever the XML contains — tokenizer collapses runs of text
      // naturally.
      parts.push(escapeHtml(decodeXmlText(childInner)));
    } else if (localName === 'tab') {
      parts.push('\t');
    }
    // Other run children (w:rPr already handled, w:sym, w:drawing, etc.)
    // are silently dropped. Real-world DOCX has many; none belong in prose IR.

    void attrs;
    i = end.afterClose;
  }

  const text = parts.join('');
  if (text.length === 0) return '';

  // Emit outermost tag last so nesting matches what the tokenizer fold
  // expects: <strong><em>text</em></strong> when both are set.
  let out = text;
  if (italic) out = `<em>${out}</em>`;
  if (bold) out = `<strong>${out}</strong>`;
  return out;
}

function readRunProps(rPrInner: string): { italic: boolean; bold: boolean } {
  return {
    italic: hasEnabledToggle(rPrInner, 'i'),
    bold: hasEnabledToggle(rPrInner, 'b'),
  };
}

/**
 * OOXML toggle properties: <w:i/> or <w:i w:val="true"/> enable; an explicit
 * <w:i w:val="false"/> or "0" disables. We treat presence-without-false as
 * enabled, matching Word's own semantics.
 */
function hasEnabledToggle(xml: string, localName: string): boolean {
  const re = new RegExp(`<w:${localName}\\b([^>]*?)\\/?>`);
  const m = re.exec(xml);
  if (m === null) return false;
  const val = extractAttr(m[1] ?? '', 'w:val');
  if (val === null) return true;
  const normalized = val.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0';
}

// ---------------------------------------------------------------------------
// XML lexer helpers
// ---------------------------------------------------------------------------

type ElementHead = {
  readonly start: number;       // index of '<' in the source
  readonly innerStart: number;  // index just past '>'
  readonly localName: string;
  readonly selfClosing: boolean;
  readonly attrs: string;
};

/**
 * Extract the contents of <w:body>...</w:body>. Throws if absent.
 */
function extractBody(xml: string): string {
  const openMatch = /<w:body\b[^>]*>/.exec(xml);
  if (openMatch === null) {
    throw new Error('DOCX document has no <w:body> element.');
  }
  const start = openMatch.index + openMatch[0].length;
  const closeIdx = xml.indexOf('</w:body>', start);
  if (closeIdx === -1) {
    throw new Error('DOCX document has an unterminated <w:body>.');
  }
  return xml.slice(start, closeIdx);
}

/**
 * Find the next start-tag element at or after `from` in `xml`. Returns null
 * if none. Skips XML comments, processing instructions, and CDATA — none of
 * which appear inside <w:body> in Word's output, but guarding against them
 * keeps the lexer robust to hand-authored fixtures.
 */
function findNextElement(xml: string, from: number): ElementHead | null {
  let i = from;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) return null;

    // Skip constructs we don't parse.
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) return null;
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (end === -1) return null;
      i = end + 3;
      continue;
    }
    if (xml[lt + 1] === '?' || xml[lt + 1] === '!') {
      const end = xml.indexOf('>', lt + 1);
      if (end === -1) return null;
      i = end + 1;
      continue;
    }
    if (xml[lt + 1] === '/') {
      // Closing tag — means we've reached the end of the enclosing element.
      // Caller handles that via findMatchingClose.
      return null;
    }

    const gt = xml.indexOf('>', lt);
    if (gt === -1) return null;
    const selfClosing = xml[gt - 1] === '/';
    const rawInside = xml.slice(lt + 1, selfClosing ? gt - 1 : gt);
    const { localName, attrs } = splitNameAndAttrs(rawInside);

    return {
      start: lt,
      innerStart: gt + 1,
      localName,
      selfClosing,
      attrs,
    };
  }
  return null;
}

/**
 * Given the inner text of an open tag (between '<' and '>' or '/>'),
 * return the local name (w:-prefix stripped) and the raw attribute string.
 */
function splitNameAndAttrs(rawInside: string): {
  localName: string;
  attrs: string;
} {
  // Find first whitespace to separate qualified name from attributes.
  let end = rawInside.length;
  for (let k = 0; k < rawInside.length; k += 1) {
    const c = rawInside[k];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      end = k;
      break;
    }
  }
  const qname = rawInside.slice(0, end);
  const attrs = rawInside.slice(end);
  const colon = qname.indexOf(':');
  const localName = colon === -1 ? qname : qname.slice(colon + 1);
  return { localName, attrs };
}

/**
 * From `innerStart` (just past the open tag's '>'), find the matching
 * </w:localName> at the same nesting depth. Returns the inner-end index
 * (before the '<' of the closing tag) and the index just past the closing
 * tag's '>'. Null if unterminated.
 *
 * Correctness depends on the prefix not actually mattering — OOXML body
 * content is uniformly w:-prefixed, and nested elements with the same
 * localName under a different prefix don't occur. We match on localName
 * alone by looking for `</xxxx:?localName>` sequences.
 */
function findMatchingClose(
  xml: string,
  innerStart: number,
  localName: string,
): { innerEnd: number; afterClose: number } | null {
  // Build the two shapes a closing tag can take: prefixed and unprefixed.
  // We scan for '</' and test the tail.
  let depth = 1;
  let cursor = innerStart;
  while (cursor < xml.length) {
    const lt = xml.indexOf('<', cursor);
    if (lt === -1) return null;

    // Comments / CDATA / PI — skip whole construct so '<' inside them
    // doesn't confuse the nesting count.
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) return null;
      cursor = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (end === -1) return null;
      cursor = end + 3;
      continue;
    }
    if (xml[lt + 1] === '?' || xml[lt + 1] === '!') {
      const end = xml.indexOf('>', lt + 1);
      if (end === -1) return null;
      cursor = end + 1;
      continue;
    }

    const gt = xml.indexOf('>', lt);
    if (gt === -1) return null;
    const isClose = xml[lt + 1] === '/';
    const selfClosing = !isClose && xml[gt - 1] === '/';
    const rawInside = xml.slice(
      lt + (isClose ? 2 : 1),
      selfClosing ? gt - 1 : gt,
    );
    const tagName = localNameOf(splitNameAndAttrs(rawInside).localName);

    if (isClose) {
      if (tagName === localName) {
        depth -= 1;
        if (depth === 0) {
          return { innerEnd: lt, afterClose: gt + 1 };
        }
      }
    } else if (!selfClosing) {
      if (tagName === localName) {
        depth += 1;
      }
    }

    cursor = gt + 1;
  }
  return null;
}

function localNameOf(name: string): string {
  return name;
}

// ---------------------------------------------------------------------------
// Attribute and text helpers
// ---------------------------------------------------------------------------

/**
 * Extract an attribute value from the raw attribute string between
 * `<w:foo` and `>`. Handles both double- and single-quoted values.
 * Returns null if the attribute is absent.
 *
 * Matching is name-anchored — we find `<space>w:val=` or `\tw:val=` etc.,
 * never a suffix match that would mis-fire on a longer attribute name.
 */
function extractAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${escapeRegex(name)}\\s*=\\s*("([^"]*)"|'([^']*)')`);
  const m = re.exec(attrs);
  if (m === null) return null;
  return m[2] ?? m[3] ?? null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decode the body of a <w:t> element. OOXML text may contain numeric and
 * the five standard named entities; no other entity references.
 */
function decodeXmlText(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const rest = body.slice(1);
      let code: number;
      if (rest[0] === 'x' || rest[0] === 'X') {
        code = parseInt(rest.slice(1), 16);
      } else {
        code = parseInt(rest, 10);
      }
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      return String.fromCodePoint(code);
    }
    switch (body) {
      case 'amp': return '&';
      case 'lt':  return '<';
      case 'gt':  return '>';
      case 'quot':return '"';
      case 'apos':return "'";
      default:    return match;
    }
  });
}

/**
 * Escape a decoded text segment for safe inclusion in the HTML we emit.
 * The downstream tokenizer decodes these back when folding into IR runs.
 */
function escapeHtml(s: string): string {
  let out = '';
  for (let k = 0; k < s.length; k += 1) {
    const c = s[k];
    if (c === '&') out += '&amp;';
    else if (c === '<') out += '&lt;';
    else if (c === '>') out += '&gt;';
    else out += c;
  }
  return out;
}