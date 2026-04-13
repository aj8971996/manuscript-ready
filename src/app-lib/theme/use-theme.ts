/**
 * Theme hook — thin RN wrapper around the pure `resolveTheme` policy.
 * Policy lives in resolve-theme.ts (unit-tested under app-pure); this file
 * is the glue and is verified on-device.
 */
import { useColorScheme } from 'react-native';
import { useManuscriptStore } from '../state/store';
import { resolveTheme, type ResolvedTheme } from './resolve-theme';

export type { ResolvedTheme } from './resolve-theme';

export function useResolvedTheme(): ResolvedTheme {
  const override = useManuscriptStore((s) => s.ui.themeOverride);
  const system = useColorScheme();
  return resolveTheme(override, system);
}