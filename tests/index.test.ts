/**
 * Regression tests for better-auth-typeorm-adapter.
 *
 * Each test pins a behavior that was broken (or missing) before the 1.2.0
 * rewrite: where-clause operators, OR connectors, case-insensitive matching,
 * `update` returning null, single-row update semantics, type round-trips on
 * SQLite, lazy DataSource initialization, plugin model resolution and the
 * `createSchema` CLI contract.
 *
 * Runs on the built-in Node.js test runner:
 *   node --experimental-strip-types --test tests/index.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import type { BetterAuthOptions } from 'better-auth/types';
import { DataSource, EntitySchema } from 'typeorm';
import { generateEntitySchemas, typeormAdapter, type TypeORMAdapterConfig } from '../src/index.ts';

type TestContext = {
  dataSource: DataSource;
  adapter: ReturnType<ReturnType<typeof typeormAdapter>>;
};

const openDataSources: DataSource[] = [];

/**
 * Creates an isolated in-memory SQLite context with entities generated from
 * the given Better Auth options. The DataSource is intentionally NOT
 * initialized here: the adapter must do it lazily.
 */
function createContext(
  options: BetterAuthOptions = {},
  adapterConfig: Partial<TypeORMAdapterConfig> = {},
): TestContext {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: adapterConfig.entities
      ? (Object.values(adapterConfig.entities) as (Function | EntitySchema)[])
      : generateEntitySchemas(options, { usePlural: adapterConfig.usePlural }),
    synchronize: true,
    logging: false,
  });
  openDataSources.push(dataSource);
  const adapter = typeormAdapter({ dataSource, ...adapterConfig })(options);
  return { dataSource, adapter };
}

/** Inserts a user with sane defaults, overridable per test. */
async function createUser(
  adapter: TestContext['adapter'],
  overrides: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const unique = Math.random().toString(36).slice(2);
  return adapter.create({
    model: 'user',
    data: {
      name: `user-${unique}`,
      email: `${unique}@example.com`,
      emailVerified: false,
      ...overrides,
    },
  });
}

after(async () => {
  for (const dataSource of openDataSources) {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
});

describe('lazy DataSource initialization', () => {
  it('initializes the DataSource on first use', async () => {
    const { dataSource, adapter } = createContext();
    assert.equal(dataSource.isInitialized, false);
    const rows = await adapter.findMany({ model: 'user' });
    assert.deepEqual(rows, []);
    assert.equal(dataSource.isInitialized, true);
  });
});

describe('where operators (regression: everything used to collapse to eq)', () => {
  it('supports lt / lte / gt / gte on dates', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { createdAt: new Date('2020-01-01') });
    await createUser(adapter, { createdAt: new Date('2022-01-01') });
    await createUser(adapter, { createdAt: new Date('2024-01-01') });

    const cutoff = new Date('2022-01-01');
    const lt = await adapter.findMany({
      model: 'user',
      where: [{ field: 'createdAt', operator: 'lt', value: cutoff }],
    });
    const lte = await adapter.findMany({
      model: 'user',
      where: [{ field: 'createdAt', operator: 'lte', value: cutoff }],
    });
    const gt = await adapter.findMany({
      model: 'user',
      where: [{ field: 'createdAt', operator: 'gt', value: cutoff }],
    });
    const gte = await adapter.findMany({
      model: 'user',
      where: [{ field: 'createdAt', operator: 'gte', value: cutoff }],
    });

    assert.equal(lt.length, 1);
    assert.equal(lte.length, 2);
    assert.equal(gt.length, 1);
    assert.equal(gte.length, 2);
  });

  it('supports in / not_in', async () => {
    const { adapter } = createContext();
    const a = await createUser(adapter);
    const b = await createUser(adapter);
    await createUser(adapter);

    const included = await adapter.findMany({
      model: 'user',
      where: [{ field: 'id', operator: 'in', value: [a.id, b.id] }],
    });
    const excluded = await adapter.findMany({
      model: 'user',
      where: [{ field: 'id', operator: 'not_in', value: [a.id, b.id] }],
    });

    assert.equal(included.length, 2);
    assert.equal(excluded.length, 1);
  });

  it('supports contains / starts_with / ends_with', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'alpha' });
    await createUser(adapter, { name: 'alphabet' });
    await createUser(adapter, { name: 'beta' });

    const contains = await adapter.findMany({
      model: 'user',
      where: [{ field: 'name', operator: 'contains', value: 'lph' }],
    });
    const startsWith = await adapter.findMany({
      model: 'user',
      where: [{ field: 'name', operator: 'starts_with', value: 'alpha' }],
    });
    const endsWith = await adapter.findMany({
      model: 'user',
      where: [{ field: 'name', operator: 'ends_with', value: 'bet' }],
    });

    assert.equal(contains.length, 2);
    assert.equal(startsWith.length, 2);
    assert.equal(endsWith.length, 1);
  });

  it('supports ne and null comparisons (IS NULL / IS NOT NULL)', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { image: 'https://example.com/a.png' });
    await createUser(adapter);

    const withImage = await adapter.findMany({
      model: 'user',
      where: [{ field: 'image', operator: 'ne', value: null }],
    });
    const withoutImage = await adapter.findMany({
      model: 'user',
      where: [{ field: 'image', value: null }],
    });

    assert.equal(withImage.length, 1);
    assert.equal(withoutImage.length, 1);
  });

  it('counts with operators', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { createdAt: new Date('2020-01-01') });
    await createUser(adapter, { createdAt: new Date('2024-01-01') });

    const count = await adapter.count({
      model: 'user',
      where: [{ field: 'createdAt', operator: 'lt', value: new Date('2022-01-01') }],
    });
    assert.equal(count, 1);
  });

  it('deletes expired sessions with lt (regression: expired cleanup was a no-op)', async () => {
    const { adapter } = createContext();
    const user = await createUser(adapter);
    const sessionDefaults = { createdAt: new Date(), updatedAt: new Date() };
    await adapter.create({
      model: 'session',
      data: {
        userId: user.id,
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 60_000),
        ...sessionDefaults,
      },
    });
    await adapter.create({
      model: 'session',
      data: {
        userId: user.id,
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 60_000),
        ...sessionDefaults,
      },
    });

    const deleted = await adapter.deleteMany({
      model: 'session',
      where: [{ field: 'expiresAt', operator: 'lt', value: new Date() }],
    });
    const remaining = await adapter.findMany<Record<string, any>>({ model: 'session' });

    assert.equal(deleted, 1);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]!.token, 'valid-token');
  });
});

describe('OR connector (regression: OR used to be flattened into AND)', () => {
  it('combines OR branches', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'alpha' });
    await createUser(adapter, { name: 'beta' });
    await createUser(adapter, { name: 'gamma' });

    const rows = await adapter.findMany({
      model: 'user',
      where: [
        { field: 'name', value: 'alpha', connector: 'OR' },
        { field: 'name', value: 'beta', connector: 'OR' },
      ],
    });
    assert.equal(rows.length, 2);
  });

  it('combines an OR condition with an AND condition on the same field instead of overwriting it', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'alpha' });
    await createUser(adapter, { name: 'beta' });

    const rows = await adapter.findMany({
      model: 'user',
      where: [
        { field: 'name', value: 'alpha' },
        { field: 'name', value: 'beta', connector: 'OR' },
      ],
    });
    assert.equal(rows.length, 0);
  });

  it('combines an AND base group with OR branches', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'alpha', emailVerified: true });
    await createUser(adapter, { name: 'beta', emailVerified: false });
    await createUser(adapter, { name: 'gamma', emailVerified: false });

    const rows = await adapter.findMany<Record<string, any>>({
      model: 'user',
      where: [
        { field: 'emailVerified', value: false },
        { field: 'name', value: 'alpha', connector: 'OR' },
        { field: 'name', value: 'beta', connector: 'OR' },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.name, 'beta');
  });
});

describe('case-insensitive mode (regression: mode was ignored)', () => {
  it('matches eq case-insensitively', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { email: 'someone@example.com' });

    const found = await adapter.findOne({
      model: 'user',
      where: [
        { field: 'email', value: 'SOMEONE@Example.COM', mode: 'insensitive' },
      ],
    });
    assert.ok(found);
  });

  it('matches contains case-insensitively', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'Alpha Centauri' });

    const rows = await adapter.findMany({
      model: 'user',
      where: [
        { field: 'name', operator: 'contains', value: 'alpha', mode: 'insensitive' },
      ],
    });
    assert.equal(rows.length, 1);
  });
});

describe('update semantics (regression: threw on missing record, fanned out on broad where)', () => {
  it('returns null when no record matches', async () => {
    const { adapter } = createContext();
    const result = await adapter.update({
      model: 'user',
      where: [{ field: 'email', value: 'missing@example.com' }],
      update: { name: 'nobody' },
    });
    assert.equal(result, null);
  });

  it('returns the updated record', async () => {
    const { adapter } = createContext();
    const user = await createUser(adapter, { name: 'before' });
    const updated = await adapter.update<Record<string, any>>({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
      update: { name: 'after' },
    });
    assert.equal(updated!.name, 'after');
    assert.equal(updated!.id, user.id);
  });

  it('updates a single row even when the where clause matches several', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'dup' });
    await createUser(adapter, { name: 'dup' });

    await adapter.update({
      model: 'user',
      where: [{ field: 'name', value: 'dup' }],
      update: { emailVerified: true },
    });

    const verified = await adapter.count({
      model: 'user',
      where: [{ field: 'emailVerified', value: true }],
    });
    assert.equal(verified, 1);
  });

  it('updateMany updates every matching row and returns the count', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'bulk' });
    await createUser(adapter, { name: 'bulk' });
    await createUser(adapter, { name: 'other' });

    const affected = await adapter.updateMany({
      model: 'user',
      where: [{ field: 'name', value: 'bulk' }],
      update: { emailVerified: true },
    });
    assert.equal(affected, 2);
  });
});

describe('delete semantics', () => {
  it('does not throw when deleting a missing record', async () => {
    const { adapter } = createContext();
    await adapter.delete({
      model: 'user',
      where: [{ field: 'email', value: 'missing@example.com' }],
    });
  });

  it('deleteMany returns the number of removed rows', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'gone' });
    await createUser(adapter, { name: 'gone' });

    const deleted = await adapter.deleteMany({
      model: 'user',
      where: [{ field: 'name', value: 'gone' }],
    });
    assert.equal(deleted, 2);
  });
});

describe('type round-trips on SQLite (regression: booleans came back as 0/1)', () => {
  it('returns booleans as booleans', async () => {
    const { adapter } = createContext();
    const user = await createUser(adapter, { emailVerified: true });
    const found = await adapter.findOne<Record<string, any>>({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
    });
    assert.equal(found!.emailVerified, true);
    assert.equal(typeof found!.emailVerified, 'boolean');
  });

  it('returns dates as Date instances', async () => {
    const { adapter } = createContext();
    const user = await createUser(adapter);
    const found = await adapter.findOne<Record<string, any>>({
      model: 'user',
      where: [{ field: 'id', value: user.id }],
    });
    assert.ok(found!.createdAt instanceof Date);
  });
});

describe('sorting and pagination', () => {
  it('applies sortBy, limit and offset together', async () => {
    const { adapter } = createContext();
    await createUser(adapter, { name: 'a' });
    await createUser(adapter, { name: 'b' });
    await createUser(adapter, { name: 'c' });

    const rows = await adapter.findMany<Record<string, any>>({
      model: 'user',
      sortBy: { field: 'name', direction: 'desc' },
      limit: 2,
      offset: 1,
    });
    assert.deepEqual(
      rows.map((row) => row.name),
      ['b', 'a'],
    );
  });
});

describe('plugin models (regression: only the 4 core models could be mapped)', () => {
  it('resolves tables added by plugin schemas', async () => {
    const options = {
      plugins: [
        {
          id: 'todo-plugin',
          schema: {
            todo: {
              fields: {
                title: { type: 'string', required: true },
                done: { type: 'boolean', defaultValue: false },
              },
            },
          },
        },
      ],
    } as unknown as BetterAuthOptions;

    const { adapter } = createContext(options);
    const created = await adapter.create<Record<string, any>>({
      model: 'todo',
      data: { title: 'write regression tests', done: false },
    });
    const found = await adapter.findOne<Record<string, any>>({
      model: 'todo',
      where: [{ field: 'id', value: created.id }],
    });
    assert.equal(found!.title, 'write regression tests');
    assert.equal(found!.done, false);
  });
});

describe('incrementOne rate-limit guard (regression: issue #5 infinite loop)', () => {
  /** Mirrors the API key plugin's rate-limit table shape. */
  const apiKeyOptions = {
    plugins: [
      {
        id: 'apikey-like',
        schema: {
          apikey: {
            fields: {
              requestCount: { type: 'number', required: false },
              lastRequest: { type: 'date', required: false },
            },
          },
        },
      },
    ],
  } as unknown as BetterAuthOptions;

  it('consumes the first rate-limit slot when lastRequest is null, then reports the lost race', async () => {
    const { adapter } = createContext(apiKeyOptions);
    const row = await adapter.create<Record<string, any>>({
      model: 'apikey',
      data: { requestCount: 0 },
    });
    assert.equal(row.lastRequest ?? null, null);

    const now = new Date();
    const guard = [
      { field: 'id', value: row.id },
      { field: 'lastRequest', value: null },
    ];

    const first = await adapter.incrementOne<Record<string, any>>({
      model: 'apikey',
      where: guard,
      increment: {},
      set: { requestCount: 1, lastRequest: now },
    });
    assert.ok(first, 'guarded update must succeed while lastRequest IS NULL');
    assert.equal(first!.requestCount, 1);

    const second = await adapter.incrementOne<Record<string, any>>({
      model: 'apikey',
      where: guard,
      increment: {},
      set: { requestCount: 1, lastRequest: new Date() },
    });
    assert.equal(second, null, 'guard must not match once lastRequest is set');
  });

  it('applies numeric increments to the matched row', async () => {
    const { adapter } = createContext(apiKeyOptions);
    const row = await adapter.create<Record<string, any>>({
      model: 'apikey',
      data: { requestCount: 1, lastRequest: new Date() },
    });

    const updated = await adapter.incrementOne<Record<string, any>>({
      model: 'apikey',
      where: [{ field: 'id', value: row.id }],
      increment: { requestCount: 5 },
    });
    assert.equal(updated!.requestCount, 6);
  });
});

describe('consumeOne (single-use token consumption)', () => {
  it('returns the row exactly once and null afterwards', async () => {
    const { adapter } = createContext();
    const user = await createUser(adapter);
    const where = [{ field: 'id', value: user.id }];

    const consumed = await adapter.consumeOne<Record<string, any>>({ model: 'user', where });
    assert.equal(consumed!.id, user.id);

    const again = await adapter.consumeOne<Record<string, any>>({ model: 'user', where });
    assert.equal(again, null);
  });
});

describe('generateEntitySchemas', () => {
  it('creates one EntitySchema per Better Auth model', () => {
    const schemas = generateEntitySchemas({});
    const names = schemas.map((schema) => schema.options.name).sort();
    assert.deepEqual(names, ['account', 'session', 'user', 'verification']);
  });

  it('applies plural table names when configured', () => {
    const schemas = generateEntitySchemas({}, { usePlural: true });
    const names = schemas.map((schema) => schema.options.tableName).sort();
    assert.deepEqual(names, ['accounts', 'sessions', 'users', 'verifications']);
  });
});

describe('createSchema CLI contract (regression: wrote files directly, no {code, path})', () => {
  it('returns generated code and path without touching the filesystem', async () => {
    const { adapter } = createContext();
    const result = await adapter.createSchema!({}, 'generated/auth-entities.ts');

    assert.equal(result.path, 'generated/auth-entities.ts');
    assert.equal(result.overwrite, true);
    assert.ok(result.code.includes(`@PrimaryColumn('text')`));
    assert.ok(result.code.includes(`@Entity('user')`));
    assert.ok(result.code.includes(`@ManyToOne(() => User`));
    assert.ok(!result.code.includes('PrimaryGeneratedColumn'));
    assert.equal(existsSync('generated'), false);
  });

  it('defaults the output path when no file is given', async () => {
    const { adapter } = createContext();
    const result = await adapter.createSchema!({});
    assert.equal(result.path, 'auth-entities.ts');
  });
});
