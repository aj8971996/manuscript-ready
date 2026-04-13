import {
  lightTokens,
  darkTokens,
  spacing,
  radius,
  INTENTIONAL_VALUE_ALIASES,
  type TokenName,
  type TokenMap,
} from '../tokens';

// ADR §6 — authoritative token names. Adding/removing one here must match tokens.ts.
const REQUIRED_TOKENS: readonly TokenName[] = [
  'bg',
  'surface',
  'surface-muted',
  'border',
  'border-strong',
  'text-primary',
  'text-secondary',
  'text-muted',
  'accent',
  'accent-subtle',
  'severity-blocker',
  'severity-attention',
  'severity-info',
  'status-ready-text',
  'status-ready-bg',
  'status-attention-text',
  'status-attention-bg',
];

const HEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;

describe('theme tokens — ADR §6 completeness', () => {
  it.each(REQUIRED_TOKENS)('lightTokens has %s', (name) => {
    expect(lightTokens[name]).toBeDefined();
    expect(lightTokens[name]).not.toBe('');
  });

  it.each(REQUIRED_TOKENS)('darkTokens has %s', (name) => {
    expect(darkTokens[name]).toBeDefined();
    expect(darkTokens[name]).not.toBe('');
  });

  it('lightTokens has no extra keys beyond REQUIRED_TOKENS', () => {
    expect(Object.keys(lightTokens).sort()).toEqual([...REQUIRED_TOKENS].sort());
  });

  it('darkTokens has no extra keys beyond REQUIRED_TOKENS', () => {
    expect(Object.keys(darkTokens).sort()).toEqual([...REQUIRED_TOKENS].sort());
  });
});

describe('theme tokens — value shape', () => {
  it.each(REQUIRED_TOKENS)('lightTokens.%s is uppercase hex', (name) => {
    expect(lightTokens[name]).toMatch(HEX);
  });

  it.each(REQUIRED_TOKENS)('darkTokens.%s is uppercase hex', (name) => {
    expect(darkTokens[name]).toMatch(HEX);
  });
});

describe('theme tokens — light vs dark differentiation', () => {
  // Every token should differ between light and dark — catches copy-paste.
  it.each(REQUIRED_TOKENS)('lightTokens.%s !== darkTokens[same]', (name) => {
    expect(lightTokens[name]).not.toBe(darkTokens[name]);
  });
});

describe('theme tokens — intentional value aliases (ADR §6)', () => {
  // severity-info is documented-equal to text-secondary in both modes.
  it.each(INTENTIONAL_VALUE_ALIASES)(
    'light: %s value equals %s value',
    (a: TokenName, b: TokenName) => {
      expect(lightTokens[a]).toBe(lightTokens[b]);
    },
  );

  it.each(INTENTIONAL_VALUE_ALIASES)(
    'dark: %s value equals %s value',
    (a: TokenName, b: TokenName) => {
      expect(darkTokens[a]).toBe(darkTokens[b]);
    },
  );
});

describe('theme tokens — spacing scale (ADR §7)', () => {
  it('matches the ADR §7 scale exactly', () => {
    expect(spacing).toEqual({ 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 });
  });
});

describe('theme tokens — radius scale (ADR §7)', () => {
  it('matches the ADR §7 scale exactly', () => {
    expect(radius).toEqual({ sm: 6, md: 12, lg: 20 });
  });
});

describe('theme tokens — type surface', () => {
  it('TokenMap indexes by TokenName', () => {
    const check: TokenMap = lightTokens;
    expect(check['bg']).toBeDefined();
  });
});