/**
 * import-flow tests — step 3a of commit 4.
 *
 * Written test-first; `../import-flow` does not yet exist. Running this file
 * before the implementation lands will fail at module resolution. That is
 * expected and the next step is to satisfy it.
 *
 * Scope: the pure async orchestrator that routes bytes → parser → adapter.
 * All RN-requiring concerns (document picker, file-system reads, routing)
 * live in `app/import.tsx` (step 3b) and are exercised on-device.
 *
 * Tests 1–13 mock both parsers to exercise orchestration logic in isolation.
 * Test 14 composes real `parseDocx` with real bytes from the engine's
 * `buildDocx` fixture-builder to catch any drift at the parser/orchestrator
 * seam that unit doubles can't see.
 */
import {
  createInMemoryAdapter,
  PersistenceFailure,
  SCHEMA_VERSION,
  type InsertManuscriptInput,
  type PersistenceAdapter,
} from '../../persistence';
import type { Category } from '../../engine-dispatch';
import type { ProseManuscript } from '../../../engine/ir/prose';
import type {
  ParseHints,
  ParseResult,
  ParserError,
} from '../../../engine/parsers';
import { parseDocx as realParseDocx } from '../../../engine/parsers';
import { buildDocx } from '../../../engine/parsers/__tests__/fixtures/build-docx';

import { importFromBytes, type ImportDeps } from '../import-flow';

// ---------- helpers ----------

const FIXED_ID = '00000000-0000-4000-8000-000000000001';
const FIXED_CLOCK = 1_700_000_000_000;

function makeIr(
  overrides: Partial<ProseManuscript['metadata']> = {},
): ProseManuscript {
  return {
    schemaVersion: 1,
    metadata: {
      title: 'Test Title',
      byline: 'Test Byline',
      legalName: 'Test Legal Name',
      contact: { mode: 'freetext', text: 'test@example.com' },
      category: 'short-story',
      ...overrides,
    },
    body: [
      { type: 'paragraph', runs: [{ type: 'text', text: 'Hello world.' }] },
    ],
  };
}

async function makeInitializedAdapter(): Promise<PersistenceAdapter> {
  const a = createInMemoryAdapter();
  await a.init();
  return a;
}

function staticParseDocx(
  result: ParseResult | (() => Promise<ParseResult>),
) {
  return jest.fn(
    async (_bytes: Uint8Array, _hints?: ParseHints): Promise<ParseResult> => {
      if (typeof result === 'function') return result();
      return result;
    },
  );
}

function staticParseTxt(result: ParseResult) {
  return jest.fn((_text: string, _hints?: ParseHints): ParseResult => result);
}

function defaultDeps(overrides: Partial<ImportDeps> = {}): ImportDeps {
  return {
    generateId: () => FIXED_ID,
    now: () => FIXED_CLOCK,
    ...overrides,
  };
}

// ---------- tests ----------

describe('importFromBytes — golden paths', () => {
  it('persists a parsed .docx and returns its id', async () => {
    const adapter = await makeInitializedAdapter();
    const ir = makeIr({ title: 'My Story', category: 'short-story' });
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: ir,
      warnings: [],
    });

    const res = await importFromBytes(
      new Uint8Array([0x50, 0x4b]),
      'my-story.docx',
      'short-story',
      adapter,
      defaultDeps({ parseDocx }),
    );

    expect(res).toEqual({ ok: true, id: FIXED_ID });
    expect(parseDocx).toHaveBeenCalledTimes(1);

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(FIXED_ID);
    expect(row!.schemaVersion).toBe(SCHEMA_VERSION);
    expect(row!.title).toBe('My Story');
    expect(row!.category).toBe('short-story');
    expect(row!.createdAt).toBe(FIXED_CLOCK);
    expect(JSON.parse(row!.irJson)).toEqual(ir);
  });

  it('persists a parsed .txt and returns its id', async () => {
    const adapter = await makeInitializedAdapter();
    const ir = makeIr({ title: 'Txt Story', category: 'novelette' });
    const parseTxt = staticParseTxt({
      ok: true,
      manuscript: ir,
      warnings: [],
    });

    const res = await importFromBytes(
      new TextEncoder().encode('Chapter 1\n\nHello.'),
      'txt-story.txt',
      'novelette',
      adapter,
      defaultDeps({ parseTxt }),
    );

    expect(res).toEqual({ ok: true, id: FIXED_ID });
    expect(parseTxt).toHaveBeenCalledTimes(1);

    // Confirm the default TextDecoder path ran — parseTxt received a string,
    // not raw bytes — and the content survived the decode.
    const firstCall = parseTxt.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(typeof firstCall![0]).toBe('string');
    expect(firstCall![0]).toContain('Hello.');

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row!.title).toBe('Txt Story');
  });
});

describe('importFromBytes — parser failure modes', () => {
  it('returns parse-error when the parser yields ok:false', async () => {
    const adapter = await makeInitializedAdapter();
    const error: ParserError = { kind: 'empty', message: 'Zero bytes.' };
    const parseDocx = staticParseDocx({ ok: false, error });

    const res = await importFromBytes(
      new Uint8Array(0),
      'x.docx',
      'short-story',
      adapter,
      defaultDeps({ parseDocx }),
    );

    expect(res).toEqual({
      ok: false,
      failure: { kind: 'parse-error', error },
    });
    expect((await adapter.listManuscripts()).length).toBe(0);
  });

  it('returns parse-exception when the parser promise rejects', async () => {
    const adapter = await makeInitializedAdapter();
    const boom = new Error('zip corrupt');
    const parseDocx = staticParseDocx(() => Promise.reject(boom));

    const res = await importFromBytes(
      new Uint8Array([1, 2, 3]),
      'x.docx',
      'short-story',
      adapter,
      defaultDeps({ parseDocx }),
    );

    expect(res).toEqual({
      ok: false,
      failure: { kind: 'parse-exception', cause: boom },
    });
    expect((await adapter.listManuscripts()).length).toBe(0);
  });

  it('returns unsupported-file for extensions other than .docx / .txt', async () => {
    const adapter = await makeInitializedAdapter();
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr(),
      warnings: [],
    });
    const parseTxt = staticParseTxt({
      ok: true,
      manuscript: makeIr(),
      warnings: [],
    });

    const res = await importFromBytes(
      new Uint8Array([1]),
      'report.pdf',
      'short-story',
      adapter,
      defaultDeps({ parseDocx, parseTxt }),
    );

    expect(res).toEqual({
      ok: false,
      failure: { kind: 'unsupported-file', filename: 'report.pdf' },
    });
    expect(parseDocx).not.toHaveBeenCalled();
    expect(parseTxt).not.toHaveBeenCalled();
    expect((await adapter.listManuscripts()).length).toBe(0);
  });
});

describe('importFromBytes — persistence failure modes', () => {
  it('wraps storage-failure as persist-error', async () => {
    const base = await makeInitializedAdapter();
    const cause = new Error('disk full');
    const failingAdapter: PersistenceAdapter = {
      ...base,
      async insertManuscript(_input: InsertManuscriptInput) {
        throw new PersistenceFailure({ kind: 'storage-failure', cause });
      },
    };
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr(),
      warnings: [],
    });

    const res = await importFromBytes(
      new Uint8Array([1]),
      'x.docx',
      'short-story',
      failingAdapter,
      defaultDeps({ parseDocx }),
    );

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('unreachable');
    expect(res.failure).toEqual({
      kind: 'persist-error',
      cause: { kind: 'storage-failure', cause },
    });
  });

  it('wraps id-collision as persist-error with collision detail', async () => {
    const adapter = await makeInitializedAdapter();
    await adapter.insertManuscript({
      id: FIXED_ID,
      schemaVersion: SCHEMA_VERSION,
      title: 'Existing',
      category: 'short-story',
      irJson: JSON.stringify(makeIr()),
      createdAt: 1,
    });

    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr(),
      warnings: [],
    });

    const res = await importFromBytes(
      new Uint8Array([1]),
      'x.docx',
      'short-story',
      adapter,
      defaultDeps({ parseDocx }),
    );

    expect(res).toEqual({
      ok: false,
      failure: {
        kind: 'persist-error',
        cause: { kind: 'id-collision', id: FIXED_ID },
      },
    });
    expect((await adapter.listManuscripts()).length).toBe(1);
  });
});

describe('importFromBytes — title derivation', () => {
  it('uses IR metadata title when non-empty', async () => {
    const adapter = await makeInitializedAdapter();
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr({ title: 'Explicit Title' }),
      warnings: [],
    });

    await importFromBytes(
      new Uint8Array([1]),
      'fallback-name.docx',
      'short-story',
      adapter,
      defaultDeps({ parseDocx }),
    );

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row!.title).toBe('Explicit Title');
  });

  it('falls back to filename stem when IR title is whitespace-only', async () => {
    const adapter = await makeInitializedAdapter();
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr({ title: '   ' }),
      warnings: [],
    });

    await importFromBytes(
      new Uint8Array([1]),
      'The Great Story.docx',
      'short-story',
      adapter,
      defaultDeps({ parseDocx }),
    );

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row!.title).toBe('The Great Story');
  });

  it('strips only the last extension from the filename stem', async () => {
    const adapter = await makeInitializedAdapter();
    const parseTxt = staticParseTxt({
      ok: true,
      manuscript: makeIr({ title: '' }),
      warnings: [],
    });

    await importFromBytes(
      new TextEncoder().encode('x'),
      'notes.final.txt',
      'short-story',
      adapter,
      defaultDeps({ parseTxt }),
    );

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row!.title).toBe('notes.final');
  });
});

describe('importFromBytes — category + invariants', () => {
  it('records category from the parsed IR, not the parameter', async () => {
    const adapter = await makeInitializedAdapter();
    // IR says novel; parameter says short-story. IR wins.
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr({ category: 'novel' }),
      warnings: [],
    });

    await importFromBytes(
      new Uint8Array([1]),
      'x.docx',
      'short-story' as Category,
      adapter,
      defaultDeps({ parseDocx }),
    );

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row!.category).toBe('novel');
  });

  it('passes the parameter category to the parser as hints.category', async () => {
    const adapter = await makeInitializedAdapter();
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr(),
      warnings: [],
    });

    await importFromBytes(
      new Uint8Array([1]),
      'x.docx',
      'novelette',
      adapter,
      defaultDeps({ parseDocx }),
    );

    const firstCall = parseDocx.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(firstCall![1]?.category).toBe('novelette');
  });

  it('honors injected generateId and now', async () => {
    const adapter = await makeInitializedAdapter();
    const parseDocx = staticParseDocx({
      ok: true,
      manuscript: makeIr(),
      warnings: [],
    });
    const generateId = jest.fn(() => 'custom-id-xyz');
    const now = jest.fn(() => 42);

    const res = await importFromBytes(
      new Uint8Array([1]),
      'x.docx',
      'short-story',
      adapter,
      { parseDocx, generateId, now },
    );

    expect(res).toEqual({ ok: true, id: 'custom-id-xyz' });
    expect(generateId).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);

    const row = await adapter.getManuscriptById('custom-id-xyz');
    expect(row!.createdAt).toBe(42);
  });
});

describe('importFromBytes — integration (real engine, real in-memory adapter)', () => {
  it('round-trips a built .docx through parseDocx and the adapter', async () => {
    const adapter = await makeInitializedAdapter();
    const bytes = await buildDocx([
      { type: 'h1', text: 'Chapter 1' },
      {
        type: 'p',
        runs: [
          { text: 'The first paragraph with ' },
          { text: 'italic', em: true },
          { text: ' text.' },
        ],
      },
    ]);

    const res = await importFromBytes(
      bytes,
      'integration-story.docx',
      'short-story',
      adapter,
      {
        generateId: () => FIXED_ID,
        now: () => FIXED_CLOCK,
        parseDocx: realParseDocx,
      },
    );

    expect(res).toEqual({ ok: true, id: FIXED_ID });

    const row = await adapter.getManuscriptById(FIXED_ID);
    expect(row).not.toBeNull();
    expect(row!.schemaVersion).toBe(SCHEMA_VERSION);
    expect(row!.createdAt).toBe(FIXED_CLOCK);
    expect(row!.title.length).toBeGreaterThan(0);

    const ir: ProseManuscript = JSON.parse(row!.irJson);
    expect(ir.schemaVersion).toBe(1);
    expect(ir.body.length).toBeGreaterThan(0);
  });
});