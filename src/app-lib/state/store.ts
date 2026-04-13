/**
 * Singleton manuscript store for the running app.
 *
 * Tests that need isolation use `createManuscriptStore()` directly to get a
 * fresh store; components call `useManuscriptStore` (this singleton).
 *
 * Commit 4 will replace the default in-memory storage with an
 * expo-sqlite-backed adapter here. No other call sites change.
 */
import { createManuscriptStore } from './manuscript';

export const useManuscriptStore = createManuscriptStore();