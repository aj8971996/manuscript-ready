/**
 * Tests for the contact-format shape validators.
 * App-pure bucket — no RN, no engine, no validation imports.
 */
import { isEmailShaped, isPhoneShaped } from '../contact-format';

describe('isEmailShaped (D1: pragmatic loose per RFC 3696 / Klensin)', () => {
  it('accepts minimal valid shape', () => {
    expect(isEmailShaped('a@b.co')).toBe(true);
  });

  it('accepts plus-addressing with subdomain', () => {
    expect(isEmailShaped('user+tag@sub.example.com')).toBe(true);
  });

  it('accepts long TLDs', () => {
    expect(isEmailShaped('x@y.museum')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isEmailShaped('')).toBe(false);
  });

  it('rejects missing @', () => {
    expect(isEmailShaped('no-at-sign.com')).toBe(false);
  });

  it('rejects missing TLD dot', () => {
    expect(isEmailShaped('user@localhost')).toBe(false);
  });
});

describe('isPhoneShaped (D2: digit count 7-15 per ITU-T E.164)', () => {
  it('accepts NANP 10-digit with punctuation', () => {
    expect(isPhoneShaped('(555) 123-4567')).toBe(true);
  });

  it('accepts international number with plus and spaces', () => {
    expect(isPhoneShaped('+44 20 7946 0958')).toBe(true);
  });

  it('accepts 7-digit boundary (lower)', () => {
    expect(isPhoneShaped('1234567')).toBe(true);
  });

  it('rejects 6-digit (below floor)', () => {
    expect(isPhoneShaped('123456')).toBe(false);
  });

  it('rejects 16-digit (above E.164 cap)', () => {
    expect(isPhoneShaped('1234567890123456')).toBe(false);
  });
});