import { tokenize, type Token } from '../docx-html-tokenizer';

/**
 * These tests pin the token-stream shape produced by the hand-rolled tokenizer
 * that sits between mammoth.convertToHtml output and our DOCX parser's IR fold.
 *
 * Design decisions locked in Session 8.5:
 * - Emphasis tokens carry style discriminator ('em' | 'strong') so the parser
 *   can detect mixed-style structurally rather than via heuristics.
 * - <br> emits a text token containing '\n'. The formatter's docx library
 *   renders '\n' inside a text run as a line break, matching writer intent
 *   for Word soft-returns (Shift+Enter) inside paragraphs.
 * - Entity decoding covers named (&amp; &lt; &gt; &quot; &#39; &apos;) plus
 *   numeric decimal (&#123;) and hex (&#x7B;) forms.
 * - Unsupported block tags (<ul>, <ol>, <li>, <table>) emit
 *   `unsupportedBlock` tokens with the raw tag name. The parser dedupes and
 *   converts to stable machine-readable warning keys.
 * - <a> anchors strip to inner text, no warning (common, harmless).
 * - Attributes between tag name and '>' are skipped entirely. Assumes
 *   mammoth's output never contains '>' inside attribute values.
 */
describe('docx-html-tokenizer', () => {
  describe('block elements', () => {
    it('tokenizes a single paragraph with text', () => {
      expect(tokenize('<p>Hello world</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'Hello world' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('tokenizes consecutive paragraphs', () => {
      expect(tokenize('<p>One</p><p>Two</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'One' },
        { kind: 'blockClose', tag: 'p' },
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'Two' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it.each(['h1', 'h2', 'h3'] as const)('tokenizes %s heading', (tag) => {
      expect(tokenize(`<${tag}>Chapter</${tag}>`)).toEqual<Token[]>([
        { kind: 'blockOpen', tag },
        { kind: 'text', text: 'Chapter' },
        { kind: 'blockClose', tag },
      ]);
    });

    it('handles empty paragraphs', () => {
      expect(tokenize('<p></p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('returns empty array for empty input', () => {
      expect(tokenize('')).toEqual<Token[]>([]);
    });
  });

  describe('emphasis', () => {
    it('tokenizes <em> with style discriminator', () => {
      expect(tokenize('<p><em>word</em></p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'emphasisOpen', style: 'em' },
        { kind: 'text', text: 'word' },
        { kind: 'emphasisClose', style: 'em' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('tokenizes <strong> with style discriminator', () => {
      expect(tokenize('<p><strong>word</strong></p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'emphasisOpen', style: 'strong' },
        { kind: 'text', text: 'word' },
        { kind: 'emphasisClose', style: 'strong' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('tokenizes nested em inside strong preserving both styles', () => {
      // The parser detects mixed-style structurally from this pattern and
      // folds to a single IR emphasis run with a one-per-document warning.
      expect(tokenize('<p><strong><em>mixed</em></strong></p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'emphasisOpen', style: 'strong' },
        { kind: 'emphasisOpen', style: 'em' },
        { kind: 'text', text: 'mixed' },
        { kind: 'emphasisClose', style: 'em' },
        { kind: 'emphasisClose', style: 'strong' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('tokenizes mixed text and emphasis inline', () => {
      expect(tokenize('<p>plain <em>italic</em> plain</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'plain ' },
        { kind: 'emphasisOpen', style: 'em' },
        { kind: 'text', text: 'italic' },
        { kind: 'emphasisClose', style: 'em' },
        { kind: 'text', text: ' plain' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });
  });

  describe('<br> line breaks', () => {
    it('emits a newline text token for <br>', () => {
      expect(tokenize('<p>line one<br>line two</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'line one' },
        { kind: 'text', text: '\n' },
        { kind: 'text', text: 'line two' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('handles self-closing <br /> form', () => {
      expect(tokenize('<p>a<br />b</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'a' },
        { kind: 'text', text: '\n' },
        { kind: 'text', text: 'b' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });
  });

  describe('entity decoding', () => {
    it('decodes named entities', () => {
      expect(tokenize('<p>&amp; &lt; &gt; &quot; &#39; &apos;</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: `& < > " ' '` },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('decodes numeric decimal entities', () => {
      // &#123; is '{', &#125; is '}'
      expect(tokenize('<p>&#123;x&#125;</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: '{x}' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('decodes numeric hex entities (lowercase and uppercase x)', () => {
      // &#x7B; is '{', &#X7D; is '}'
      expect(tokenize('<p>&#x7B;x&#X7D;</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: '{x}' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('passes unknown named entities through literally', () => {
      // No silent data loss; parser tests can flag if mammoth produces these.
      expect(tokenize('<p>&nbsp;</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: '&nbsp;' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });
  });

  describe('unsupported tags', () => {
    it('emits unsupportedBlock for <ul> and drops inner content', () => {
      const out = tokenize('<ul><li>one</li><li>two</li></ul>');
      expect(out).toContainEqual<Token>({ kind: 'unsupportedBlock', tag: 'ul' });
      expect(out.some((t) => t.kind === 'text')).toBe(false);
    });

    it('emits unsupportedBlock for <ol>', () => {
      const out = tokenize('<ol><li>one</li></ol>');
      expect(out).toContainEqual<Token>({ kind: 'unsupportedBlock', tag: 'ol' });
    });

    it('emits unsupportedBlock for <table>', () => {
      const out = tokenize('<table><tr><td>cell</td></tr></table>');
      expect(out).toContainEqual<Token>({ kind: 'unsupportedBlock', tag: 'table' });
      expect(out.some((t) => t.kind === 'text')).toBe(false);
    });

    it('does not emit blockOpen/blockClose for unsupported tags', () => {
      const out = tokenize('<ul><li>x</li></ul>');
      expect(out.some((t) => t.kind === 'blockOpen')).toBe(false);
      expect(out.some((t) => t.kind === 'blockClose')).toBe(false);
    });
  });

  describe('anchors', () => {
    it('strips <a> to inner text with no warning', () => {
      expect(tokenize('<p>see <a href="http://x">link</a> here</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'see ' },
        { kind: 'text', text: 'link' },
        { kind: 'text', text: ' here' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('preserves emphasis inside anchors', () => {
      expect(tokenize('<p><a href="x"><em>linked</em></a></p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'emphasisOpen', style: 'em' },
        { kind: 'text', text: 'linked' },
        { kind: 'emphasisClose', style: 'em' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });
  });

  describe('attributes', () => {
    it('skips attributes on <p>', () => {
      expect(tokenize('<p class="foo" id="bar">hi</p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'hi' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('skips attributes on emphasis tags', () => {
      expect(tokenize('<p><em class="x">word</em></p>')).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'emphasisOpen', style: 'em' },
        { kind: 'text', text: 'word' },
        { kind: 'emphasisClose', style: 'em' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });

    it('skips attributes with single-quoted values', () => {
      expect(tokenize("<p class='foo'>hi</p>")).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'hi' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });
  });

  describe('realistic mammoth-like fragments', () => {
    it('tokenizes a heading followed by body paragraphs with emphasis', () => {
      const html =
        '<h1>Chapter One</h1>' +
        '<p>She said <em>hello</em>.</p>' +
        '<p>He said <strong>nothing</strong>.</p>';
      expect(tokenize(html)).toEqual<Token[]>([
        { kind: 'blockOpen', tag: 'h1' },
        { kind: 'text', text: 'Chapter One' },
        { kind: 'blockClose', tag: 'h1' },
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'She said ' },
        { kind: 'emphasisOpen', style: 'em' },
        { kind: 'text', text: 'hello' },
        { kind: 'emphasisClose', style: 'em' },
        { kind: 'text', text: '.' },
        { kind: 'blockClose', tag: 'p' },
        { kind: 'blockOpen', tag: 'p' },
        { kind: 'text', text: 'He said ' },
        { kind: 'emphasisOpen', style: 'strong' },
        { kind: 'text', text: 'nothing' },
        { kind: 'emphasisClose', style: 'strong' },
        { kind: 'text', text: '.' },
        { kind: 'blockClose', tag: 'p' },
      ]);
    });
  });
});