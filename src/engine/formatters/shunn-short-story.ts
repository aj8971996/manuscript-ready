import type { ProseManuscript } from '../ir/prose';
import type { FormatterOptions, FormatterResult } from './index';

export async function formatShunnShortStory(
  _manuscript: ProseManuscript,
  _options: FormatterOptions,
): Promise<FormatterResult> {
  throw new Error('not implemented');
}