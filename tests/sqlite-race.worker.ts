import { parentPort, workerData } from 'node:worker_threads';
import type { BetterAuthOptions } from 'better-auth/types';
import { DataSource } from 'typeorm';
import { generateEntitySchemas, typeormAdapter } from '../src/index.ts';

type RaceTask = {
  databasePath: string;
  task: 'consume' | 'guard' | 'increment';
  rowId: string;
  repetitions: number;
};

const { databasePath, task, rowId, repetitions } = workerData as RaceTask;

const raceOptions = {
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

const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: databasePath,
  entities: generateEntitySchemas(raceOptions),
  synchronize: false,
  logging: false,
});

const adapter = typeormAdapter({ dataSource })(raceOptions);

const tasks = {
  consume: () =>
    adapter.consumeOne<Record<string, any>>({
      model: 'apikey',
      where: [{ field: 'id', value: rowId }],
    }),
  guard: () =>
    adapter.incrementOne<Record<string, any>>({
      model: 'apikey',
      where: [
        { field: 'id', value: rowId },
        { field: 'lastRequest', value: null },
      ],
      increment: {},
      set: { requestCount: 1, lastRequest: new Date() },
    }),
  increment: () =>
    adapter.incrementOne<Record<string, any>>({
      model: 'apikey',
      where: [{ field: 'id', value: rowId }],
      increment: { requestCount: 1 },
    }),
};

parentPort!.once('message', async () => {
  const results: unknown[] = [];
  for (let index = 0; index < repetitions; index++) {
    results.push(await tasks[task]());
  }
  await dataSource.destroy();
  parentPort!.postMessage(results);
});

await dataSource.initialize();
parentPort!.postMessage('ready');
