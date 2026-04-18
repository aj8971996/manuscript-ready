/**
 * In-memory persistence adapter. Used by app-pure tests and as the default
 * store backend before the sqlite adapter (step 2) takes over at runtime.
 * Pure TS — no expo, no react-native.
 */
import {
  type InsertManuscriptInput,
  type UpdateManuscriptInput,
  type ManuscriptListItem,
  type PersistedManuscriptRow,
  type PersistenceAdapter,
  PersistenceFailure,
  SCHEMA_VERSION,
} from './types';

export function createInMemoryAdapter(): PersistenceAdapter {
  const rows = new Map<string, PersistedManuscriptRow>();
  const insertionOrder: string[] = [];
  let initialized = false;
  let clock = 0;

  const requireInit = () => {
    if (!initialized) {
      throw new PersistenceFailure({ kind: 'not-initialized' });
    }
  };

  const nextCreatedAt = (): number => {
    const now = Date.now();
    clock = now > clock ? now : clock + 1;
    return clock;
  };

  return {
    async init() {
      initialized = true;
    },

    async migrate(_fromVersion: number) {
      // v1 is the first version; nothing to migrate. Hook is intentionally
      // callable so the step-2 sqlite adapter can share the same contract.
    },

    async insertManuscript(input: InsertManuscriptInput): Promise<string> {
      requireInit();
      if (rows.has(input.id)) {
        throw new PersistenceFailure({ kind: 'id-collision', id: input.id });
      }
      const row: PersistedManuscriptRow = {
        id: input.id,
        schemaVersion: SCHEMA_VERSION,
        title: input.title,
        category: input.category,
        irJson: input.irJson,
        // Defensive copy: callers can mutate their input array after
        // insert without affecting the stored row. Storage is the
        // authority on persisted shape.
        warnings: [...input.warnings],
        createdAt: input.createdAt ?? nextCreatedAt(),
      };
      rows.set(row.id, row);
      insertionOrder.push(row.id);
      return row.id;
    },

    async updateManuscript(
      id: string,
      input: UpdateManuscriptInput,
    ): Promise<PersistedManuscriptRow> {
      requireInit();
      const existing = rows.get(id);
      if (!existing) {
        throw new PersistenceFailure({ kind: 'update-missing-id', id });
      }
      const updated: PersistedManuscriptRow = {
        // Immutable-under-update: id, schemaVersion, createdAt carry
        // forward from the existing row. insertionOrder is deliberately
        // not touched — Map.set on an existing key preserves iteration
        // order, and we never push to insertionOrder on update.
        id: existing.id,
        schemaVersion: existing.schemaVersion,
        createdAt: existing.createdAt,
        title: input.title,
        category: input.category,
        irJson: input.irJson,
        // Defensive copy — same rule as insert.
        warnings: [...input.warnings],
      };
      rows.set(id, updated);
      return updated;
    },

    async getManuscriptById(id: string): Promise<PersistedManuscriptRow | null> {
      requireInit();
      return rows.get(id) ?? null;
    },

    async listManuscripts(): Promise<ReadonlyArray<ManuscriptListItem>> {
      requireInit();
      return insertionOrder.map((id) => {
        const row = rows.get(id)!;
        return {
          id: row.id,
          title: row.title,
          category: row.category,
          createdAt: row.createdAt,
        };
      });
    },
  };
}