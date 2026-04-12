import type { Metadata } from '../ir/prose';

/**
 * Maps a raw word count to the SFWA category band.
 *
 * SFWA bands (v1, do not re-derive):
 *   short-story   : wordCount < 7_500
 *   novelette     : 7_500  <= wordCount < 17_500
 *   novella       : 17_500 <= wordCount < 40_000
 *   novel         : 40_000 <= wordCount
 *
 * Contract:
 * - Input must be a finite non-negative integer. Violations throw RangeError
 *   rather than clamping; the sole caller is post-`countWords`, which already
 *   returns integers, so a bad input here indicates an upstream bug we want
 *   loud, not silent.
 * - `wordCount === 0` returns 'short-story' by band definition. Parsers
 *   decide separately whether an empty body is an error (it is — they emit
 *   'parse-error:empty' before reaching this util).
 *
 * Used by both parsers to detect mismatch against `ParseHints.category` and
 * emit 'category-wordcount-mismatch' once per manuscript at attention
 * severity. Per v1 anti-requirements: no genre-specific refinements, no
 * per-publisher overrides, no silent auto-correction of the declared
 * category.
 */
export function categoryFromWordCount(
  wordCount: number,
): NonNullable<Metadata['category']> {
  if (!Number.isFinite(wordCount)) {
    throw new RangeError(
      `categoryFromWordCount: wordCount must be finite, got ${wordCount}`,
    );
  }
  if (!Number.isInteger(wordCount)) {
    throw new RangeError(
      `categoryFromWordCount: wordCount must be an integer, got ${wordCount}`,
    );
  }
  if (wordCount < 0) {
    throw new RangeError(
      `categoryFromWordCount: wordCount must be non-negative, got ${wordCount}`,
    );
  }

  if (wordCount < 7_500) return 'short-story';
  if (wordCount < 17_500) return 'novelette';
  if (wordCount < 40_000) return 'novella';
  return 'novel';
}