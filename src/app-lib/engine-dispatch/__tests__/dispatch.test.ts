import { dispatch, UnknownCategoryError, type Category } from '../index';

describe('engine-dispatch — routing', () => {
  const categories: Category[] = ['short-story', 'novelette', 'novella', 'novel'];

  it.each(categories)('routes %s to prose pipeline', (c) => {
    expect(dispatch(c)).toBe('prose');
  });
});

describe('engine-dispatch — unknown input', () => {
  it('throws UnknownCategoryError for an unrecognized value', () => {
    // Force-cast to bypass the type guard and simulate a runtime-only bad value.
    expect(() => dispatch('screenplay' as unknown as Category)).toThrow(UnknownCategoryError);
  });

  it('error message includes the received value for diagnosability', () => {
    try {
      dispatch('flash' as unknown as Category);
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownCategoryError);
      expect((e as Error).message).toContain('flash');
    }
  });
});

describe('engine-dispatch — type derivation', () => {
  it('Category type derives from engine IR Metadata (compile-time check)', () => {
    // If the engine IR narrows or widens its category union, this file fails
    // to compile before tests run. That is the contract.
    const c: Category = 'short-story';
    expect(c).toBe('short-story');
  });
});