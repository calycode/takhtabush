/**
 * A tiny, state-free D1 double for service tests. Each handler matches a SQL
 * statement by regular expression and returns the row(s) the test wants. The
 * double records every statement and `batch()` call so tests can assert that a
 * path stays a fixed number of queries instead of looping per row.
 */
export type FakeResult = {
   first?: unknown;
   all?: unknown[];
   changes?: number;
};

export type FakeHandler = {
   match: RegExp;
   respond: (params: unknown[], fake: FakeD1) => FakeResult;
};

type Prepared = {
   bind: (...values: unknown[]) => Prepared;
   first: <T>() => Promise<T | null>;
   all: <T>() => Promise<{ results: T[] }>;
   run: () => Promise<{ meta: { changes: number } }>;
};

export class FakeD1 {
   readonly statements: Array<{ sql: string; params: unknown[] }> = [];
   batches = 0;

   constructor(private readonly handlers: FakeHandler[]) {}

   prepare(sql: string): Prepared {
      let params: unknown[] = [];

      const execute = (): FakeResult => {
         this.statements.push({ sql, params });
         const handler = this.handlers.find((candidate) => candidate.match.test(sql));
         if (!handler) throw new Error(`Unexpected SQL in test: ${sql}`);
         return handler.respond(params, this);
      };

      const prepared: Prepared = {
         bind: (...values: unknown[]) => {
            params = values;
            return prepared;
         },
         first: async <T>() => (execute().first as T | undefined) ?? null,
         all: async <T>() => ({ results: (execute().all ?? []) as T[] }),
         run: async () => ({ meta: { changes: execute().changes ?? 1 } }),
      };
      return prepared;
   }

   async batch(statements: Prepared[]): Promise<Array<{ meta: { changes: number } }>> {
      this.batches += 1;
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
   }

   count(sql: RegExp): number {
      return this.statements.filter((statement) => sql.test(statement.sql)).length;
   }

   has(sql: RegExp): boolean {
      return this.statements.some((statement) => sql.test(statement.sql));
   }
}

/** The subset of `AppEnv` the storage and domain services touch. */
export function fakeEnv(db: FakeD1): {
   DB: FakeD1;
   MEDIA: Record<string, never>;
   AI: undefined;
   ASSETS: Record<string, never>;
   APP_URL: string;
   SESSION_SECRET: string;
   EMAIL_FROM: string;
   ENVIRONMENT: string;
   AI_GATEWAY_URL: string;
   CLEF_MODEL: string;
} {
   return {
      DB: db,
      MEDIA: {},
      AI: undefined,
      ASSETS: {},
      APP_URL: 'http://localhost:8787',
      SESSION_SECRET: 'test-secret',
      EMAIL_FROM: 'no-reply@test.local',
      ENVIRONMENT: 'test',
      AI_GATEWAY_URL: '',
      CLEF_MODEL: 'none',
   };
}
