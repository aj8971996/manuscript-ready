/**
 * Sanity test — verifies the Jest + ts-jest harness runs against the engine
 * subtree. If this fails, nothing else in the engine suite is trustworthy.
 * Delete once we have real coverage and this feels redundant.
 */
describe('harness', () => {
  it('runs TypeScript under Jest', () => {
    const double = (n: number): number => n * 2;
    expect(double(21)).toBe(42);
  });
});