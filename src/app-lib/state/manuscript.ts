/**
 * Manuscript state store.
 *
 * Three slices:
 * - `current`: session-scoped, NEVER persisted. Holds the actively-open
 *   manuscript id and its category. Manuscript body/IR lives in sqlite,
 *   not here.
 * - `ui`: persisted across cold starts. Holds UI-only preferences — last
 *   category chip selected, user theme override.
 * - `manuscriptIndex`: persisted cache of the Library list projection
 *   (ManuscriptListItem[]). Enables first-paint of Library on cold start
 *   before the adapter hydrate resolves. Bodies never land here —
 *   projection is {id, title, category, createdAt} only, enforced by the
 *   adapter's listManuscripts return type.
 *
 * Persistence contract (P1 guardrail): the `partialize` fn below MUST
 * emit only `ui` and `manuscriptIndex`. Never add `current`, IR, body
 * content, or validation output to the persisted shape. Forcing-function
 * tests in __tests__/manuscript.test.ts assert this.
 *
 * `hydrate(adapter)` overwrites `manuscriptIndex` with the adapter's
 * listManuscripts() result. Idempotent. Adapter rejections are swallowed
 * with a console.warn — Library keeps showing its last-known state
 * rather than wiping on transient storage failures.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { Category } from '../engine-dispatch';
import type { ManuscriptListItem, PersistenceAdapter } from '../persistence';

export type ThemeOverride = 'light' | 'dark' | null;

export type CurrentSlice = {
  id: string | null;
  category: Category | null;
};

export type UiSlice = {
  lastSelectedCategory: Category | null;
  themeOverride: ThemeOverride;
};

export type ManuscriptIndexSlice = ReadonlyArray<ManuscriptListItem>;

export type ManuscriptState = {
  current: CurrentSlice;
  ui: UiSlice;
  manuscriptIndex: ManuscriptIndexSlice;
  setCurrent: (next: CurrentSlice) => void;
  clearCurrent: () => void;
  setLastSelectedCategory: (c: Category | null) => void;
  setThemeOverride: (t: ThemeOverride) => void;
  hydrate: (adapter: PersistenceAdapter) => Promise<void>;
};

// Keys that are persisted. Exported for test-time verification.
export type PersistedShape = {
  ui: UiSlice;
  manuscriptIndex: ManuscriptIndexSlice;
};

export const PERSIST_PARTIALIZE = (s: ManuscriptState): PersistedShape => ({
  ui: s.ui,
  manuscriptIndex: s.manuscriptIndex,
});

// In-memory storage adapter for tests and pre-commit-4 runtime.
export function createMemoryStorage(): StateStorage {
  const map = new Map<string, string>();
  return {
    getItem: (name) => map.get(name) ?? null,
    setItem: (name, value) => {
      map.set(name, value);
    },
    removeItem: (name) => {
      map.delete(name);
    },
  };
}

export const STORE_KEY = 'manuscript-ready:ui@1';

export function createManuscriptStore(storage: StateStorage = createMemoryStorage()) {
  return create<ManuscriptState>()(
    subscribeWithSelector(
      persist(
        (set) => ({
          current: { id: null, category: null },
          ui: { lastSelectedCategory: null, themeOverride: null },
          manuscriptIndex: [],
          setCurrent: (next) => set({ current: next }),
          clearCurrent: () => set({ current: { id: null, category: null } }),
          setLastSelectedCategory: (c) =>
            set((s) => ({ ui: { ...s.ui, lastSelectedCategory: c } })),
          setThemeOverride: (t) =>
            set((s) => ({ ui: { ...s.ui, themeOverride: t } })),
          hydrate: async (adapter) => {
            try {
              const items = await adapter.listManuscripts();
              set({ manuscriptIndex: items });
            } catch (err) {
              // Preserve last-known manuscriptIndex on transient storage failures.
              // Library will render its cached state; next successful hydrate
              // reconciles. Error surfaces in dev logs but does not crash UI.
              // eslint-disable-next-line no-console
              console.warn('manuscript store hydrate failed:', err);
            }
          },
        }),
        {
          name: STORE_KEY,
          storage: createJSONStorage(() => storage),
          partialize: PERSIST_PARTIALIZE,
          version: 1,
        },
      ),
    ),
  );
}

export type ManuscriptStore = ReturnType<typeof createManuscriptStore>;