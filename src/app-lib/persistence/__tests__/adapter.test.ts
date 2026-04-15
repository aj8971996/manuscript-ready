import {
  createInMemoryAdapter,
  PersistenceFailure,
  SCHEMA_VERSION,
  type PersistenceAdapter,
} from '..';

const makeRow = (overrides: Partial<Parameters<PersistenceAdapter['insertManuscript']>[0]> = {}) => ({
  id: 'mr_001',
  schemaVersion: SCHEMA_VERSION,
  title: 'Untitled',
  category: 'short-story' as const,
  irJson: JSON.stringify({ blocks: [], meta: {} }),
  warnings: [] as ReadonlyArray<string>,
  ...overrides,
});

describe('PersistenceAdapter contract — in-memory implementation', () => {
  describe('init + migrate', () => {
    it('init is idempotent — calling twice does not throw', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await expect(adapter.init()).resolves.toBeUndefined();
    });

    it('migrate(0) is callable and resolves (no-op at v1)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await expect(adapter.migrate(0)).resolves.toBeUndefined();
    });

    it('migrate(1) is callable and resolves (already current)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await expect(adapter.migrate(1)).resolves.toBeUndefined();
    });
  });

  describe('insert + get round-trip', () => {
    it('round-trips all fields verbatim', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(makeRow({ id: 'mr_rt', title: 'Round Trip', createdAt: 1000 }));
      const got = await adapter.getManuscriptById('mr_rt');
      expect(got).toEqual({
        id: 'mr_rt',
        schemaVersion: SCHEMA_VERSION,
        title: 'Round Trip',
        category: 'short-story',
        irJson: JSON.stringify({ blocks: [], meta: {} }),
        createdAt: 1000,
        warnings: [],
      });
    });

    it('preserves irJson byte-equivalent (no JSON re-serialization drift)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      const irJson = '{"blocks":[{"t":"p","r":[{"s":"hello"}]}],"meta":{"wc":1}}';
      await adapter.insertManuscript(makeRow({ id: 'mr_bytes', irJson }));
      const got = await adapter.getManuscriptById('mr_bytes');
      expect(got?.irJson).toBe(irJson);
    });

    it('returns null for missing id (does not reject)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await expect(adapter.getManuscriptById('nope')).resolves.toBeNull();
    });

    it('auto-fills createdAt when omitted, monotonic across calls', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(makeRow({ id: 'mr_a' }));
      await adapter.insertManuscript(makeRow({ id: 'mr_b' }));
      const a = await adapter.getManuscriptById('mr_a');
      const b = await adapter.getManuscriptById('mr_b');
      expect(a?.createdAt).toBeGreaterThan(0);
      expect(b?.createdAt).toBeGreaterThan(a!.createdAt);
    });

    it('respects explicit createdAt when provided', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(makeRow({ id: 'mr_fixed', createdAt: 42 }));
      const got = await adapter.getManuscriptById('mr_fixed');
      expect(got?.createdAt).toBe(42);
    });
  });

  describe('warnings field — raw key storage', () => {
    it('round-trips a non-empty warnings array verbatim', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      const warnings = ['unsupported-block:ul', 'metadata-missing:title'];
      await adapter.insertManuscript(makeRow({ id: 'mr_w1', warnings }));
      const got = await adapter.getManuscriptById('mr_w1');
      expect(got?.warnings).toEqual(warnings);
    });

    it('preserves warnings order and duplicates as inserted (storage is not the dedup layer)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      // Validation dedupes; storage must not. Storing raw means the
      // validation layer can change its dedup policy without a migration.
      const warnings = [
        'mammoth-warning',
        'unsupported-block:ul',
        'mammoth-warning',
        'mammoth-warning',
      ];
      await adapter.insertManuscript(makeRow({ id: 'mr_w2', warnings }));
      const got = await adapter.getManuscriptById('mr_w2');
      expect(got?.warnings).toEqual(warnings);
    });

    it('defensively copies warnings — caller mutation does not affect stored row', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      const warnings: string[] = ['metadata-missing:title'];
      await adapter.insertManuscript(makeRow({ id: 'mr_w3', warnings }));
      warnings.push('mutated-after-insert');
      const got = await adapter.getManuscriptById('mr_w3');
      expect(got?.warnings).toEqual(['metadata-missing:title']);
    });
  });

  describe('listManuscripts', () => {
    it('returns [] on empty DB', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await expect(adapter.listManuscripts()).resolves.toEqual([]);
    });

    it('returns rows in insertion order', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(makeRow({ id: 'mr_1', title: 'First' }));
      await adapter.insertManuscript(makeRow({ id: 'mr_2', title: 'Second' }));
      await adapter.insertManuscript(makeRow({ id: 'mr_3', title: 'Third' }));
      const list = await adapter.listManuscripts();
      expect(list.map((r) => r.id)).toEqual(['mr_1', 'mr_2', 'mr_3']);
    });

    it('projection excludes irJson (Library never loads bodies)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(makeRow({ id: 'mr_proj' }));
      const [item] = await adapter.listManuscripts();
      expect(item).toBeDefined();
      expect(Object.keys(item!).sort()).toEqual(['category', 'createdAt', 'id', 'title']);
    });

    it('projection explicitly excludes warnings (Library never loads them)', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(
        makeRow({ id: 'mr_wproj', warnings: ['unsupported-block:ul'] }),
      );
      const [item] = await adapter.listManuscripts();
      expect(item).toBeDefined();
      expect((item as Record<string, unknown>).warnings).toBeUndefined();
    });
  });

  describe('failure modes', () => {
    it('insertManuscript before init rejects with not-initialized', async () => {
      const adapter = createInMemoryAdapter();
      await expect(adapter.insertManuscript(makeRow())).rejects.toMatchObject({
        name: 'PersistenceFailure',
        detail: { kind: 'not-initialized' },
      });
    });

    it('getManuscriptById before init rejects with not-initialized', async () => {
      const adapter = createInMemoryAdapter();
      await expect(adapter.getManuscriptById('x')).rejects.toBeInstanceOf(PersistenceFailure);
    });

    it('listManuscripts before init rejects with not-initialized', async () => {
      const adapter = createInMemoryAdapter();
      await expect(adapter.listManuscripts()).rejects.toBeInstanceOf(PersistenceFailure);
    });

    it('duplicate id insert rejects with id-collision', async () => {
      const adapter = createInMemoryAdapter();
      await adapter.init();
      await adapter.insertManuscript(makeRow({ id: 'mr_dup' }));
      await expect(adapter.insertManuscript(makeRow({ id: 'mr_dup' }))).rejects.toMatchObject({
        detail: { kind: 'id-collision', id: 'mr_dup' },
      });
    });
  });

  describe('purity — the app-pure transitivity forcing function', () => {
    it('the persistence barrel does not transitively import react-native', () => {
      // The fact that this file imports from '..' under the app-pure project
      // (testEnvironment: node) and the suite loads at all is the assertion.
      // If a later change adds an RN-reaching import anywhere in the module
      // graph, this file will fail to load under jest-node.
      expect(createInMemoryAdapter).toBeDefined();
      expect(SCHEMA_VERSION).toBe(1);
    });
  });
});