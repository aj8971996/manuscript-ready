import {
  createManuscriptStore,
  createMemoryStorage,
  PERSIST_PARTIALIZE,
  STORE_KEY,
  type ManuscriptState,
} from '../manuscript';

describe('manuscript store — initial shape', () => {
  it('starts with null current and null ui preferences', () => {
    const store = createManuscriptStore();
    const s = store.getState();
    expect(s.current).toEqual({ id: null, category: null });
    expect(s.ui).toEqual({ lastSelectedCategory: null, themeOverride: null });
  });
});

describe('manuscript store — setters', () => {
  it('setCurrent updates current slice', () => {
    const store = createManuscriptStore();
    store.getState().setCurrent({ id: 'abc', category: 'short-story' });
    expect(store.getState().current).toEqual({ id: 'abc', category: 'short-story' });
  });

  it('clearCurrent resets to null/null', () => {
    const store = createManuscriptStore();
    store.getState().setCurrent({ id: 'abc', category: 'novelette' });
    store.getState().clearCurrent();
    expect(store.getState().current).toEqual({ id: null, category: null });
  });

  it('setLastSelectedCategory updates ui only', () => {
    const store = createManuscriptStore();
    store.getState().setLastSelectedCategory('novella');
    expect(store.getState().ui.lastSelectedCategory).toBe('novella');
    expect(store.getState().current.category).toBeNull();
  });

  it('setThemeOverride updates ui only', () => {
    const store = createManuscriptStore();
    store.getState().setThemeOverride('dark');
    expect(store.getState().ui.themeOverride).toBe('dark');
  });
});

describe('manuscript store — persist partialize contract (P1)', () => {
  it('partialize emits only ui, never current', () => {
    const fakeState = {
      current: { id: 'secret', category: 'novel' },
      ui: { lastSelectedCategory: 'short-story', themeOverride: 'dark' },
      setCurrent: () => {},
      clearCurrent: () => {},
      setLastSelectedCategory: () => {},
      setThemeOverride: () => {},
    } as unknown as ManuscriptState;

    const out = PERSIST_PARTIALIZE(fakeState);
    expect(out).toEqual({ ui: fakeState.ui });
    expect('current' in out).toBe(false);
  });

  it('persisted storage payload does not contain manuscript id or category under current', async () => {
    const storage = createMemoryStorage();
    const store = createManuscriptStore(storage);
    store.getState().setCurrent({ id: 'manuscript-abc', category: 'novel' });
    store.getState().setLastSelectedCategory('novelette');

    // Give persist middleware a tick to flush.
    await new Promise((r) => setTimeout(r, 0));

    const raw = await storage.getItem(STORE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);

    // Zustand persist wraps as { state, version }.
    expect(parsed.state).toEqual({
      ui: { lastSelectedCategory: 'novelette', themeOverride: null },
    });
    expect(parsed.state.current).toBeUndefined();
    // Defense-in-depth: id must not appear anywhere in the serialized blob.
    expect(raw).not.toContain('manuscript-abc');
  });
});

describe('manuscript store — selector isolation (subscribeWithSelector)', () => {
  it('ui subscriber does not fire when current changes', () => {
    const store = createManuscriptStore();
    let uiFireCount = 0;
    const unsub = store.subscribe(
      (s) => s.ui.lastSelectedCategory,
      () => {
        uiFireCount += 1;
      },
    );

    store.getState().setCurrent({ id: 'x', category: 'short-story' });
    store.getState().setCurrent({ id: 'y', category: 'novella' });

    expect(uiFireCount).toBe(0);

    store.getState().setLastSelectedCategory('novelette');
    expect(uiFireCount).toBe(1);

    unsub();
  });
});