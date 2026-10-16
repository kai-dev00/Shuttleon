# 1. Overview

Shuttleon helps you score badminton games and run small tournaments from your phone.

## Features

- **Quick matches:** singles or doubles, first to 1–5 sets, sets played to 8, 11 or 21 points.
  Live scoring with deuce, set point and match point alerts, undo, side swap, a landscape
  scoreboard and rematches.
- **Tournaments:** a 4-step creation wizard, automatic round-robin scheduling, scoring each match,
  live standings and a champion banner when every match is done.
- **Offline first:** everything is saved to SQLite on the device. No network is needed to play.
- **Accounts and sync:** sign up with email (verified by a code), then matches sync to Supabase and
  appear on your other devices.
- **Guest mode:** use the app without an account. Guests can save their data under a 16-character
  backup code and restore it on another phone.
- **Light, dark and system themes**, switched from the Home screen.

## Screens

The app has two areas, picked by the root layout (`app/_layout.tsx`) depending on whether someone
can use the app yet.

### Before entering the app

| Route | Screen | Purpose |
|---|---|---|
| `/welcome` | `WelcomeScreen` | First screen: create account, sign in, continue as guest, or restore a backup |
| `/auth/register` | `RegisterScreen` | Email + password sign-up, then the 6–10 digit code sent by email |
| `/auth/login` | `LoginScreen` | Email + password sign-in |
| `/auth/forgot-password` | `ForgotPasswordScreen` | Emailed recovery code, then a new password |
| `/auth/restore` | `RestoreScreen` | Bring back a guest backup with its code |

### Inside the app (bottom tabs)

| Tab | Route | Screens |
|---|---|---|
| Home | `/` | `HomeScreen`: live match card ("Continue scoring"), start buttons, active tournament, last 4 matches, theme toggle |
| Tournament | `/tournament` | List → `/tournament/add` (wizard) → `/tournament/[id]` (bracket + standings) → `/tournament/match/[id]` (scoring). Edit at `/tournament/edit/[id]` |
| Quick | `/quick` | List with search and filters → `/quick/add` → `/quick/[id]` (scoring). Edit at `/quick/edit/[id]` |
| Profile | `/account` | `AccountScreen`: signed-in user and sync status, or guest backup tools |

The Tournament and Quick tabs use `popToTopOnBlur`, so leaving a tab resets it to its list.

## Main user flows

### First launch

1. The welcome screen offers **Create account**, **Sign in**, **Continue as guest** and
   **Restore from a backup code**.
2. If the build has no Supabase keys, the welcome screen is skipped and the app runs local-only
   (see [Accounts, sync and backups](06-accounts-sync-backups.md#when-supabase-isnt-configured)).

### Scoring a quick match

1. Quick tab → **+** (or Home → **Quick match**).
2. Choose singles or doubles, best of, scoring, then enter players (and team names for doubles).
3. Tap a side's panel to add a point. The banner shows deuce, set point or match point.
4. When a side wins the set, tap **End set N**. The set is saved and the next one starts.
5. When the match is won, the screen shows a summary with every set and a **Rematch** button.

### Running a tournament

1. Tournament tab → **+**, then fill in the 4 steps: details, format, players, review.
2. On confirm, the tournament is saved and the round-robin schedule is generated.
3. Open any match marked **Ready** to score it. Standings update as matches finish.
4. When the last match ends, the tournament becomes **concluded** and the leader is shown as
   the winner.

### Managing quick matches

- **Search** by player, team, match type or "rematch N".
- **Filter** by type, rematches only, best of, scoring and date (today, 7 days, 30 days).
- **Long-press** a row to start selecting. Tap more rows, then the trash icon deletes them.

### Signing out and leaving guest mode

- **Sign out** removes all match data from the phone. If changes haven't synced yet, the app
  warns first and offers **Sync now**.
- **Leave guest mode** also clears the phone. If there's data that isn't in a backup, the app
  warns first and offers **Back up first**.
