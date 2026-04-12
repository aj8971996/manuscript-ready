import { categoryFromWordCount } from '../category-from-wordcount';

describe('categoryFromWordCount', () => {
  describe('SFWA band interiors', () => {
    test.each([
      [0, 'short-story'],
      [1, 'short-story'],
      [3_000, 'short-story'],
      [7_499, 'short-story'],
      [7_500, 'novelette'],
      [10_000, 'novelette'],
      [17_499, 'novelette'],
      [17_500, 'novella'],
      [25_000, 'novella'],
      [39_999, 'novella'],
      [40_000, 'novel'],
      [80_000, 'novel'],
      [500_000, 'novel'],
    ] as const)('wordCount=%i → %s', (count, expected) => {
      expect(categoryFromWordCount(count)).toBe(expected);
    });
  });

  describe('boundary behavior', () => {
    it('treats 7_500 as the first novelette count (lower-bound inclusive)', () => {
      expect(categoryFromWordCount(7_499)).toBe('short-story');
      expect(categoryFromWordCount(7_500)).toBe('novelette');
    });

    it('treats 17_500 as the first novella count', () => {
      expect(categoryFromWordCount(17_499)).toBe('novelette');
      expect(categoryFromWordCount(17_500)).toBe('novella');
    });

    it('treats 40_000 as the first novel count', () => {
      expect(categoryFromWordCount(39_999)).toBe('novella');
      expect(categoryFromWordCount(40_000)).toBe('novel');
    });
  });

  describe('invalid input throws RangeError', () => {
    test.each([-1, -100, -0.5])('negative %p throws', (n) => {
      expect(() => categoryFromWordCount(n)).toThrow(RangeError);
    });

    test.each([1.5, 7_500.1, 99.9])('non-integer %p throws', (n) => {
      expect(() => categoryFromWordCount(n)).toThrow(RangeError);
    });

    test.each([NaN, Infinity, -Infinity])('non-finite %p throws', (n) => {
      expect(() => categoryFromWordCount(n)).toThrow(RangeError);
    });
  });
});