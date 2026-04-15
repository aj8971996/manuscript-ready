/**
 * SeveritySection primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { SeveritySection } from '../SeveritySection';
import type { ValidationIssue } from '../../../validation/types';
import { renderInProvider, unmount } from './_render-helper';

const ATTENTION_ISSUE: ValidationIssue = {
  key: 'metadata-missing:title',
  severity: 'attention',
  message: 'Title is missing.',
};

describe('SeveritySection smoke', () => {
  it('renders empty section with empty-state copy', () => {
    const tree = renderInProvider(
      <SeveritySection
        title="Must Fix"
        issues={[]}
        emptyCopy="No blockers"
        onIssuePress={() => {}}
      />,
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders populated section with rows', () => {
    const tree = renderInProvider(
      <SeveritySection
        title="Should Review"
        issues={[ATTENTION_ISSUE]}
        emptyCopy="(unused)"
        onIssuePress={() => {}}
      />,
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});