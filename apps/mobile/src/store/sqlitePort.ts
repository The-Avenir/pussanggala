/** Local SQLite only. Compatible with Expo SQLiteDatabase/Transaction. */
export type SqlValue = string | number | null;

export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}

export interface UserDatabase extends SqlExecutor {
  /** Callback queries MUST use the supplied transaction connection. */
  withExclusiveTransactionAsync(task: (tx: SqlExecutor) => Promise<void>): Promise<void>;
}

// Serialize access per connection, including multiple store instances. A failed
// operation must not poison the queue or permit reads of uncommitted state.
const queues = new WeakMap<UserDatabase, Promise<unknown>>();
export function serialize<T>(db: UserDatabase, task: () => Promise<T>): Promise<T> {
  const result = (queues.get(db) ?? Promise.resolve()).then(task, task);
  queues.set(db, result.then(() => undefined, () => undefined));
  return result;
}

export async function transaction<T>(db: UserDatabase, task: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  let value: T;
  await db.withExclusiveTransactionAsync(async (tx) => { value = await task(tx); });
  return value!;
}
