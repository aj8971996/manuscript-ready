/**
 * import-flow — step 3a of commit 4.
 *
 * Pure async orchestrator: bytes + filename + category → adapter insert.
 * RN-free (composes the engine's pure parsers and the persistence adapter
 * interface; no react-native, no expo). All RN concerns (document picker,
 * file reads, navigation) live in `app/import.tsx` (step 3b).
 *
 * Failure modes are typed and distinct: `parse-error` when the parser
 * returns ok:false (expected path — empty file, malformed docx, etc.),
 * `parse-exception` when the parser promise rejects (unexpected — corrupt
 * zip header and similar), `unsupported-file` when the filename's
 * extension isn't `.docx` or `.txt`, and `persist-error` when the adapter
 * rejects with `PersistenceFailure`. Non-`PersistenceFailure` throws from
 * the adapter bubble up — those are bugs, not runtime failure modes.
 *
 * Title derivation: IR metadata title wins when non-empty after trim;
 * otherwise falls back to the filename stem (last extension stripped),
 * with a final `'Untitled'` defensive fallback. Category on the row is
 * sourced from the parsed IR (single source of truth); the parameter
 * `category` feeds the parser as a hint and is only used as a fallback
 * if the IR somehow doesn't carry one.
 */
import {
  PersistenceFailure,
  SCHEMA_VERSION,
  type InsertManuscriptInput,
  type PersistenceAdapter,
  type PersistenceError,
} from '../persistence';
import type { Category } from '../engine-dispatch';
import {
  parseDocx as realParseDocx,
  parseTxt as realParseTxt,
  type ParseHints,
  type ParseResult,
  type ParserError,
} from '../../engine/parsers';

export type ImportFailure =
  | { kind: 'parse-error'; error: ParserError }
  | { kind: 'parse-exception'; cause: unknown }
  | { kind: 'unsupported-file'; filename: string }
  | { kind: 'persist-error'; cause: PersistenceError };

export type ImportDeps = {
  generateId?: () => string;
  now?: () => number;
  parseDocx?: (bytes: Uint8Array, hints?: ParseHints) => Promise<ParseResult>;
  parseTxt?: (text: string, hints?: ParseHints) => ParseResult;
  decodeText?: (bytes: Uint8Array) => string;
};

export type ImportResult =
  | { ok: true; id: string }
  | { ok: false; failure: ImportFailure };

type Extension = 'docx' | 'txt';

function extensionOf(filename: string): Extension | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.txt')) return 'txt';
  return null;
}

function filenameStem(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  // lastDot > 0 guards against dotfiles ('.env') being stripped to ''.
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

function defaultGenerateId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback only — should never trigger on modern Node or RN's Hermes 2024+.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultDecodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

export async function importFromBytes(
  bytes: Uint8Array,
  filename: string,
  category: Category,
  adapter: PersistenceAdapter,
  deps: ImportDeps = {},
): Promise<ImportResult> {
  const ext = extensionOf(filename);
  if (ext === null) {
    return { ok: false, failure: { kind: 'unsupported-file', filename } };
  }

  const generateId = deps.generateId ?? defaultGenerateId;
  const now = deps.now ?? Date.now;
  const parseDocx = deps.parseDocx ?? realParseDocx;
  const parseTxt = deps.parseTxt ?? realParseTxt;
  const decodeText = deps.decodeText ?? defaultDecodeText;

  const hints: ParseHints = { category };

  let parsed: ParseResult;
  try {
    parsed =
      ext === 'docx'
        ? await parseDocx(bytes, hints)
        : parseTxt(decodeText(bytes), hints);
  } catch (cause) {
    return { ok: false, failure: { kind: 'parse-exception', cause } };
  }

  if (!parsed.ok) {
    return { ok: false, failure: { kind: 'parse-error', error: parsed.error } };
  }

  const ir = parsed.manuscript;
  const irTitle = ir.metadata.title;
  const title =
    irTitle.trim() !== ''
      ? irTitle
      : filenameStem(filename).trim() || 'Untitled';

  const input: InsertManuscriptInput = {
    id: generateId(),
    schemaVersion: SCHEMA_VERSION,
    title,
    category: ir.metadata.category ?? category,
    irJson: JSON.stringify(ir),
    createdAt: now(),
  };

  try {
    const id = await adapter.insertManuscript(input);
    return { ok: true, id };
  } catch (err) {
    if (err instanceof PersistenceFailure) {
      return {
        ok: false,
        failure: { kind: 'persist-error', cause: err.detail },
      };
    }
    throw err;
  }
}