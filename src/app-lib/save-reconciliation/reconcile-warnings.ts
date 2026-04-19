/**
 * Save-path reconciliation — recompute derivable warning keys from
 * newly-edited IR + category, preserve every non-derivable key.
 *
 * Why this exists: parse-time emits metadata-missing:* and
 * category-wordcount-mismatch into the warnings_json column. validate()
 * in src/validation/validate.ts is pass-through — it does not recompute
 * these at view time. Without save-time reconciliation, an edited
 * manuscript shows stale warnings forever: user fixes the title, R&E
 * still reports 'metadata-missing:title'. Commit 24 widened the
 * persistence adapter to accept warnings on update; this module is the
 * policy layer above it.
 *
 * DERIVABLE_KEYS is the exact set of warning keys that are a function
 * of (IR, category). Everything else is either parser-artifact
 * (unsupported-block:*, mammoth-*, emphasis-*) or unknown, and passes
 * through untouched.
 *
 * Predicate matches src/engine/parsers/txt.ts lines 74–77: a metadata
 * field is "missing" iff it is the empty string. Whitespace-only strings
 * are not treated as missing — the parser wouldn't have flagged them,
 * and parse-time + save-time must agree on missingness semantics or the
 * save boundary lies.
 *
 * DOCX first-save side effect (tech debt #55): the DOCX parser does not
 * emit metadata-missing:* for empty fields. First save on such a DOCX
 * will introduce the three keys here, because reconcile computes from
 * current IR regardless of what the old warnings said. This is correct
 * save-path behavior — the DOCX was always missing those fields, the
 * parser just wasn't reporting it. Engine fix is out of scope under the
 * engine-purity rule.
 *
 * Output dedup: reconcile returns a deduplicated array. Storage (per
 * Commit 14 contract) does not dedup; deduping here keeps the persisted
 * array tidy on every save without changing the storage contract.
 *
 * Key-ownership split: reconcile owns the policy of "which keys are
 * recomputable from IR + category"; src/validation/messages.ts owns
 * key → copy. DERIVABLE_KEYS is a local tuple, deliberately not
 * imported from messages.ts — the concerns are orthogonal.
 *
 * App-layer purity: pure function, no RN imports, lives in app-pure.
 * Imports from src/engine/util are allowed (app-lib → engine); the
 * reverse is forbidden.
 */

import type { Metadata, ProseManuscript } from '../../engine/ir/prose';
import { categoryFromWordCount } from '../../engine/util/category-from-wordcount';
import { countWords } from '../../engine/util/word-count';

export const DERIVABLE_KEYS = [
  'metadata-missing:title',
  'metadata-missing:byline',
  'metadata-missing:legalName',
  'category-wordcount-mismatch',
] as const;

export type DerivableKey = (typeof DERIVABLE_KEYS)[number];

const DERIVABLE_SET: ReadonlySet<string> = new Set(DERIVABLE_KEYS);

/**
 * Reconcile a persisted warnings array against freshly-edited IR and
 * category. Drops stale derivable keys, recomputes them from current
 * state, preserves everything else in first-seen order.
 *
 * Output ordering contract: preserved non-derivable keys first, in
 * input order (with duplicates collapsed); then fresh derivable keys in
 * DERIVABLE_KEYS tuple order. Deterministic.
 */
export function reconcileWarnings(
  oldWarnings: ReadonlyArray<string>,
  newManuscript: ProseManuscript,
  newCategory: NonNullable<Metadata['category']>,
): ReadonlyArray<string> {
  // Preserve non-derivable keys in first-seen order. Dedup across input.
  const preserved: string[] = [];
  const seen = new Set<string>();
  for (const key of oldWarnings) {
    if (DERIVABLE_SET.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    preserved.push(key);
  }

  // Compute fresh derivable keys from current IR + category.
  // DERIVABLE_KEYS tuple order locks output ordering.
  const fresh: string[] = [];
  if (newManuscript.metadata.title === '') {
    fresh.push('metadata-missing:title');
  }
  if (newManuscript.metadata.byline === '') {
    fresh.push('metadata-missing:byline');
  }
  if (newManuscript.metadata.legalName === '') {
    fresh.push('metadata-missing:legalName');
  }
  const computedCategory = categoryFromWordCount(countWords(newManuscript.body));
  if (newCategory !== computedCategory) {
    fresh.push('category-wordcount-mismatch');
  }

  return [...preserved, ...fresh];
}