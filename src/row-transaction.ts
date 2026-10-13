import { DataSource, type EntityManager, type QueryRunner } from 'typeorm';

export interface RowTransaction {
  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;
  lock: { mode: 'pessimistic_write' } | undefined;
}

const PESSIMISTIC_LOCK_DRIVERS: ReadonlySet<string> = new Set([
  'aurora-mysql',
  'aurora-postgres',
  'cockroachdb',
  'mariadb',
  'mssql',
  'mysql',
  'oracle',
  'postgres',
]);

const SQLITE_IMMEDIATE_DRIVERS: ReadonlySet<string> = new Set(['better-sqlite3', 'sqlite']);

type TransactionState = { isTransactionActive: boolean; transactionDepth: number };

async function immediateTransaction<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const queryRunner: QueryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.query('BEGIN IMMEDIATE');
    const state = queryRunner as unknown as TransactionState;
    state.isTransactionActive = true;
    state.transactionDepth = 1;
    try {
      const result = await work(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {}
      throw error;
    }
  } finally {
    await queryRunner.release();
  }
}

export function createRowTransaction(dataSource: DataSource): RowTransaction {
  let pending: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(start: () => Promise<T>): Promise<T> => {
    const current = pending.then(start);
    pending = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  };

  return {
    get lock() {
      if (!PESSIMISTIC_LOCK_DRIVERS.has(dataSource.options.type)) return undefined;
      return { mode: 'pessimistic_write' as const };
    },
    run: <T>(work: (manager: EntityManager) => Promise<T>): Promise<T> => {
      if (SQLITE_IMMEDIATE_DRIVERS.has(dataSource.options.type)) {
        return enqueue(() => immediateTransaction(dataSource, work));
      }
      return dataSource.transaction(work);
    },
  };
}
