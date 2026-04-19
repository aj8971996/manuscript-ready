/**
 * Contact-format shape validators for the Metadata Editor's Contact tab.
 *
 * App-layer module: deliberately under src/app-lib/validation/ (not
 * src/validation/). src/validation/ is engine-adjacent and owns the
 * warning-key vocabulary produced at parse time. This module owns
 * user-input shape checks surfaced inline in the editor. The two
 * layers must not cross-import.
 *
 * isEmailShaped — D1. Pragmatic loose regex per RFC 3696 guidance
 * (Klensin): over-validating email produces false negatives on legal
 * addresses (plus-addressing, long TLDs, subdomains). SMTP is the
 * real validator; this shape check only rejects obvious nonsense.
 *
 * isPhoneShaped — D2. Digit-count only, 7 to 15 inclusive. Punctuation
 * ( + ( ) - . space ) is stripped before counting, not flagged.
 * Upper bound is ITU-T E.164's cap on international numbers;
 * lower bound accommodates NANP 7-digit local numbers.
 *
 * No isPostalShaped — D3. Postal formats vary across roughly 200
 * countries and cannot be meaningfully shape-checked without a country
 * anchor. Country is not editable in Commit 26, so format validation
 * is deferred. The screen enforces required-non-empty inline;
 * isPostalShaped can be added here without API churn elsewhere
 * when country support lands.
 */

export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isPhoneShaped(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}