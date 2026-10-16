import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import { SYNCED_TABLES } from "../database/migrations";
import { TABLE_SPECS, TIMESTAMP_COLUMNS, type TableSpec } from "./tables";

export type RemoteRow = Record<string, unknown>;

export type Cursor = { updatedAt: string; id: string };

/** Everything the engine needs from the server, so it can be tested without Supabase. */
export interface Remote {
  /** Insert-or-update rows by id. */
  upsert(table: string, rows: RemoteRow[]): Promise<void>;
  /** Rows changed after `after` (ordered by updated_at, id), at most `limit`. */
  fetchChanged(table: string, after: Cursor | null, limit: number): Promise<RemoteRow[]>;
}

export type SyncResult = { pushed: number; pulled: number };

const PUSH_BATCH = 200;
const PULL_PAGE = 500;

/* ------------------------------------------------------------------ meta */

async function getMeta(db: SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM sync_meta WHERE key = ?;",
    [key],
  );
  return row?.value ?? null;
}

async function setMeta(db: SQLiteDatabase, key: string, value: string | null) {
  await db.runAsync(
    "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value;",
    [key, value],
  );
}

export const getLastUserId = (db: SQLiteDatabase) => getMeta(db, "last_user_id");
export const setLastUserId = (db: SQLiteDatabase, userId: string) => setMeta(db, "last_user_id", userId);
export const getLastSyncedAt = (db: SQLiteDatabase) => getMeta(db, "last_synced_at");

/** Rows changed locally that haven't been uploaded yet. */
export async function countPending(db: SQLiteDatabase) {
  let total = 0;
  for (const table of SYNCED_TABLES) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE dirty = 1;`,
    );
    total += row?.count ?? 0;
  }
  return total;
}

/** True when any synced table has a live (non-deleted) row. */
export async function hasLocalData(db: SQLiteDatabase) {
  for (const table of SYNCED_TABLES) {
    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM ${table} WHERE deleted_at IS NULL LIMIT 1;`,
    );
    if (row) return true;
  }
  return false;
}

/** Wipes all synced data and sync state (used when a different account signs in on this device). */
export async function resetLocalData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const table of [...SYNCED_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table};`);
    }
    await db.runAsync("DELETE FROM sync_meta;");
  });
}

/* ------------------------------------------------------------------ pull */

const toLocalTimestamp = (value: unknown) =>
  value === null || value === undefined ? null : new Date(value as string).toISOString();

function toLocalValues(spec: TableSpec, row: RemoteRow): SQLiteBindValue[] {
  return spec.columns.map((column) => {
    const value = row[column];
    if (value === undefined) return null;
    return (TIMESTAMP_COLUMNS.has(column) ? toLocalTimestamp(value) : value) as SQLiteBindValue;
  });
}

async function applyRemoteRow(db: SQLiteDatabase, spec: TableSpec, row: RemoteRow) {
  const id = row.id as string;

  // Two devices can create the same natural key (e.g. set 1 of a match) under different ids.
  if (spec.naturalKey) {
    const where = spec.naturalKey.map((column) => `${column} = ?`).join(" AND ");
    const keyValues = spec.naturalKey.map((column) => row[column] as SQLiteBindValue);
    const clash = await db.getFirstAsync<{ id: string; dirty: number }>(
      `SELECT id, dirty FROM ${spec.name} WHERE ${where} AND id != ?;`,
      [...keyValues, id],
    );

    if (clash) {
      if (clash.dirty) {
        // Local edit wins: adopt the server's id so the next push updates that row.
        await db.runAsync(`DELETE FROM ${spec.name} WHERE id = ?;`, [id]);
        await db.runAsync(`UPDATE ${spec.name} SET id = ? WHERE id = ?;`, [id, clash.id]);
        return;
      }
      await db.runAsync(`DELETE FROM ${spec.name} WHERE id = ?;`, [clash.id]);
    }
  }

  const columns = spec.columns.join(", ");
  const placeholders = spec.columns.map(() => "?").join(", ");
  const assignments = spec.columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");

  // `WHERE dirty = 0`: never overwrite a row with unsynced local changes.
  await db.runAsync(
    `INSERT INTO ${spec.name} (${columns}, dirty) VALUES (${placeholders}, 0)
     ON CONFLICT (id) DO UPDATE SET ${assignments}, dirty = 0 WHERE ${spec.name}.dirty = 0;`,
    toLocalValues(spec, row),
  );
}

async function pullTable(db: SQLiteDatabase, remote: Remote, spec: TableSpec) {
  const metaKey = `cursor:${spec.name}`;
  const stored = await getMeta(db, metaKey);
  let cursor: Cursor | null = stored ? (JSON.parse(stored) as Cursor) : null;
  let pulled = 0;

  for (;;) {
    const rows = await remote.fetchChanged(spec.name, cursor, PULL_PAGE);
    if (rows.length === 0) break;

    // Parent rows can arrive after children within a page; check FKs at commit instead.
    await db.withTransactionAsync(async () => {
      await db.execAsync("PRAGMA defer_foreign_keys = ON;");
      for (const row of rows) await applyRemoteRow(db, spec, row);

      const last = rows[rows.length - 1];
      cursor = { updatedAt: last.updated_at as string, id: last.id as string };
      await setMeta(db, metaKey, JSON.stringify(cursor));
    });

    pulled += rows.length;
    if (rows.length < PULL_PAGE) break;
  }

  return pulled;
}

export async function pullChanges(db: SQLiteDatabase, remote: Remote) {
  let pulled = 0;
  for (const spec of TABLE_SPECS) pulled += await pullTable(db, remote, spec);
  return pulled;
}

/* ------------------------------------------------------------------ push */

async function pushTable(db: SQLiteDatabase, remote: Remote, spec: TableSpec) {
  const columns = spec.columns.join(", ");
  let pushed = 0;

  for (;;) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT ${columns} FROM ${spec.name} WHERE dirty = 1 ORDER BY updated_at LIMIT ?;`,
      [PUSH_BATCH],
    );
    if (rows.length === 0) break;

    await remote.upsert(spec.name, rows);

    // Only clear the flag if the row wasn't edited again while the request was in flight.
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        await db.runAsync(`UPDATE ${spec.name} SET dirty = 0 WHERE id = ? AND updated_at = ?;`, [
          row.id as string,
          row.updated_at as string,
        ]);
      }
    });

    pushed += rows.length;
    if (rows.length < PUSH_BATCH) break;
  }

  return pushed;
}

export async function pushChanges(db: SQLiteDatabase, remote: Remote) {
  let pushed = 0;
  for (const spec of TABLE_SPECS) pushed += await pushTable(db, remote, spec);
  return pushed;
}

/* ------------------------------------------------------------------ sync */

/**
 * One full sync: pull first (so natural-key clashes are resolved before uploading), then push
 * everything that changed locally.
 */
export async function syncOnce(db: SQLiteDatabase, remote: Remote): Promise<SyncResult> {
  const pulled = await pullChanges(db, remote);
  const pushed = await pushChanges(db, remote);
  await setMeta(db, "last_synced_at", new Date().toISOString());
  return { pushed, pulled };
}
