/**
 * Pure theme-resolution policy.
 * No RN imports — testable under app-pure. The RN-bound hook lives in
 * use-theme.ts and delegates to this function.
 */
import type { ThemeOverride } from '../state/manuscript';

export type ResolvedTheme = 'light' | 'dark';
export type SystemScheme = 'light' | 'dark' | null | undefined;

export function resolveTheme(override: ThemeOverride, system: SystemScheme): ResolvedTheme {
  return override ?? (system === 'dark' ? 'dark' : 'light');
}