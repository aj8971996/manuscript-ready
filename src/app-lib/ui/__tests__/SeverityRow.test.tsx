/**
 * SeverityRow primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { SeverityRow } from '../SeverityRow';
import type { ValidationIssue } from '../../../validation/types';
import { renderInProvider, unmount } from './_render-helper';

function makeIssue(severity: ValidationIssue['severity']): ValidationIssue {
  return {
    key: `k-${severity}`,
    severity,
    message: `msg ${severity}`,
  };
}

describe('SeverityRow smoke', () => {
  it('renders blocker severity', () => {
    const tree = renderInProvider(
      <SeverityRow issue={makeIssue('blocker')} onPress={() => {}} />,
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders attention severity', () => {
    const tree = renderInProvider(
      <SeverityRow issue={makeIssue('attention')} onPress={() => {}} />,
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders info severity', () => {
    const tree = renderInProvider(
      <SeverityRow issue={makeIssue('info')} onPress={() => {}} />,
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});