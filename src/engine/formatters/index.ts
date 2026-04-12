/**
 * Shared types and re-exports for the formatters layer.
 *
 * FormatterOptions is consumed by every prose formatter (shunn-short-story,
 * shunn-novel, ...). Script-format IRs will have their own options type when
 * they land, colocated with their formatters.
 */

export type FormatterOptions = {
  variant: 'modern' | 'classic';           // default 'modern'
  emphasisStyle: 'italic' | 'underline';   // coupled to variant in UI; decoupled in code
  endMarker: 'hash' | 'the-end-title' | 'the-end-caps' | 'none';  // default 'hash'
};

export type FormatterResult = {
  bytes: Uint8Array;
  suggestedFilename: string;
  warnings: string[];
};

export { formatShunnShortStory } from './shunn-short-story';