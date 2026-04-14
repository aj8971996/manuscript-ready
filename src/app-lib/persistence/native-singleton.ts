/**
 * Lazy singleton sqlite adapter for RN screens.
 *
 * RN-only module — sits next to native.ts, pulls expo-sqlite into the graph
 * via createSqliteAdapter. Do NOT import from app-pure code. Screens that
 * need persistence call `getSqliteAdapter()`; the adapter is created and
 * init()-ed exactly once per process, subsequent calls return the same
 * instance.
 *
 * Tech-debt marker: if we ever need to swap adapters at test time
 * (e.g. a Detox run with a seeded in-memory DB), upgrade to a React
 * context provider in app/_layout.tsx. That migration is mechanical;
 * today this module is the single call site.
 */
import type { PersistenceAdapter } from './index';
import { createSqliteAdapter } from './native';

let cached: Promise<PersistenceAdapter> | null = null;

export function getSqliteAdapter(): Promise<PersistenceAdapter> {
  if (cached === null) {
    cached = (async () => {
      const adapter = createSqliteAdapter();
      await adapter.init();
      return adapter;
    })();
  }
  return cached;
}

/**
 * Test-only reset hook. Not exercised in jest (this module is RN-only,
 * app-rn tests don't touch sqlite). Exists so on-device debug flows
 * can force a fresh adapter if the DB ever needs to be rebuilt mid-session.
 */
export function __resetSqliteAdapterForTesting(): void {
  cached = null;
}