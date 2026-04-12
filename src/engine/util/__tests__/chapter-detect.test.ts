import { classifyChapter, CHAPTER_REGEX } from '../chapter-detect';

describe('chapter-detect util', () => {
  describe('classifyChapter', () => {
    it('returns a chapter block with number for Arabic numerals', () => {
      const result = classifyChapter('Chapter 3');
      expect(result).toEqual({ type: 'chapter', number: 3 });
    });

    it('recognizes Roman numerals but does not populate number', () => {
      const result = classifyChapter('Chapter IV');
      expect(result).toEqual({ type: 'chapter' });
    });

    it('recognizes lowercase Roman numerals (case-insensitive)', () => {
      const result = classifyChapter('chapter iv');
      expect(result).toEqual({ type: 'chapter' });
    });

    it('recognizes word-form numbers but does not populate number', () => {
      const result = classifyChapter('Chapter Seven');
      expect(result).toEqual({ type: 'chapter' });
    });

    it('recognizes word-form through twenty', () => {
      const result = classifyChapter('Chapter twenty');
      expect(result).toEqual({ type: 'chapter' });
    });

    it('trims surrounding whitespace before matching (encapsulated precondition)', () => {
      const result = classifyChapter('   Chapter 12   ');
      expect(result).toEqual({ type: 'chapter', number: 12 });
    });

    it('returns null for non-matching lines', () => {
      expect(classifyChapter('This is chapter one, mid-sentence')).toBeNull();
      expect(classifyChapter('Just a paragraph.')).toBeNull();
      expect(classifyChapter('')).toBeNull();
      expect(classifyChapter('Chapter')).toBeNull(); // missing number
      expect(classifyChapter('Chapter twenty-one')).toEqual({ type: 'chapter' });
      // ^ "twenty" matches via \b; "-one" is trailing content. Documents current
      //   D3 behavior; if this diverges from intent, revisit D3 rather than util.
    });

    it('regex is anchored at start (no mid-string match)', () => {
      // Direct regex assertion guards the anchor invariant.
      expect(CHAPTER_REGEX.test('Before Chapter 3 comes')).toBe(false);
      expect(CHAPTER_REGEX.test('Chapter 3')).toBe(true);
    });
  });
});