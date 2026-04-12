/**
 * Validation barrel — the blessed import surface for the validation module.
 *
 * App code and tests should import from here (`from '../validation'`)
 * rather than reaching into validate.ts / types.ts / messages.ts directly.
 * Mirrors the parsers barrel convention established in src/engine/parsers.
 */

export { validate } from './validate';
export type { ValidateInput } from './validate';
export type { Severity, ValidationIssue, ValidationReport } from './types';