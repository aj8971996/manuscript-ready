import { isSceneBreakLine } from '../scene-detect';

describe('isSceneBreakLine', () => {
  describe('accepts locked markers', () => {
    test.each([
      ['#'],
      ['***'],
      ['* * *'],
      ['~~~'],
    ])('recognizes %p as a scene break', (line) => {
      expect(isSceneBreakLine(line)).toBe(true);
    });
  });

  describe('normalizes surrounding and inner whitespace', () => {
    test('trims leading and trailing whitespace around "#"', () => {
      expect(isSceneBreakLine('   #   ')).toBe(true);
    });

    test('trims whitespace around "***"', () => {
      expect(isSceneBreakLine('\t***\t')).toBe(true);
    });

    test('collapses multiple inner spaces in "* * *"', () => {
      expect(isSceneBreakLine('*   *   *')).toBe(true);
    });

    test('collapses tabs between asterisks', () => {
      expect(isSceneBreakLine('*\t*\t*')).toBe(true);
    });
  });

  describe('rejects non-markers', () => {
    test.each([
      [''],
      ['   '],
      ['##'],
      ['####'],
      ['**'],
      ['****'],
      ['~~'],
      ['~~~~'],
      ['* *'],
      ['* * * *'],
      ['# #'],
      ['- - -'],
      ['---'],
      ['# chapter one'],
      ['text before ***'],
      ['*** text after'],
      ['a'],
      ['The End'],
    ])('rejects %p', (line) => {
      expect(isSceneBreakLine(line)).toBe(false);
    });
  });

  describe('rejects lines containing other content', () => {
    test('rejects "# scene break" even though it starts with a hash', () => {
      expect(isSceneBreakLine('# scene break')).toBe(false);
    });

    test('rejects "*** end of scene"', () => {
      expect(isSceneBreakLine('*** end of scene')).toBe(false);
    });
  });
});