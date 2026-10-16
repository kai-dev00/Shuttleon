-- DB CLEAN UP: wipe all app data in a Supabase project.
--
-- NOT a migration (that is why it is not in supabase/migrations): run it by hand, on purpose, in the
-- SQL Editor. It permanently deletes data and cannot be undone.
--
-- Before you run it:
--   1. Check the project name at the top-left of the dashboard. Use this on the TEST project.
--      Think twice before running it on production.
--   2. Afterwards sign out in the app on each phone (that wipes the phone's local copy too).
--      Otherwise the phone keeps showing old matches that Supabase no longer has.
--
-- What it keeps: user accounts, table structure, security rules and the backup functions.

-- 1) Delete all matches, tournaments and guest backups ---------------------------------------
truncate table
  public.tournament_match_sets,
  public.tournament_matches,
  public.tournament_team_players,
  public.tournament_teams,
  public.tournament_players,
  public.tournaments,
  public.quick_match_sets,
  public.quick_match_players,
  public.quick_matches,
  public.guest_backups;

-- 2) OPTIONAL: also delete every user account -------------------------------------------------
-- Uncomment the next line (remove the two dashes) to start sign-ups from scratch.
-- Deleting a user also removes their rows, through the user_id link.
-- delete from auth.users;
