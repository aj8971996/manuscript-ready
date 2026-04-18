import {
  createInMemoryAdapter,
  SCHEMA_VERSION,
  type PersistenceAdapter,
} from '../../persistence';
import { loadById } from '../load-by-id';

const makeRow = (overrides: Partial<Parameters<PersistenceAdapter['insertManuscript']>[0]> = {}) => ({
  id: 'mr_001',
  schemaVersion: SCHEMA_VERSION,
  title: 'Untitled',
  category: 'short-story' as const,
  irJson: JSON.stringify({ blocks: [], meta: {} }),
  warnings: [] as ReadonlyArray<string>,
  ...overrides,
});

describe('loadById', () => {
  describe('happy path', () => {
    it('returns ok:true with the row verbatim for a known id', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(
        makeRow({ id: 'mr_known', title: 'Known', createdAt: 1000 }),
      );

      const result = await loadById(adapter, 'mr_known');

      expect(result).toEqual({
        ok: true,
        manuscript: {
          id: 'mr_known',
          schemaVersion: SCHEMA_VERSION,
          title: 'Known',
          category: 'short-story',
          irJson: JSON.stringify({ blocks: [], meta: {} }),
          createdAt: 1000,
          warnings: [],
        },
      });
    });
  });

  describe('not-found', () => {
    it('returns ok:false not-found when adapter returns null', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();

      const result = await loadById(adapter, 'mr_missing');

      expect(result).toEqual({ ok: false, failure: 'not-found' });
    });
  });

  describe('storage-failure', () => {
    it('maps PersistenceFailure (e.g. not-initialized) to storage-failure', async () => {
      // Skip init() — adapter will throw PersistenceFailure(not-initialized).
      const adapter = createInMemoryAdapter();

      const result = await loadById(adapter, 'mr_anything');

      expect(result).toEqual({ ok: false, failure: 'storage-failure' });
    });

    it('maps generic thrown Error to storage-failure', async () => {
      const brokenAdapter: PersistenceAdapter = {
        async init() {},
        async migrate() {},
        async insertManuscript() {
          throw new Error('not used');
        },
        async updateManuscript() {
          throw new Error('not used');
        },
        async getManuscriptById() {
          throw new Error('boom');
        },
        async listManuscripts() {
          return [];
        },
      };

      const result = await loadById(brokenAdapter, 'mr_anything');

      expect(result).toEqual({ ok: false, failure: 'storage-failure' });
    });
  });
});