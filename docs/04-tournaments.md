# 4. Tournaments

Code: `src/features/tournament` (screens, form, hooks) and
`src/database/repositories/TournamentRepository.ts` (data and scheduling).

## Lifecycle

```
create() ──► upcoming ──(first set scored)──► ongoing ──(last match concluded)──► concluded
```

`draft` exists in the type and as the database default, but `create()` saves new tournaments as
`upcoming`. The tournament can be edited while it's `draft` or `upcoming`.

Each tournament match has its own status: `upcoming` → `ongoing` (after its first set) →
`concluded` (when a side reaches `bestOf` sets).

## Creation wizard (`TournamentForm`)

| Step | Fields | Validation (`tournamentSchema.ts`) |
|---|---|---|
| 1. Details | Name, match type, best of (1–5), scoring (8/11/21) | Name required |
| 2. Format | Round Robin, Swiss, Single Elim, Other | Only **Round Robin** is enabled. The others show but can't be picked |
| 3. Players | Add names one by one | At least 2 players |
| 4. Review | Summary of everything | Confirm submits |

Each step is checked with `trigger()` before moving on. The same form is used for editing, with
`defaultValues` filled in.

After **Confirm**, `AddTournamentScreen` calls `create()`, then `generateBracket()`, then opens the
detail screen. If bracket generation fails (for example doubles with an odd player count), the
error is logged and the tournament opens with "No bracket yet".

## Teams

`createTeamsFromPlayers()` turns players into teams:

- **Singles:** one team per player.
- **Doubles:** players are paired in the order they were entered (1+2, 3+4, ...). An odd number of
  players throws "Doubles requires an even number of players".

The team name is the player names joined with " / ". Each link is a row in `tournament_team_players`.

## Round-robin scheduling

`buildRoundRobinRounds()` uses the **circle method**:

1. If the team count is odd, add an empty slot (a bye).
2. Keep the first team fixed and rotate the rest one place each round.
3. Each round pairs position `i` with position `n - 1 - i`. A pairing with the empty slot is skipped,
   so that team sits out the round.

With `n` teams (rounded up to even) there are `n - 1` rounds and every team plays every other team
once. Each match is saved with its `round` and `match_order`.

| Teams | Rounds | Matches |
|---|---|---|
| 4 | 3 | 6 |
| 5 | 5 | 10 (one bye per round) |
| 6 | 5 | 15 |
| 8 | 7 | 28 |

## Detail screen (`TournamentDetailScreen`)

- **Header:** name, format, player count, and an edit pencil while editable.
- **Summary card:** type · BO · points, status badge, date, and a progress bar
  ("N of M matches played"). When concluded it shows "Tournament complete — X wins".
- **Bracket tab:** matches grouped by round with "done/total". Each card shows both sides, sets won
  and a badge: **Live**, **Done**, **Ready** (tap to score) or **TBD** (sides not set yet, can't be
  opened).
- **Standings tab:** the standings table.

## Standings (`getStandings`)

For each team:

| Column | How it's worked out |
|---|---|
| W / L / T | From concluded matches. A concluded match with no winner counts as a tie |
| Points for / against | Sum of rally points over every saved set, from that team's side |
| Diff | Points for − points against |

Teams are sorted by **wins**, then **point difference**. The champion is the top row once the
tournament is concluded.

## Data model

```
tournaments
 ├─ tournament_players          (name, seed = entry order)
 ├─ tournament_teams            (name)
 │   └─ tournament_team_players (team ↔ player link)
 └─ tournament_matches          (round, match_order, side_a/side_b team, sets, status, winner)
     └─ tournament_match_sets   (one row per set number)
```

`next_match_id` is in the schema for knockout brackets but isn't used yet.

Deleting a tournament tombstones every row under it (see [Local database](05-database.md#soft-deletes)).
