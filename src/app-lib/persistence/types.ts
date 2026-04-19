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

/**
 * Update input — narrower than Insert. `id` is positional on the adapter
 * method; `schemaVersion` and `createdAt` are immutable under update
 * (schema evolution goes through `migrate()`, and the creation timestamp
 * plus insertion order are authoritative and must not shift when a row
 * is edited).
 *
 * `warnings` IS updatable — metadata edits reconcile the persisted
 * warning-key set against the new IR (e.g. adding a title clears
 * `metadata-missing:title`, changing the category re-evaluates
 * `category-wordcount-mismatch`). The reconciliation policy lives in
 * app-lib (the save orchestrator), not in the adapter. The adapter's
 * job is to write whatever warning array the caller supplies — same
 * "storage is not the dedup layer, storage stores raw keys, validation
 * owns meaning" discipline as on insert.
 */
export type UpdateManuscriptInput = {
  readonly title: string;
  readonly category: Category;
  readonly irJson: string;
  readonly warnings: ReadonlyArray<string>;
};

/**
 * Typed failure union. Adapters reject with these, never throw raw.
 *
 * `update-missing-id` is distinct from `storage-failure`: the former is
 * an expected structured condition (row gone, e.g. deleted between load
 * and save), the latter is an unexpected error from the storage layer.
 * Save-path callers branch on the two differently — missing-id bounces
 * back to Library with a "manuscript no longer exists" message;
 * storage-failure offers retry. Parallel to `id-collision` on the
 * insert side.
 */
export type PersistenceError =
  | { readonly kind: 'not-initialized' }
  | { readonly kind: 'id-collision'; readonly id: string }
  | { readonly kind: 'update-missing-id'; readonly id: string }
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
  updateManuscript(id: string, input: UpdateManuscriptInput): Promise<PersistedManuscriptRow>;
  getManuscriptById(id: string): Promise<PersistedManuscriptRow | null>;
  listManuscripts(): Promise<ReadonlyArray<ManuscriptListItem>>;
}