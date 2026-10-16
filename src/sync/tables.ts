import { SYNCED_TABLES, type SyncedTable } from "../database/migrations";

export type TableSpec = {
  name: SyncedTable;
  /** Every synced column (same name locally and remotely). Excludes `user_id` (server-set) and `dirty` (local-only). */
  columns: string[];
  /**
   * Natural key besides `id` (e.g. one score row per set number). Two devices can create the same
   * natural key with different ids, so the engine re-keys instead of failing on the unique constraint.
   */
  naturalKey?: string[];
};

const TIMESTAMPS = ["created_at", "updated_at", "deleted_at"];

const spec = (name: SyncedTable, columns: string[], naturalKey?: string[]): TableSpec => ({
  name,
  columns: ["id", ...columns, ...TIMESTAMPS],
  naturalKey,
});

/** Parent tables first — the order a push and a pull must follow. */
export const TABLE_SPECS: TableSpec[] = [
  spec("quick_matches", [
    "match_type",
    "best_of",
    "scoring",
    "rematch_number",
    "team_a_sets",
    "team_b_sets",
    "team_a_name",
    "team_b_name",
    "status",
    "ended_at",
  ]),
  spec("quick_match_players", ["quick_match_id", "team", "player_order", "name"]),
  spec(
    "quick_match_sets",
    ["quick_match_id", "set_number", "team_a_score", "team_b_score"],
    ["quick_match_id", "set_number"],
  ),
  spec("tournaments", ["name", "match_type", "format", "best_of", "scoring", "status"]),
  spec("tournament_players", ["tournament_id", "name", "seed"]),
  spec("tournament_teams", ["tournament_id", "name"]),
  spec(
    "tournament_team_players",
    ["tournament_team_id", "tournament_player_id"],
    ["tournament_team_id", "tournament_player_id"],
  ),
  spec("tournament_matches", [
    "tournament_id",
    "round",
    "match_order",
    "side_a_team_id",
    "side_b_team_id",
    "team_a_sets",
    "team_b_sets",
    "status",
    "winner_team_id",
    "next_match_id",
  ]),
  spec(
    "tournament_match_sets",
    ["tournament_match_id", "set_number", "team_a_score", "team_b_score"],
    ["tournament_match_id", "set_number"],
  ),
];

// Keep the spec list and the migration's table list in lockstep.
if (TABLE_SPECS.map((t) => t.name).join() !== SYNCED_TABLES.join()) {
  throw new Error("TABLE_SPECS is out of sync with SYNCED_TABLES");
}

export const TIMESTAMP_COLUMNS = new Set(["created_at", "updated_at", "deleted_at", "ended_at"]);
