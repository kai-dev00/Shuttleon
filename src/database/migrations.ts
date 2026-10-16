import { SQLiteDatabase } from "expo-sqlite";

/**
 * Schema versions (tracked with `PRAGMA user_version`):
 *  1 — original local-only schema (INTEGER ids, hard deletes). Never stamped (user_version 0).
 *  2 — sync-ready: TEXT uuid primary keys, ISO timestamps, `deleted_at` tombstones and a
 *      `dirty` flag on every table, plus `sync_meta`.
 *
 * There is no production data to carry over, so anything found at version 0 is dropped and the
 * v2 schema is created fresh. Future schema changes should add real incremental steps here.
 */
const SCHEMA_VERSION = 2;

const SYNC_COLUMNS = `
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  dirty INTEGER NOT NULL DEFAULT 1
`;

const V2_SCHEMA = `
  CREATE TABLE IF NOT EXISTS quick_matches (
    id TEXT PRIMARY KEY NOT NULL,
    match_type TEXT NOT NULL,
    best_of INTEGER NOT NULL DEFAULT 1,
    scoring INTEGER NOT NULL DEFAULT 11,
    rematch_number INTEGER NOT NULL DEFAULT 0,
    team_a_sets INTEGER NOT NULL DEFAULT 0,
    team_b_sets INTEGER NOT NULL DEFAULT 0,
    team_a_name TEXT NOT NULL DEFAULT 'Team 1',
    team_b_name TEXT NOT NULL DEFAULT 'Team 2',
    status TEXT NOT NULL DEFAULT 'upcoming',
    ended_at TEXT,
    ${SYNC_COLUMNS}
  );

  CREATE TABLE IF NOT EXISTS quick_match_players (
    id TEXT PRIMARY KEY NOT NULL,
    quick_match_id TEXT NOT NULL,
    team TEXT NOT NULL,
    player_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    ${SYNC_COLUMNS},
    FOREIGN KEY (quick_match_id) REFERENCES quick_matches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quick_match_sets (
    id TEXT PRIMARY KEY NOT NULL,
    quick_match_id TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    team_a_score INTEGER NOT NULL,
    team_b_score INTEGER NOT NULL,
    ${SYNC_COLUMNS},
    FOREIGN KEY (quick_match_id) REFERENCES quick_matches(id) ON DELETE CASCADE,
    UNIQUE (quick_match_id, set_number)
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    match_type TEXT NOT NULL,
    format TEXT NOT NULL,
    best_of INTEGER NOT NULL DEFAULT 1,
    scoring INTEGER NOT NULL DEFAULT 11,
    status TEXT NOT NULL DEFAULT 'draft',
    ${SYNC_COLUMNS}
  );

  CREATE TABLE IF NOT EXISTS tournament_players (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_id TEXT NOT NULL,
    name TEXT NOT NULL,
    seed INTEGER,
    ${SYNC_COLUMNS},
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tournament_teams (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_id TEXT NOT NULL,
    name TEXT,
    ${SYNC_COLUMNS},
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tournament_team_players (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_team_id TEXT NOT NULL,
    tournament_player_id TEXT NOT NULL,
    ${SYNC_COLUMNS},
    FOREIGN KEY (tournament_team_id) REFERENCES tournament_teams(id) ON DELETE CASCADE,
    FOREIGN KEY (tournament_player_id) REFERENCES tournament_players(id) ON DELETE CASCADE,
    UNIQUE (tournament_team_id, tournament_player_id)
  );

  CREATE TABLE IF NOT EXISTS tournament_matches (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    match_order INTEGER NOT NULL,
    side_a_team_id TEXT,
    side_b_team_id TEXT,
    team_a_sets INTEGER NOT NULL DEFAULT 0,
    team_b_sets INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'upcoming',
    winner_team_id TEXT,
    next_match_id TEXT,
    ${SYNC_COLUMNS},
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (side_a_team_id) REFERENCES tournament_teams(id),
    FOREIGN KEY (side_b_team_id) REFERENCES tournament_teams(id),
    FOREIGN KEY (winner_team_id) REFERENCES tournament_teams(id),
    FOREIGN KEY (next_match_id) REFERENCES tournament_matches(id)
  );

  CREATE TABLE IF NOT EXISTS tournament_match_sets (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_match_id TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    team_a_score INTEGER NOT NULL,
    team_b_score INTEGER NOT NULL,
    ${SYNC_COLUMNS},
    FOREIGN KEY (tournament_match_id) REFERENCES tournament_matches(id) ON DELETE CASCADE,
    UNIQUE (tournament_match_id, set_number)
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_quick_match_players_match ON quick_match_players(quick_match_id);
  CREATE INDEX IF NOT EXISTS idx_quick_match_sets_match ON quick_match_sets(quick_match_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament ON tournament_teams(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_match_sets_match ON tournament_match_sets(tournament_match_id);
`;

/** Tables in dependency order (parents first). Also the order a sync push must follow. */
export const SYNCED_TABLES = [
  "quick_matches",
  "quick_match_players",
  "quick_match_sets",
  "tournaments",
  "tournament_players",
  "tournament_teams",
  "tournament_team_players",
  "tournament_matches",
  "tournament_match_sets",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const version = row?.user_version ?? 0;

  if (version < SCHEMA_VERSION) {
    // Foreign keys must be off while dropping/recreating tables (cannot change inside a transaction).
    await db.execAsync("PRAGMA foreign_keys = OFF;");
    await db.withTransactionAsync(async () => {
      for (const table of [...SYNCED_TABLES].reverse()) {
        await db.execAsync(`DROP TABLE IF EXISTS ${table};`);
      }
      await db.execAsync("DROP TABLE IF EXISTS sync_meta;");
      await db.execAsync(V2_SCHEMA);
    });
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  // Per-connection setting, so it must be applied on every open.
  await db.execAsync("PRAGMA foreign_keys = ON;");
}
