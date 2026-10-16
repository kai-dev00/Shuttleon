# 3. Scoring

Quick matches and tournament matches use the same scoring screen
(`src/features/common/scoring/ScoringPlayScreen.tsx`). The rules live in one file,
`scoringRules.ts`, so the screen and the session hook always agree.

## Match settings

| Setting | Values | Meaning |
|---|---|---|
| Match type | `singles`, `doubles` | Doubles shows the team name with both player names under it |
| Best of | 1–5 | **First to this many sets.** `bestOf: 3` means a side must win 3 sets, not 2 of 3 |
| Scoring | 8, 11, 21 | Points needed to win a set |

> `bestOf` really means "first to N sets". `setsToWin(bestOf)` returns `bestOf` unchanged. Keep
> this in mind before changing the label or the rule.

## Rules (`scoringRules.ts`)

All rules use rally-point scoring: every rally wins a point.

| Function | Rule |
|---|---|
| `getSetWinner(score, scoring)` | A side wins the set at `scoring` points or more **and** a lead of at least 2 |
| `isDeuce(score, scoring)` | Both sides have at least `scoring - 1` |
| `isDeuceTight(score, scoring)` | Deuce and the lead is under 2, so the set can't end yet |
| `canAddPoint(score, scoring, side)` | No point after the set is won. Outside deuce a side can't go past `scoring` |
| `isSetPoint(score, scoring, side)` | One more point would win the set for `side` |
| `isMatchPoint(...)` | Set point, and winning that set would win the match |

Example at 21 points: 21–19 wins. At 20–20 it's deuce, and play continues until someone leads by
2 (22–20, 25–23, ...). There is currently no 30-point cap (see
[Known limitations](09-known-limitations.md)).

## Live session (`useScoringSession`)

The hook holds the state for the set being played. Nothing is saved until a set ends.

- `score`: points in the current set, `{ A, B }`
- `setsWon`: sets won so far, worked out from the saved sets when the screen opens
- `setNumber`: the current set (saved sets + 1)
- `setHistory`: completed sets, shown in the strip above the panels
- `server`: who serves. Rally-point: the side that wins a rally serves next. The set winner serves
  first in the next set. Tap the shuttle icon on a panel to set it by hand. This is display only and
  isn't saved.
- An **undo stack** of `{ score, server }` snapshots. It's cleared when a set is reset or committed.

When `matchKey` changes (a different match, or a rematch), the state resets from the new match's
saved sets.

## The screen

| Control | What it does |
|---|---|
| Tap a side panel | Add a point (haptic tick, or a success buzz when that point wins the set) |
| Minus on a panel | Remove a point from that side |
| Undo | Go back one step |
| Reset | Clear the current set's score (asks first) |
| **End set N** | Enabled only when a side has won the set. Saves it and starts the next one |
| Swap (⇄) | Swap the panels left and right. Display only |
| Maximise | Landscape scoreboard with the tab bar and status bar hidden |
| Pencil | Edit the match. Only shown for quick matches that are still `upcoming` |

The status banner shows, in priority order: set won, match point, set point, deuce.

The screen stays awake while a match is live (`expo-keep-awake`). It's locked to portrait unless
you switch to landscape, and it goes back to portrait when the match ends.

When the match is concluded, the screen shows `ConcludedSummary`: final sets, each set's score, the
date and, for quick matches, **Rematch**.

## How a finished set is saved

`endSet()` builds a `CompleteSetPayload`:

```ts
{ setNumber, teamAScore, teamBScore, teamASets, teamBSets, winner, matchComplete }
```

`matchComplete` is true when the winner's sets reach `bestOf`. The feature then saves it.

**Quick match** (`QuickMatchPlayScreen`), in three steps:
1. `recordSetScore`: upserts the row in `quick_match_sets` for that set number
2. `updateSetScore`: updates `team_a_sets` / `team_b_sets` on the match
3. `updateStatus`: `ongoing`, or `concluded` (which also sets `ended_at`)

**Tournament match** (`TournamentMatchPlayScreen`): one `completeSet` call in one transaction. It
upserts the set, updates the match's sets, status and winner, moves the tournament to `ongoing`, and
marks the tournament `concluded` once no unfinished matches are left.

## Rematches

`QuickMatchRepository.createRematch(id)` copies the match settings and players into a new match with
`rematch_number + 1`. The screen then replaces itself with the new match. The Quick list can filter
to rematches only, and search understands "rematch 2".
