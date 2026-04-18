/**
 * ManuscriptRow primitive smoke tests (app-rn project).
 */
import * as React from 'react';
import { act } from 'react-test-renderer';
import { ManuscriptRow } from '../ManuscriptRow';
import { renderInProvider, unmount } from './_render-helper';

const BASE_PROPS = {
  title: 'My Draft',
  category: 'short-story',
  createdAt: 1704067200000,
  onPress: () => {},
};

describe('ManuscriptRow smoke', () => {
  it('renders with minimal required props', () => {
    const tree = renderInProvider(<ManuscriptRow {...BASE_PROPS} />);
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('renders with a long title', () => {
    const longTitle = 'A'.repeat(200);
    const tree = renderInProvider(
      <ManuscriptRow {...BASE_PROPS} title={longTitle} />,
    );
    expect(tree.toJSON()).toBeTruthy();
    unmount(tree);
  });

  it('fires onPress when the row is pressed', () => {
    const onPress = jest.fn();
    const tree = renderInProvider(
      <ManuscriptRow {...BASE_PROPS} onPress={onPress} />,
    );
    const pressable = tree.root.findAllByProps({
      accessibilityRole: 'button',
    })[0];
    expect(pressable).toBeDefined();
    act(() => {
      pressable!.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    unmount(tree);
  });
});