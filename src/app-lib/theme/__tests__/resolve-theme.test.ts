import { resolveTheme } from '../resolve-theme';

describe('resolveTheme — precedence (ADR §8)', () => {
  it('returns light when system is light and no override', () => {
    expect(resolveTheme(null, 'light')).toBe('light');
  });

  it('returns dark when system is dark and no override', () => {
    expect(resolveTheme(null, 'dark')).toBe('dark');
  });

  it('override wins over system: dark override beats light system', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('override wins over system: light override beats dark system', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

  it('falls back to light when system is null and no override', () => {
    expect(resolveTheme(null, null)).toBe('light');
  });

  it('falls back to light when system is undefined and no override', () => {
    expect(resolveTheme(null, undefined)).toBe('light');
  });
});