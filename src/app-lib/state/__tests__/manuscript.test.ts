import {
  createManuscriptStore,
  createMemoryStorage,
  PERSIST_PARTIALIZE,
  STORE_KEY,
  type ManuscriptState,
} from '../manuscript';
import { createInMemoryAdapter, SCHEMA_VERSION } from '../../persistence';

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
      manuscriptIndex: [
        { id: 'abc', title: 'Sample', category: 'short-story' as const, createdAt: 1 },
      ],
      setCurrent: () => {},
      clearCurrent: () => {},
      setLastSelectedCategory: () => {},
      setThemeOverride: () => {},
      hydrate: async () => {},
    } as unknown as ManuscriptState;

    const out = PERSIST_PARTIALIZE(fakeState);
    expect(out).toEqual({
      ui: fakeState.ui,
      manuscriptIndex: fakeState.manuscriptIndex,
    });
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

    expect(parsed.state).toEqual({
      ui: { lastSelectedCategory: 'novelette', themeOverride: null },
      manuscriptIndex: [],
    });
    expect(parsed.state.current).toBeUndefined();
    // Defense-in-depth: id must not appear anywhere in the serialized blob.
    expect(raw).not.toContain('manuscript-abc');
    // P1 rail: no body/IR ever reaches the persisted blob.
    expect(raw).not.toContain('irJson');
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

describe('manuscript store — manuscriptIndex + hydrate', () => {
  async function seededAdapter(rows: Array<{ id: string; title: string; category: 'short-story' | 'novelette' | 'novella' | 'novel'; createdAt: number }>) {
    const a = createInMemoryAdapter();
    await a.init();
    for (const r of rows) {
      await a.insertManuscript({
        id: r.id,
        schemaVersion: SCHEMA_VERSION,
        title: r.title,
        category: r.category,
        irJson: JSON.stringify({ schemaVersion: 1, metadata: {}, body: [] }),
        warnings: [],
        createdAt: r.createdAt,
      });
    }
    return a;
  }

  it('manuscriptIndex starts empty', () => {
    const store = createManuscriptStore();
    expect(store.getState().manuscriptIndex).toEqual([]);
  });

  it('hydrate populates manuscriptIndex from adapter.listManuscripts', async () => {
    const adapter = await seededAdapter([
      { id: 'a', title: 'Alpha', category: 'short-story', createdAt: 100 },
      { id: 'b', title: 'Beta', category: 'novel', createdAt: 200 },
      { id: 'c', title: 'Gamma', category: 'novelette', createdAt: 300 },
    ]);
    const store = createManuscriptStore();
    await store.getState().hydrate(adapter);

    expect(store.getState().manuscriptIndex).toEqual([
      { id: 'a', title: 'Alpha', category: 'short-story', createdAt: 100 },
      { id: 'b', title: 'Beta', category: 'novel', createdAt: 200 },
      { id: 'c', title: 'Gamma', category: 'novelette', createdAt: 300 },
    ]);
  });

  it('hydrate is idempotent and overwrites on each call', async () => {
    const store = createManuscriptStore();

    const first = await seededAdapter([
      { id: 'x', title: 'First', category: 'short-story', createdAt: 1 },
    ]);
    await store.getState().hydrate(first);
    expect(store.getState().manuscriptIndex).toHaveLength(1);

    const second = await seededAdapter([
      { id: 'y', title: 'Second', category: 'novel', createdAt: 2 },
      { id: 'z', title: 'Third', category: 'novella', createdAt: 3 },
    ]);
    await store.getState().hydrate(second);

    const idx = store.getState().manuscriptIndex;
    expect(idx).toHaveLength(2);
    expect(idx.map((i) => i.id)).toEqual(['y', 'z']);
  });

  it('hydrate against an empty adapter leaves manuscriptIndex as []', async () => {
    const adapter = await seededAdapter([]);
    const store = createManuscriptStore();
    await store.getState().hydrate(adapter);
    expect(store.getState().manuscriptIndex).toEqual([]);
  });

  it('manuscriptIndex items contain exactly {id, title, category, createdAt}', async () => {
    const adapter = await seededAdapter([
      { id: 'a', title: 'Alpha', category: 'short-story', createdAt: 100 },
    ]);
    const store = createManuscriptStore();
    await store.getState().hydrate(adapter);

    const item = store.getState().manuscriptIndex[0]!;
    expect(Object.keys(item).sort()).toEqual(
      ['category', 'createdAt', 'id', 'title'].sort(),
    );
  });

  it('hydrate swallows adapter rejections and leaves manuscriptIndex unchanged', async () => {
    const seeded = await seededAdapter([
      { id: 'a', title: 'Alpha', category: 'short-story', createdAt: 1 },
    ]);
    const store = createManuscriptStore();
    await store.getState().hydrate(seeded);
    expect(store.getState().manuscriptIndex).toHaveLength(1);

    const broken = {
      async init() {},
      async migrate() {},
      async insertManuscript() { return ''; },
      async updateManuscript() { throw new Error('not used'); },
      async getManuscriptById() { return null; },
      async listManuscripts() { throw new Error('disk corrupt'); },
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await store.getState().hydrate(broken);
    warnSpy.mockRestore();

    // Previous state preserved — no wipe on failure.
    expect(store.getState().manuscriptIndex).toHaveLength(1);
    expect(store.getState().manuscriptIndex[0]!.id).toBe('a');
  });
});