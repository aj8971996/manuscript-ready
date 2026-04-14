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
 */
import * as SQLite from 'expo-sqlite';
import {
  type InsertManuscriptInput,
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
  insertion_seq: number;
};

const toDomain = (r: Row): PersistedManuscriptRow => ({
  id: r.id,
  schemaVersion: SCHEMA_VERSION,
  title: r.title,
  category: r.category as PersistedManuscriptRow['category'],
  createdAt: r.created_at,
  irJson: r.ir_json,
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
      });
    },

    async migrate(_fromVersion: number) {
      // v1: no-op. Hook preserved for future IR evolution.
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
             (id, schema_version, title, category, created_at, ir_json, insertion_seq)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [input.id, SCHEMA_VERSION, input.title, input.category, createdAt, input.irJson, seq],
        );
        return input.id;
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