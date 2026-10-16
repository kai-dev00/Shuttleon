import type { SQLiteBindValue, SQLiteDatabase } from "expo-sqlite";
import { SYNCED_TABLES } from "../database/migrations";
import { TABLE_SPECS } from "../sync/tables";

/** Bump when the snapshot layout changes in a way old app versions can't read. */
export const SNAPSHOT_VERSION = 1;

type Row = Record<string, SQLiteBindValue>;

export type Snapshot = {
  version: number;
  createdAt: string;
  tables: Record<string, Row[]>;
};

/** Every live (not deleted) row of every table, as plain JSON. */
export async function createSnapshot(db: SQLiteDatabase): Promise<Snapshot> {
  const tables: Snapshot["tables"] = {};

  for (const spec of TABLE_SPECS) {
    tables[spec.name] = await db.getAllAsync<Row>(
      `SELECT ${spec.columns.join(", ")} FROM ${spec.name} WHERE deleted_at IS NULL ORDER BY created_at, id;`,
    );
  }

  return { version: SNAPSHOT_VERSION, createdAt: new Date().toISOString(), tables };
}

/** Throws a readable error unless `value` looks like a snapshot this app version can restore. */
export function assertSnapshot(value: unknown): asserts value is Snapshot {
  const snapshot = value as Snapshot | null;

  if (!snapshot || typeof snapshot !== "object" || typeof snapshot.tables !== "object" || !snapshot.tables) {
    throw new Error("That backup is damaged.");
  }
  if (snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error("That backup was made by a different version of the app.");
  }

  for (const spec of TABLE_SPECS) {
    const rows = snapshot.tables[spec.name];
    if (!Array.isArray(rows)) throw new Error("That backup is damaged.");
    for (const row of rows) {
      if (!row || typeof row !== "object" || typeof row.id !== "string") {
        throw new Error("That backup is damaged.");
      }
    }
  }
}

/**
 * Replaces everything on this device with the snapshot, in one transaction: if any row is
 * rejected the whole restore is rolled back and the current data is untouched.
 * Restored rows are marked dirty so a later sign-in uploads them.
 */
export async function restoreSnapshot(db: SQLiteDatabase, snapshot: unknown) {
  assertSnapshot(snapshot);

  await db.withTransactionAsync(async () => {
    await db.execAsync("PRAGMA defer_foreign_keys = ON;");

    for (const table of [...SYNCED_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table};`);
    }
    await db.runAsync("DELETE FROM sync_meta;");

    for (const spec of TABLE_SPECS) {
      const columns = spec.columns.join(", ");
      const placeholders = spec.columns.map(() => "?").join(", ");

      for (const row of snapshot.tables[spec.name]) {
        await db.runAsync(
          `INSERT INTO ${spec.name} (${columns}, dirty) VALUES (${placeholders}, 1);`,
          spec.columns.map((column) => (row[column] ?? null) as SQLiteBindValue),
        );
      }
    }
  });
}

/** True if there's anything on the device that a backup taken at `backedUpAt` doesn't contain. */
export async function hasUnbackedData(db: SQLiteDatabase, backedUpAt: string | null) {
  for (const table of SYNCED_TABLES) {
    const row = backedUpAt
      ? await db.getFirstAsync<{ id: string }>(`SELECT id FROM ${table} WHERE updated_at > ? LIMIT 1;`, [backedUpAt])
      : await db.getFirstAsync<{ id: string }>(`SELECT id FROM ${table} WHERE deleted_at IS NULL LIMIT 1;`);
    if (row) return true;
  }
  return false;
}
