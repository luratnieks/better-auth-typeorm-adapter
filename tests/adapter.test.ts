/**
 * Official Better Auth adapter test suites.
 *
 * Runs the shared `@better-auth/test-utils` suites (CRUD semantics, auth
 * flows, transactions, UUID ids and case-insensitive matching) against the
 * TypeORM adapter backed by an in-memory SQLite database. Entities are
 * generated per suite from the Better Auth options via
 * `generateEntitySchemas`, so schema-altering suites work out of the box.
 */
import {
  authFlowTestSuite,
  caseInsensitiveTestSuite,
  normalTestSuite,
  testAdapter,
  transactionsTestSuite,
  uuidTestSuite,
} from '@better-auth/test-utils/adapter';
import type { BetterAuthOptions } from 'better-auth/types';
import { DataSource } from 'typeorm';
import { generateEntitySchemas, typeormAdapter } from '../src/index';

let dataSource: DataSource | undefined;

/**
 * Stable facade that always delegates to the current DataSource, so the
 * adapter keeps working when `runMigrations` swaps the underlying instance
 * between suites.
 */
const dataSourceProxy = new Proxy({} as DataSource, {
  get(_, property) {
    if (!dataSource) {
      throw new Error('DataSource has not been created yet (runMigrations not called)');
    }
    const value = (dataSource as unknown as Record<PropertyKey, unknown>)[property];
    return typeof value === 'function' ? (value as CallableFunction).bind(dataSource) : value;
  },
});

const { execute } = await testAdapter({
  adapter: () => (options: BetterAuthOptions) =>
    typeormAdapter({ dataSource: dataSourceProxy })(options),
  runMigrations: async (options) => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: generateEntitySchemas(options),
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
  },
  onFinish: async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  },
  tests: [
    normalTestSuite(),
    authFlowTestSuite(),
    transactionsTestSuite(),
    uuidTestSuite(),
    caseInsensitiveTestSuite(),
  ],
});

execute();
