# 9. Known limitations

Things that work differently from what you might expect, found while writing these docs. Each one
names the code involved so it's easy to pick up.

## Scoring

- **No 30-point cap.** Standard badminton ends a 21-point set at 30 (29–29, next point wins).
  `getSetWinner` and `canAddPoint` in `scoringRules.ts` only check "win by 2", so a deuce can go on
  forever.
- **"Best of" means "first to".** `bestOf: 3` needs 3 set wins, not 2 of 3 (`setsToWin` returns
  `bestOf`). The UI labels it `BO3`, which reads as best of 3.
- **The current set isn't saved until it ends.** Points live in memory (`useScoringSession`).
  Leaving the screen or closing the app mid-set loses that set's points. Finished sets are safe.
- **Server and side swap aren't saved.** They reset when the screen reopens.

## Tournaments

- **Only round robin works.** Swiss, single elimination and "other" can't be picked in the wizard,
  and `generateBracket` throws for them. `next_match_id` is in the schema for knockouts but unused.
- **Editing players doesn't rebuild the bracket.** The bracket is generated once, right after
  creation. `update()` changes players, but existing teams and matches stay as they were. A removed
  player's team link is tombstoned, which can leave a team with a stale name.
- **A failed bracket fails silently.** `AddTournamentScreen` only logs bracket errors (for example
  doubles with an odd number of players). The tournament opens with "No bracket yet" and no reason
  why. Validating an even player count for doubles in the wizard would stop this.
- **Ties can't happen.** Standings count a concluded match with no winner as a tie, but every
  concluded match has a winner.
- **No head-to-head tiebreak.** Standings sort by wins, then point difference only.
- **`isGenerating` is never set** in `AddTournamentScreen`, so its loading view never shows.

## Sync and accounts

- **Last write wins** when the same row is edited on two devices. There's no merging of fields.
- **Sign-out loses unsynced changes** if you choose "Sign out anyway".
- **Old tombstones are never cleaned up.** Deleted rows stay on the device and the server forever.
- **`delete_guest_backup` is never called**, even after a guest makes an account, so old backups
  stay on the server.
- **Restoring a backup from a newer app version fails** with "made by a different version of the
  app". There's no upgrade path between snapshot versions yet.

## Database

- **The migration drops everything** when upgrading from v0/v1. That's fine today, but the next
  schema change needs a real migration step (see [Local database](05-database.md#migrations-migrationsts)).
- **Old names in storage.** `cockers.db` and the `cockers-*` AsyncStorage keys come from an earlier
  app name. They're kept on purpose. Renaming them needs code to move the old values.

## Code tidy-ups

- Nothing imports the four files in `src/features/home/components/`: `HomeHeader.tsx` (hard-coded
  "Good Morning" and "Date here"), `RecentMealsCard.tsx`, `TodayMealCard.tsx` and
  `ActivityHeatmap.tsx`. The meal cards look like leftovers from another project. Home uses the
  shared `Header` instead.
- The comment in `src/backup/code.ts` says the alphabet has 32 symbols. It has 31, which still gives
  about 79 bits.
- `useQuickMatches.create` has a leftover `console.log("CREATE DATA:", ...)`.
- `TournamentRepository.ts` has stray `//` and `///` comment lines and uneven indentation around
  `getStandings`.
