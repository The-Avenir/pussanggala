import { serialize, transaction, type UserDatabase } from './sqlitePort';

export const USER_SCHEMA_VERSION = 1;

export class UserSchemaError extends Error {
  constructor() { super('User database schema is incompatible; preserve the file for recovery.'); }
}

// PRAGMA user_version is separate from the installed pack's schema_version.
// Numbered migrations only move forward, in the same transaction as the DDL.
const MIGRATIONS = [
  `CREATE TABLE USER_SETTING (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
   CREATE TABLE ACTIVE_TRIP (
     trip_id INTEGER PRIMARY KEY CHECK (trip_id = 1),
     pack_id TEXT NOT NULL, schema_version INTEGER NOT NULL,
     origin_place_id TEXT NOT NULL, destination_place_id TEXT NOT NULL,
     preference TEXT NOT NULL, route_json TEXT NOT NULL,
     current_step INTEGER NOT NULL CHECK (current_step >= 0), started_at TEXT NOT NULL
   );
   CREATE TABLE SAVED_ROUTE (
     saved_id TEXT PRIMARY KEY NOT NULL, pack_id TEXT NOT NULL,
     origin_place_id TEXT NOT NULL, destination_place_id TEXT NOT NULL,
     preference TEXT NOT NULL, route_json TEXT NOT NULL, label TEXT, created_at TEXT NOT NULL
   );
   CREATE TABLE TRIP_HISTORY (
     history_id TEXT PRIMARY KEY NOT NULL, pack_id TEXT NOT NULL,
     origin_place_id TEXT NOT NULL, destination_place_id TEXT NOT NULL,
     preference TEXT NOT NULL, route_json TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('looked_up', 'taken')), at TEXT NOT NULL
   );
   CREATE TABLE INSTALLED_ASSET (
     asset_id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('model', 'pack', 'map')),
     file_path TEXT NOT NULL, version TEXT NOT NULL, sha256 TEXT NOT NULL,
     bytes INTEGER NOT NULL CHECK (bytes >= 0),
     state TEXT NOT NULL CHECK (state IN ('missing', 'verifying', 'ready', 'failed')),
     license TEXT NOT NULL
   );
   CREATE INDEX saved_route_created ON SAVED_ROUTE (created_at, saved_id);
   CREATE INDEX trip_history_at ON TRIP_HISTORY (at, history_id);`,
] as const;

export function migrateUserDatabase(db: UserDatabase): Promise<void> {
  return serialize(db, () => transaction(db, async (tx) => {
    const row = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version;
    if (version === undefined || !Number.isInteger(version) || version < 0 || version > USER_SCHEMA_VERSION) {
      throw new UserSchemaError();
    }
    for (let next = version + 1; next <= USER_SCHEMA_VERSION; next++) {
      await tx.execAsync(MIGRATIONS[next - 1]!);
      // next is an internal integer, never user input.
      await tx.execAsync(`PRAGMA user_version = ${next}`);
    }
  }));
}
