import { parseDocx } from '../docx';
import {
  buildDocx,
  buildNotZip,
  buildZipWithoutDocumentXml,
} from './fixtures/build-docx';

describe('parseDocx', () => {
  describe('error paths', () => {
    it('returns empty error for a zero-byte input (pre-mammoth check)', async () => {
      const result = await parseDocx(new Uint8Array(0));
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.kind).toBe('empty');
    });

    it('returns oversize error for inputs > 50 MB (D9, pre-mammoth check)', async () => {
      const oversize = new Uint8Array(50 * 1024 * 1024 + 1);
      const result = await parseDocx(oversize);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.kind).toBe('oversize');
    });

    it('returns malformed error for bytes that are not a ZIP', async () => {
      const result = await parseDocx(buildNotZip());
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.kind).toBe('malformed');
      expect(result.error.cause).toBeDefined();
    });

    it('returns malformed error for a valid ZIP missing word/document.xml', async () => {
      const bytes = await buildZipWithoutDocumentXml();
      const result = await parseDocx(bytes);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.kind).toBe('malformed');
      expect(result.error.cause).toBeDefined();
    });
  });

  describe('IR fold', () => {
    it('folds a plain paragraph into a paragraph block with a text run', async () => {
      const bytes = await buildDocx([
        { type: 'p', runs: [{ text: 'Hello world.' }] },
      ]);
      const result = await parseDocx(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.manuscript.body).toEqual([
        { type: 'paragraph', runs: [{ type: 'text', text: 'Hello world.' }] },
      ]);
    });

    it('folds an h1 with "Chapter 3" text into a chapter block with number 3', async () => {
      const bytes = await buildDocx([{ type: 'h1', text: 'Chapter 3' }]);
      const result = await parseDocx(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.manuscript.body).toContainEqual({ type: 'chapter', number: 3 });
    });

    it('folds <em> runs into emphasis runs', async () => {
      const bytes = await buildDocx([
        { type: 'p', runs: [
          { text: 'plain ' },
          { text: 'italic', em: true },
          { text: ' tail' },
        ] },
      ]);
      const result = await parseDocx(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      const para = result.manuscript.body[0];
      expect(para).toMatchObject({ type: 'paragraph' });
      if (para?.type !== 'paragraph') throw new Error('unreachable');
      expect(para.runs).toContainEqual({ type: 'emphasis', text: 'italic' });
    });

    it('folds <strong> runs into emphasis runs', async () => {
      const bytes = await buildDocx([
        { type: 'p', runs: [{ text: 'bold', strong: true }] },
      ]);
      const result = await parseDocx(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      const para = result.manuscript.body[0];
      if (para?.type !== 'paragraph') throw new Error('unreachable');
      expect(para.runs).toContainEqual({ type: 'emphasis', text: 'bold' });
    });

    it('collapses mixed bold+italic into one emphasis run + emphasis-mixed-style warning (D5)', async () => {
      const bytes = await buildDocx([
        { type: 'p', runs: [{ text: 'both', em: true, strong: true }] },
      ]);
      const result = await parseDocx(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      const para = result.manuscript.body[0];
      if (para?.type !== 'paragraph') throw new Error('unreachable');
      const emphasisRuns = para.runs.filter((r) => r.type === 'emphasis');
      expect(emphasisRuns).toHaveLength(1);
      expect(emphasisRuns[0]).toMatchObject({ type: 'emphasis', text: 'both' });
      expect(result.warnings).toContain('emphasis-mixed-style');
    });
  });

  describe('mammoth message fold', () => {
    it('emits a mammoth-warning key (not mammoth prose) when mammoth produces a warning', async () => {
      // A paragraph whose pStyle references an undefined style id causes
      // mammoth to emit "Unrecognised paragraph style" as a warning message.
      // We assemble this by hand rather than through buildDocx's BodyPart
      // API, which only exposes known styles.
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
      zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="UndefinedStyleXYZ"/></w:pPr><w:r><w:t>text</w:t></w:r></w:p>
  </w:body>
</w:document>`);
      const bytes = await zip.generateAsync({ type: 'uint8array' });

      const result = await parseDocx(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.warnings).toContain('mammoth-warning');
      // Human text MUST be dropped per the warning-keys contract.
      for (const w of result.warnings) {
        expect(w).not.toMatch(/Unrecognised/i);
      }
    });
  });

  describe('metadata hints', () => {
    it('honors hints when provided and defaults contact to freetext when absent (D7)', async () => {
      const bytes = await buildDocx([{ type: 'p', runs: [{ text: 'body' }] }]);

      const withHints = await parseDocx(bytes, {
        title: 'T',
        byline: 'B',
        legalName: 'L',
        contact: { mode: 'freetext', text: 'custom contact' },
      });
      expect(withHints.ok).toBe(true);
      if (!withHints.ok) throw new Error('unreachable');
      expect(withHints.manuscript.metadata.title).toBe('T');
      expect(withHints.manuscript.metadata.contact).toEqual({ mode: 'freetext', text: 'custom contact' });

      const noHints = await parseDocx(bytes);
      expect(noHints.ok).toBe(true);
      if (!noHints.ok) throw new Error('unreachable');
      expect(noHints.manuscript.metadata.contact).toEqual({
        mode: 'freetext',
        text: 'Contact information not provided',
      });
    });
  });
});