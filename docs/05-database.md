# 5. Local database

All app data is stored on the device in SQLite (`expo-sqlite`). The file is `cockers.db`. The name
comes from an earlier app name and is kept on purpose, because renaming it would make existing
installs start with an empty database.

Code: `src/database/`.

## Connection

- `app/_layout.tsx` opens it with `<SQLiteProvider databaseName="cockers.db" onInit={migrateDbIfNeeded}>`.
  Components get it through `useSQLiteContext()`.
- `src/database/database.ts` also exports a `database` opened with `openDatabaseSync` for code
  outside React.
- `PRAGMA foreign_keys = ON` is set on every open, because SQLite only applies it per connection.

## IDs and timestamps (`ids.ts`)

- `newId()`: a UUID v4 from `expo-crypto`. IDs are made on the device so rows created offline never
  clash across devices.
- `nowIso()`: the current time as an ISO-8601 UTC string. Every synced timestamp uses this format.

## Migrations (`migrations.ts`)

The schema version is stored in `PRAGMA user_version`.

| Version | Schema |
|---|---|
| 0 / 1 | Original local-only schema (integer IDs, hard deletes). Never stamped |
| 2 | Sync-ready: text UUID keys, ISO timestamps, `deleted_at` tombstones, a `dirty` flag, `sync_meta` |

When the stored version is below `SCHEMA_VERSION` (2), every table is dropped and the v2 schema is
created. That was fine because there was no real data on v1.

> **Before shipping a schema change**, add a real step-by-step migration here instead of dropping
> tables. Otherwise users lose their data. Also update the Supabase migration and `src/sync/tables.ts`.

## Sync columns

Every synced table has these columns:

| Column | Purpose |
|---|---|
| `created_at` | ISO timestamp, set on insert |
| `updated_at` | ISO timestamp, set on every change. The server overwrites it with its own clock |
| `deleted_at` | Tombstone. Set instead of deleting the row so the delete can sync |
| `dirty` | `1` = changed locally and not uploaded yet. Local only, never sent to the server |

## Tables

### Quick matches

**`quick_matches`**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `match_type` | TEXT | `singles` / `doubles` |
| `best_of` | INTEGER | First to N sets (default 1) |
| `scoring` | INTEGER | Points per set (default 11) |
| `rematch_number` | INTEGER | 0 for the original, then 1, 2, ... |
| `team_a_sets`, `team_b_sets` | INTEGER | Sets won |
| `team_a_name`, `team_b_name` | TEXT | Default `Team 1` / `Team 2` |
| `status` | TEXT | `upcoming` / `ongoing` / `concluded` |
| `ended_at` | TEXT | Set when the match is concluded |

**`quick_match_players`**: `quick_match_id`, `team` (`A`/`B`), `player_order` (1, 2), `name`.

**`quick_match_sets`**: `quick_match_id`, `set_number`, `team_a_score`, `team_b_score`.
Unique on `(quick_match_id, set_number)`.

### Tournaments

**`tournaments`**: `name`, `match_type`, `format` (`round_robin` / `single_elim` / `swiss` /
`other`), `best_of`, `scoring`, `status` (`draft` / `upcoming` / `ongoing` / `concluded`).

**`tournament_players`**: `tournament_id`, `name`, `seed` (position in the entry list).

**`tournament_teams`**: `tournament_id`, `name`.

**`tournament_team_players`**: `tournament_team_id`, `tournament_player_id`. Unique on the pair.

**`tournament_matches`**: `tournament_id`, `round`, `match_order`, `side_a_team_id`,
`side_b_team_id`, `team_a_sets`, `team_b_sets`, `status`, `winner_team_id`, `next_match_id`.

**`tournament_match_sets`**: `tournament_match_id`, `set_number`, `team_a_score`, `team_b_score`.
Unique on `(tournament_match_id, set_number)`.

### Sync state

**`sync_meta`** (key/value, not synced):

| Key | Value |
|---|---|
| `last_user_id` | The account this device's data belongs to |
| `last_synced_at` | Time of the last successful sync |
| `cursor:<table>` | JSON `{ updatedAt, id }`: how far each table has been pulled |

### Indexes

One index per foreign key used for lookups: players and sets by match, players, teams and matches by
tournament, and sets by tournament match.

## Table order

`SYNCED_TABLES` lists the tables parents first. Sync uploads in this order, deletes run in reverse,
and `src/sync/tables.ts` throws at startup if its list doesn't match.

## Repositories

Screens never write SQL. They go through feature hooks, which call these classes (each made with
`useMemo` in `src/database/hooks`).

### `QuickMatchRepository`

| Method | What it does |
|---|---|
| `getAll()` / `getById(id)` | Matches that aren't deleted, newest first, with players and sets |
| `create(data)` | Inserts the match and its players in one transaction |
| `createRematch(id)` | Copies a match into a new one with `rematch_number + 1` |
| `update(id, data)` | Updates settings and syncs players |
| `updateStatus(id, status)` | Sets the status. `concluded` also sets `ended_at` |
| `updateSetScore(id, a, b)` | Sets won per side |
| `recordSetScore(id, set, a, b)` | Upserts one set's score |
| `delete(id)` | Soft-deletes the match, players and sets |

### `TournamentRepository`

| Method | What it does |
|---|---|
| `getAll()` / `getById(id)` | Tournaments with their players (by seed) |
| `create(data)` / `update(id, data)` | Saves the tournament and syncs players |
| `delete(id)` | Soft-deletes the tournament and everything under it |
| `generateBracket(id)` | Builds teams and the round-robin schedule |
| `getBracket(id)` | Matches grouped by round, with team names |
| `getMatchById(id)` | One match with tournament settings, sides and sets |
| `completeSet(data)` | Saves a set and updates match and tournament status |
| `getStandings(id)` | W/L/T and points per team |
| `updateTournamentStatus(id, status)` | Sets the tournament status |

### Updating child rows

`syncPlayers()` in both repositories keeps existing player rows (and their IDs) by position, inserts
new ones and tombstones removed ones. Keeping IDs stable avoids pointless sync traffic and keeps
tournament team links valid.

## Soft deletes

Nothing is deleted with `DELETE` during normal use. A delete sets `deleted_at`, `updated_at` and
`dirty = 1` on the row and its children. Every read filters on `deleted_at IS NULL`. That way a
delete on one device reaches the server and the other devices.

`DELETE` is only used to wipe the device (sign out, leave guest mode, signing in as another
account) and when restoring a backup.
