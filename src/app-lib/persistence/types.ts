/**
 * Persistence contract — shared by the in-memory fake (this commit) and the
 * expo-sqlite binding (step 2). Screens and app-logic depend only on the
 * interface, never on a concrete adapter. This keeps the IR-in-DB contract
 * testable in pure node (app-pure) and the sqlite glue thin.
 *
 * ADR §8: IR serializes to JSON in a single column keyed by generated id.
 * `schemaVersion: 1` is the migration hook — bump and migrate when IR evolves.
 */
import type { Category } from '../engine-dispatch';

export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

/**
 * A row as stored. `irJson` is the full serialized ProseManuscript; `title`
 * and `category` are denormalized for cheap Library list reads without
 * parsing every IR. `createdAt` is epoch ms, set at insert time.
 *
 * `warnings` is the raw engine warning-key array captured at parse time
 * (e.g. ['unsupported-block:ul', 'metadata-missing:title']). Storage is
 * deliberately raw — never derived UX state, never user-facing message
 * strings. The validation layer (src/validation) is the sole authority
 * for mapping these keys to severities and copy at view time. Storing
 * raw keys means messages.ts can evolve without a migration.
 *
 * The list projection (ManuscriptListItem) deliberately does NOT include
 * warnings — Library never loads them, just like it never loads bodies.
 */
export type PersistedManuscriptRow = {
  readonly id: string;
  readonly schemaVersion: SchemaVersion;
  readonly title: string;
  readonly category: Category;
  readonly createdAt: number;
  readonly irJson: string;
  readonly warnings: ReadonlyArray<string>;
};

/** List projection — Library never loads bodies or warnings. */
export type ManuscriptListItem = {
  readonly id: string;
  readonly title: string;
  readonly category: Category;
  readonly createdAt: number;
};

/** Insert input — `createdAt` optional (auto-filled if omitted). */
export type InsertManuscriptInput = {
  readonly id: string;
  readonly schemaVersion: SchemaVersion;
  readonly title: string;
  readonly category: Category;
  readonly irJson: string;
  readonly warnings: ReadonlyArray<string>;
  readonly createdAt?: number;
};

/** Typed failure union. Adapters reject with these, never throw raw. */
export type PersistenceError =
  | { readonly kind: 'not-initialized' }
  | { readonly kind: 'id-collision'; readonly id: string }
  | { readonly kind: 'schema-mismatch'; readonly found: number; readonly expected: number }
  | { readonly kind: 'storage-failure'; readonly cause: unknown };

export class PersistenceFailure extends Error {
  public override readonly name = 'PersistenceFailure';
  constructor(public readonly detail: PersistenceError) {
    super(`PersistenceFailure(${detail.kind})`);
  }
}

export interface PersistenceAdapter {
  init(): Promise<void>;
  migrate(fromVersion: number): Promise<void>;
  insertManuscript(input: InsertManuscriptInput): Promise<string>;
  getManuscriptById(id: string): Promise<PersistedManuscriptRow | null>;
  listManuscripts(): Promise<ReadonlyArray<ManuscriptListItem>>;
}