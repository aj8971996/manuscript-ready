/**
 * Manuscript state store.
 *
 * Two slices:
 * - `current`: session-scoped, NEVER persisted. Holds the actively-open
 *   manuscript id and its category. Manuscript body/IR lives in sqlite
 *   (commit 4), not here.
 * - `ui`: persisted across cold starts. Holds UI-only preferences — last
 *   category chip selected, user theme override.
 *
 * Persistence contract (P1 guardrail): the `partialize` fn below MUST only
 * emit `ui`. Never add manuscript content, IR, or validation output to the
 * persisted shape. A forcing-function test asserts this.
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { Category } from '../engine-dispatch';

export type ThemeOverride = 'light' | 'dark' | null;

export type CurrentSlice = {
  id: string | null;
  category: Category | null;
};

export type UiSlice = {
  lastSelectedCategory: Category | null;
  themeOverride: ThemeOverride;
};

export type ManuscriptState = {
  current: CurrentSlice;
  ui: UiSlice;
  setCurrent: (next: CurrentSlice) => void;
  clearCurrent: () => void;
  setLastSelectedCategory: (c: Category | null) => void;
  setThemeOverride: (t: ThemeOverride) => void;
};

// Keys that are persisted. Exported for test-time verification.
export type PersistedShape = { ui: UiSlice };

export const PERSIST_PARTIALIZE = (s: ManuscriptState): PersistedShape => ({
  ui: s.ui,
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
          setCurrent: (next) => set({ current: next }),
          clearCurrent: () => set({ current: { id: null, category: null } }),
          setLastSelectedCategory: (c) =>
            set((s) => ({ ui: { ...s.ui, lastSelectedCategory: c } })),
          setThemeOverride: (t) =>
            set((s) => ({ ui: { ...s.ui, themeOverride: t } })),
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