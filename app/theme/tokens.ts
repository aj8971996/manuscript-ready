/**
 * Theme tokens — single source of truth.
 * Color values: ADR §6. Spacing/radius: ADR §7.
 * Do not use hex literals in components; add a token here if one is missing.
 */

export type TokenName =
  | 'bg'
  | 'surface'
  | 'surface-muted'
  | 'border'
  | 'border-strong'
  | 'text-primary'
  | 'text-secondary'
  | 'text-muted'
  | 'accent'
  | 'accent-subtle'
  | 'severity-blocker'
  | 'severity-attention'
  | 'severity-info'
  | 'status-ready-text'
  | 'status-ready-bg'
  | 'status-attention-text'
  | 'status-attention-bg';

export type TokenMap = Record<TokenName, string>;

export const lightTokens: TokenMap = {
  'bg': '#FAFAF7',
  'surface': '#FFFFFF',
  'surface-muted': '#F3F2ED',
  'border': '#E5E3DC',
  'border-strong': '#C9C6BC',
  'text-primary': '#1A1A1A',
  'text-secondary': '#5C5A55',
  'text-muted': '#8B8780',
  'accent': '#3B5FD9',
  'accent-subtle': '#E8EDFB',
  'severity-blocker': '#B42318',
  'severity-attention': '#B54708',
  'severity-info': '#5C5A55',
  'status-ready-text': '#067647',
  'status-ready-bg': '#E6F4EA',
  'status-attention-text': '#633806',
  'status-attention-bg': '#FAEEDA',
};

export const darkTokens: TokenMap = {
  'bg': '#141413',
  'surface': '#1E1D1B',
  'surface-muted': '#26251F',
  'border': '#2F2E28',
  'border-strong': '#454339',
  'text-primary': '#F0EFEA',
  'text-secondary': '#A8A59D',
  'text-muted': '#7A776F',
  'accent': '#7A97F0',
  'accent-subtle': '#1F2C52',
  'severity-blocker': '#F87171',
  'severity-attention': '#FBB04C',
  'severity-info': '#A8A59D',
  'status-ready-text': '#4ADE80',
  'status-ready-bg': '#14311F',
  'status-attention-text': '#FBB04C',
  'status-attention-bg': '#3B2A10',
};

// ADR §7 spacing scale, 4px base.
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

// ADR §7 radius scale.
export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
} as const;

export type SpacingStep = keyof typeof spacing;
export type RadiusStep = keyof typeof radius;

/**
 * NOTE: ADR §6 defines `severity-info` === `text-secondary` in both modes.
 * The test acknowledges this intentional alias rather than requiring
 * all-distinct values.
 */
export const INTENTIONAL_VALUE_ALIASES: ReadonlyArray<[TokenName, TokenName]> = [
  ['severity-info', 'text-secondary'],
  // Dark mode: status-attention-text === severity-attention (#FBB04C).
  ['status-attention-text', 'severity-attention'],
];