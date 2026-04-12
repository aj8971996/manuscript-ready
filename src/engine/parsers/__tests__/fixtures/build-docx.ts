/**
 * DOCX fixture helpers for parser tests.
 *
 * Uses jszip (already in devDependencies) to assemble minimal-but-valid DOCX
 * bytes for happy-path tests, and intentionally-broken variants for error-path
 * tests. Shared with Commit 9's integration smoke test per the handoff.
 *
 * Scope limit: buildDocx emits the subset of DOCX structures the v1 parser
 * cares about — paragraphs and Heading 1/2/3 paragraphs, with optional
 * em/strong runs. Lists, tables, and other unsupported constructs are
 * deliberately out of scope; the tokenizer already tests those at the HTML
 * level, and the parser's unsupported-block fold path is covered in Commit 8
 * with a targeted fixture once mammoth's exact emission is known.
 */

import JSZip from 'jszip';

export type RunSpec = {
  text: string;
  em?: boolean;
  strong?: boolean;
};

export type BodyPart =
  | { type: 'p'; runs: RunSpec[] }
  | { type: 'h1' | 'h2' | 'h3'; text: string };

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/**
 * Minimal styles.xml defining Heading 1/2/3 so mammoth's default style map
 * recognises paragraphs with those pStyle values and emits h1/h2/h3.
 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/></w:style>
</w:styles>`;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function runXml(run: RunSpec): string {
  const props: string[] = [];
  if (run.strong) props.push('<w:b/>');
  if (run.em) props.push('<w:i/>');
  const rPr = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
}

function paragraphXml(part: BodyPart): string {
  if (part.type === 'p') {
    const runs = part.runs.map(runXml).join('');
    return `<w:p>${runs}</w:p>`;
  }
  const styleId = part.type === 'h1' ? 'Heading1' : part.type === 'h2' ? 'Heading2' : 'Heading3';
  const run = runXml({ text: part.text });
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${run}</w:p>`;
}

function documentXml(body: BodyPart[]): string {
  const paragraphs = body.map(paragraphXml).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`;
}

/** Build a minimal valid DOCX containing the given body parts. */
export async function buildDocx(body: BodyPart[]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', ROOT_RELS_XML);
  zip.file('word/_rels/document.xml.rels', DOC_RELS_XML);
  zip.file('word/styles.xml', STYLES_XML);
  zip.file('word/document.xml', documentXml(body));
  return zip.generateAsync({ type: 'uint8array' });
}

/** Junk bytes that are not a ZIP file. Mammoth should reject. */
export function buildNotZip(): Uint8Array {
  return new TextEncoder().encode('this is not a docx file, just plain text bytes');
}

/**
 * A structurally-valid ZIP missing word/document.xml. Mammoth should reject
 * with "Could not find main document part" (issue #212 confirms this exact
 * error surface).
 */
export async function buildZipWithoutDocumentXml(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('readme.txt', 'valid zip, but not a docx (no word/document.xml)');
  return zip.generateAsync({ type: 'uint8array' });
}