/**
 * Card primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { Text } from 'react-native';
import { Card } from '../Card';
import { renderInProvider, unmount } from './_render-helper';

describe('Card smoke', () => {
  it('renders with children', () => {
    const tree = renderInProvider(
      <Card>
        <Text>child</Text>
      </Card>
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });
});