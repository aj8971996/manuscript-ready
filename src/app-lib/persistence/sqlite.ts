/**
 * expo-sqlite binding implementing PersistenceAdapter.
 *
 * This is glue only — no policy. Contract tests against the in-memory fake
 * (adapter.test.ts) define correct behavior; this file translates that
 * contract to sqlite calls and maps sqlite errors to PersistenceFailure.
 *
 * On-device verification is the real test surface for this file. The
 * app-rn smoke test under __tests__/sqlite.test.ts only confirms the
 * module loads and factory is shaped correctly under jest-expo mocks.
 *
 * Schema-drift reconciliation: init() calls CREATE TABLE IF NOT EXISTS
 * (handles fresh installs) and then runs PRAGMA table_info to detect
 * missing columns added in later commits, applying ALTER TABLE patches
 * in-place. This is distinct from `migrate(fromVersion)`, which is the
 * IR-version migration hook reserved for ProseManuscript schema bumps.
 * Column-drift reconciliation runs every init unconditionally; IR
 * migration runs only when SCHEMA_VERSION changes.
 */
import * as SQLite from 'expo-sqlite';
import {
  type InsertManuscriptInput,
  type UpdateManuscriptInput,
  type ManuscriptListItem,
  type PersistedManuscriptRow,
  type PersistenceAdapter,
  PersistenceFailure,
  SCHEMA_VERSION,
} from './types';

const DEFAULT_DB_NAME = 'manuscript-ready.db';

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS manuscripts (
    id TEXT PRIMARY KEY NOT NULL,
    schema_version INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    ir_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL DEFAULT '[]',
    insertion_seq INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_manuscripts_insertion_seq
    ON manuscripts(insertion_seq);
`;

type Row = {
  id: string;
  schema_version: number;
  title: string;
  category: string;
  created_at: number;
  ir_json: string;
  warnings_json: string;
  insertion_seq: number;
};

const parseWarnings = (raw: string): ReadonlyArray<string> => {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter to strings only — defensive against any future shape drift
    // in the column. Storage is the trust boundary; downstream consumers
    // (ReviewModel mapper, validation re-run) assume string keys.
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    // Corrupted JSON should never happen via our own writes, but a
    // hand-edited dev DB shouldn't crash Library hydration.
    return [];
  }
};

const toDomain = (r: Row): PersistedManuscriptRow => ({
  id: r.id,
  schemaVersion: SCHEMA_VERSION,
  title: r.title,
  category: r.category as PersistedManuscriptRow['category'],
  createdAt: r.created_at,
  irJson: r.ir_json,
  warnings: parseWarnings(r.warnings_json),
});

const wrapStorageFailure = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (cause) {
    if (cause instanceof PersistenceFailure) throw cause;
    throw new PersistenceFailure({ kind: 'storage-failure', cause });
  }
};

export function createSqliteAdapter(dbName: string = DEFAULT_DB_NAME): PersistenceAdapter {
  let db: SQLite.SQLiteDatabase | null = null;
  let clock = 0;

  const requireDb = (): SQLite.SQLiteDatabase => {
    if (!db) throw new PersistenceFailure({ kind: 'not-initialized' });
    return db;
  };

  const nextCreatedAt = (): number => {
    const now = Date.now();
    clock = now > clock ? now : clock + 1;
    return clock;
  };

  return {
    async init() {
      if (db) return;
      await wrapStorageFailure(async () => {
        db = await SQLite.openDatabaseAsync(dbName);
        await db.execAsync(CREATE_SQL);
        // Reconcile column drift on dev DBs created before warnings_json
        // existed. Idempotent: if the column is present (fresh install
        // via CREATE_SQL above, or any post-Commit-14 install), this is
        // a no-op. Pre-Commit-14 rows backfill to '[]' via the column
        // default — those manuscripts will show as Submission Ready in
        // Review until re-imported, which is correct lossy-but-safe
        // behavior (the warnings were never captured for those rows).
        const cols = await db.getAllAsync<{ name: string }>(
          'PRAGMA table_info(manuscripts)',
        );
        const hasWarnings = cols.some((c) => c.name === 'warnings_json');
        if (!hasWarnings) {
          await db.execAsync(
            "ALTER TABLE manuscripts ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]'",
          );
        }
      });
    },

    async migrate(_fromVersion: number) {
      // v1: no-op. Hook reserved for future IR (ProseManuscript) evolution,
      // distinct from the column-drift reconciliation in init() above.
    },

    async insertManuscript(input: InsertManuscriptInput): Promise<string> {
      const database = requireDb();
      const createdAt = input.createdAt ?? nextCreatedAt();
      return wrapStorageFailure(async () => {
        const existing = await database.getFirstAsync<{ id: string }>(
          'SELECT id FROM manuscripts WHERE id = ?',
          [input.id],
        );
        if (existing) {
          throw new PersistenceFailure({ kind: 'id-collision', id: input.id });
        }
        const seqRow = await database.getFirstAsync<{ next: number }>(
          'SELECT COALESCE(MAX(insertion_seq), 0) + 1 AS next FROM manuscripts',
        );
        const seq = seqRow?.next ?? 1;
        await database.runAsync(
          `INSERT INTO manuscripts
             (id, schema_version, title, category, created_at, ir_json, warnings_json, insertion_seq)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.id,
            SCHEMA_VERSION,
            input.title,
            input.category,
            createdAt,
            input.irJson,
            JSON.stringify(input.warnings),
            seq,
          ],
        );
        return input.id;
      });
    },

    async updateManuscript(
      id: string,
      input: UpdateManuscriptInput,
    ): Promise<PersistedManuscriptRow> {
      const database = requireDb();
      return wrapStorageFailure(async () => {
        // Existence check first so we can map to update-missing-id
        // rather than silently no-op on a stale id. UPDATE with no
        // WHERE match returns changes=0 but doesn't throw, so we
        // cannot rely on sqlite to surface the condition for us.
        const existing = await database.getFirstAsync<{ id: string }>(
          'SELECT id FROM manuscripts WHERE id = ?',
          [id],
        );
        if (!existing) {
          throw new PersistenceFailure({ kind: 'update-missing-id', id });
        }
        // created_at, insertion_seq, and schema_version are deliberately
        // excluded from the SET list — they are immutable under update.
        await database.runAsync(
          `UPDATE manuscripts
             SET title = ?, category = ?, ir_json = ?, warnings_json = ?
           WHERE id = ?`,
          [
            input.title,
            input.category,
            input.irJson,
            JSON.stringify(input.warnings),
            id,
          ],
        );
        // Read back via SELECT * so toDomain is the single source of
        // truth on the returned row shape (warnings_json parsing,
        // category coercion, schemaVersion passthrough).
        const updated = await database.getFirstAsync<Row>(
          'SELECT * FROM manuscripts WHERE id = ?',
          [id],
        );
        if (!updated) {
          // Defensive: existence was confirmed above the UPDATE. A null
          // here would mean a concurrent delete between SELECT and
          // read-back, which expo-sqlite's single-connection model
          // makes unreachable. Surface as storage-failure rather than
          // a false update-missing-id.
          throw new PersistenceFailure({
            kind: 'storage-failure',
            cause: new Error(`row ${id} vanished between update and read-back`),
          });
        }
        return toDomain(updated);
      });
    },

    async getManuscriptById(id: string): Promise<PersistedManuscriptRow | null> {
      const database = requireDb();
      return wrapStorageFailure(async () => {
        const row = await database.getFirstAsync<Row>(
          'SELECT * FROM manuscripts WHERE id = ?',
          [id],
        );
        return row ? toDomain(row) : null;
      });
    },

    async listManuscripts(): Promise<ReadonlyArray<ManuscriptListItem>> {
      const database = requireDb();
      return wrapStorageFailure(async () => {
        type ListRow = Pick<Row, 'id' | 'title' | 'category' | 'created_at'>;
        const rows = await database.getAllAsync<ListRow>(
          `SELECT id, title, category, created_at
           FROM manuscripts ORDER BY insertion_seq ASC`,
        );
        return rows.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category as ManuscriptListItem['category'],
          createdAt: r.created_at,
        }));
      });
    },
  };
}