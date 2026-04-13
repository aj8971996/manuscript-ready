import { createSqliteAdapter } from '../native';

describe('sqlite adapter — smoke', () => {
  it('factory returns an adapter with the expected method surface', () => {
    const adapter = createSqliteAdapter(':memory:');
    expect(typeof adapter.init).toBe('function');
    expect(typeof adapter.migrate).toBe('function');
    expect(typeof adapter.insertManuscript).toBe('function');
    expect(typeof adapter.getManuscriptById).toBe('function');
    expect(typeof adapter.listManuscripts).toBe('function');
  });

  it('factory accepts a custom db name without throwing', () => {
    expect(() => createSqliteAdapter('test.db')).not.toThrow();
  });
});