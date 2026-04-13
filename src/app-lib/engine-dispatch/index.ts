/**
 * engine-dispatch — category → pipeline routing for the app layer.
 *
 * v1 policy (per ADR §8 + handoff v6):
 * - All four active prose categories route to the `'prose'` pipeline.
 * - `novel` routes to `'prose'` too. The novel formatter is tech debt #4
 *   and not shipped; Review & Export handles that at the UI layer
 *   (blocker-severity gate), not here. Dispatch stays a pure map.
 *
 * `Category` is derived from the canonical engine IR via indexed access —
 * NOT redefined here — so a future engine update to the category union
 * propagates automatically.
 */
import type { Metadata } from '../../engine/ir/prose';

export type Category = NonNullable<Metadata['category']>;

export type Pipeline = 'prose';

export class UnknownCategoryError extends Error {
  constructor(received: string) {
    super(`engine-dispatch: unknown category "${received}"`);
    this.name = 'UnknownCategoryError';
  }
}

const KNOWN: ReadonlySet<Category> = new Set<Category>([
  'short-story',
  'novelette',
  'novella',
  'novel',
]);

export function dispatch(category: Category): Pipeline {
  if (!KNOWN.has(category)) {
    throw new UnknownCategoryError(String(category));
  }
  return 'prose';
}