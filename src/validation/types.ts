/**
 * Validation layer types.
 *
 * Severity is three levels internally ('blocker' | 'attention' | 'info') but
 * ValidationReport.status collapses to the binary "Submission Ready" signal
 * per the handoff. An info-only report is still 'ready'; anything at
 * 'attention' or 'blocker' flips to 'attention'.
 *
 * ValidationIssue.key is either a stable engine warning key (from the
 * warning-keys contract in the handoff) or a validation-owned key of the
 * form 'parse-error:<kind>' for ParseResult.ok === false cases. Validation
 * does not introduce any other key namespaces.
 */

export type Severity = 'blocker' | 'attention' | 'info';

export type ValidationIssue = {
  key: string;
  severity: Severity;
  message: string;
  detail?: string;
};

export type ValidationReport = {
  status: 'ready' | 'attention';
  issues: ValidationIssue[];
};