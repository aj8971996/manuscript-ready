/**
 * Pure load-by-id loader. Screens compose against this, never against the
 * adapter directly â€” keeps route files free of adapter-shape knowledge and
 * keeps the failure surface narrow and stable.
 *
 * Adapter is injected (not imported as singleton) so this module stays
 * app-pure: no expo-sqlite in the module graph, testable under jest-node
 * with createInMemoryAdapter.
 *
 * Failure mapping:
 *   - adapter returns null         â†’ 'not-found'
 *   - adapter throws (any error)   â†’ 'storage-failure'
 * not-initialized folds into storage-failure intentionally â€” from a screen's
 * perspective both are "store is broken, show error state," and neither is
 * recoverable without app restart.
 */
import type { PersistedManuscriptRow, PersistenceAdapter } from '../persistence/types';

export type LoadByIdResult =
  | { readonly ok: true; readonly manuscript: PersistedManuscriptRow }
  | { readonly ok: false; readonly failure: 'not-found' | 'storage-failure' };

export async function loadById(
  adapter: PersistenceAdapter,
  id: string,
): Promise<LoadByIdResult> {
  let row: PersistedManuscriptRow | null;
  try {
    row = await adapter.getManuscriptById(id);
  } catch {
    return { ok: false, failure: 'storage-failure' };
  }
  if (row === null) {
    return { ok: false, failure: 'not-found' };
  }
  return { ok: true, manuscript: row };
}