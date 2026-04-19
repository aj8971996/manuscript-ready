/**
 * SectionHeader primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { Text } from 'react-native';
import { SectionHeader } from '../SectionHeader';
import { renderInProvider, unmount } from './_render-helper';

describe('SectionHeader smoke', () => {
  it('renders title only', () => {
    const tree = renderInProvider(<SectionHeader title="Blockers" />);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders title with trailing slot', () => {
    const tree = renderInProvider(
      <SectionHeader title="Blockers" trailing={<Text>3</Text>} />
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});