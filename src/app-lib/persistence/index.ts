export type {
  PersistedManuscriptRow,
  ManuscriptListItem,
  InsertManuscriptInput,
  PersistenceAdapter,
  PersistenceError,
  SchemaVersion,
} from './types';
export { SCHEMA_VERSION, PersistenceFailure } from './types';
export { createInMemoryAdapter } from './in-memory';